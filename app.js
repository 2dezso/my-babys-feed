import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore, collection, addDoc, deleteDoc, doc, setDoc,
  query, orderBy, limit, onSnapshot, enableIndexedDbPersistence,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
try { enableIndexedDbPersistence(db); } catch (e) { /* multiple tabs open, fine */ }

const STORAGE_KEY = 'babyfeed_household_code';
const DEFAULT_ML = 90;
const ML_MIN = 20;
const ML_MAX = 300;
const ML_STEP = 10;
const WHEEL_ITEM_HEIGHT = 40;

const setupScreen = document.getElementById('setup-screen');
const appScreen = document.getElementById('app-screen');
const homeScreen = document.getElementById('home-screen');
const milestonesScreen = document.getElementById('milestones-screen');
const trendsScreen = document.getElementById('trends-screen');
const profileScreen = document.getElementById('profile-screen');
const joinForm = document.getElementById('join-form');
const joinCodeInput = document.getElementById('join-code');
const setupError = document.getElementById('setup-error');
const btnCreateHousehold = document.getElementById('btn-create-household');

const sinceLastFeedEl = document.getElementById('since-last-feed');
const lastFeedDetailEl = document.getElementById('last-feed-detail');
const nextFeedTimeEl = document.getElementById('next-feed-time');
const todayTotalEl = document.getElementById('today-total-value');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const historyRange = document.getElementById('history-range');
const toast = document.getElementById('toast');

const btnLogFeed = document.getElementById('btn-log-feed');
const logModal = document.getElementById('log-modal');
const feedTimeInput = document.getElementById('feed-time');
const amountChips = document.getElementById('amount-chips');
const mlWheelTrack = document.getElementById('ml-wheel-track');
const intervalChips = document.getElementById('interval-chips');
const intervalAutoTag = document.getElementById('interval-auto-tag');
const logCancel = document.getElementById('log-cancel');
const logConfirm = document.getElementById('log-confirm');

const shareModal = document.getElementById('share-modal');
const btnShare = document.getElementById('btn-share');
const shareCodeEl = document.getElementById('share-code');
const shareClose = document.getElementById('share-close');

const profileTileLabel = document.getElementById('profile-tile-label');
const profileNameInput = document.getElementById('profile-name');
const profileDobInput = document.getElementById('profile-dob');
const profileBirthWeightInput = document.getElementById('profile-birth-weight');
const profileSaveBtn = document.getElementById('profile-save');
const weightList = document.getElementById('weight-list');
const weightEmpty = document.getElementById('weight-empty');
const weightDateInput = document.getElementById('weight-date');
const weightValueInput = document.getElementById('weight-value');
const weightAddBtn = document.getElementById('weight-add');

let selectedMl = DEFAULT_ML;
let selectedIntervalHours = 3;
let intervalOverridden = false;
let latestFeeds = [];
let latestWeights = [];
let currentRange = 'day';
let wheelScrollTimer = null;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function rangeCutoff(range) {
  const today = startOfToday();
  if (range === '7d') return today - 6 * 24 * 60 * 60 * 1000;
  if (range === '30d') return today - 29 * 24 * 60 * 60 * 1000;
  return today;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 2000);
}

function generateHouseholdCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function durationString(ms) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 1) return `${remMins}m`;
  return `${hours}h ${remMins}m`;
}

function timeAgo(ts) {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return `${hours}h ${remMins}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function feedsCollection(code) {
  return collection(db, 'households', code, 'feeds');
}

function profileDocRef(code) {
  return doc(db, 'households', code, 'profile', 'info');
}

function weightsCollection(code) {
  return collection(db, 'households', code, 'weights');
}

function localDateStringToTimestamp(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getHouseholdCode() {
  return localStorage.getItem(STORAGE_KEY);
}

function computeAutoIntervalHours(ml) {
  const raw = 3 + (ml - 90) / 30;
  return Math.min(6, Math.max(2, Math.round(raw)));
}

const SCREENS = {
  feed: appScreen,
  home: homeScreen,
  milestones: milestonesScreen,
  trends: trendsScreen,
  profile: profileScreen,
};

function showScreen(name) {
  Object.values(SCREENS).forEach(el => { el.hidden = true; });
  (SCREENS[name] || SCREENS.feed).hidden = false;
}

function applyRouteFromHash() {
  const name = (location.hash || '').slice(1);
  showScreen(name in SCREENS ? name : 'feed');
}

function goTo(name) {
  location.hash = name;
}

window.addEventListener('hashchange', applyRouteFromHash);

document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', () => goTo(el.dataset.nav));
});

function enterApp(code) {
  setupScreen.hidden = true;
  if (!(location.hash.slice(1) in SCREENS)) {
    history.replaceState(null, '', '#feed');
  }
  applyRouteFromHash();
  listenToFeeds(code);
  listenToProfile(code);
  listenToWeights(code);
}

function listenToFeeds(code) {
  const q = query(feedsCollection(code), orderBy('timestamp', 'desc'), limit(500));
  onSnapshot(q, (snapshot) => {
    latestFeeds = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSinceLastFeed();
    renderNextFeed();
    renderTodayTotal();
    renderHistory();
  }, (err) => {
    console.error(err);
    showToast('Sync error — check connection');
  });
}

function listenToProfile(code) {
  onSnapshot(profileDocRef(code), (snap) => {
    const data = snap.data() || {};
    profileNameInput.value = data.name || '';
    profileDobInput.value = data.dob || '';
    profileTileLabel.textContent = data.name || 'Profile';
  }, (err) => {
    console.error(err);
  });
}

function listenToWeights(code) {
  const q = query(weightsCollection(code), orderBy('timestamp', 'desc'), limit(200));
  onSnapshot(q, (snapshot) => {
    latestWeights = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderWeights();
  }, (err) => {
    console.error(err);
  });
}

function renderSinceLastFeed() {
  if (latestFeeds.length === 0) {
    sinceLastFeedEl.textContent = '—';
    lastFeedDetailEl.textContent = 'No feeds yet';
    return;
  }
  const last = latestFeeds[0];
  sinceLastFeedEl.textContent = durationString(Date.now() - last.timestamp);
  const amount = last.amountMl ? `${last.amountMl}ml · ` : '';
  lastFeedDetailEl.textContent = `Last fed at ${formatClock(last.timestamp)} · ${amount}${timeAgo(last.timestamp)}`;
}

function renderNextFeed() {
  if (latestFeeds.length === 0) {
    nextFeedTimeEl.textContent = '—';
    return;
  }
  const last = latestFeeds[0];
  const intervalHours = last.intervalHours || 3;
  const nextTs = last.timestamp + intervalHours * 60 * 60 * 1000;
  const diffMs = nextTs - Date.now();
  const clock = formatClock(nextTs);
  if (diffMs <= 0) {
    const overdueMins = Math.floor(-diffMs / 60000);
    nextFeedTimeEl.textContent = overdueMins < 1 ? `${clock} · due now` : `${clock} · overdue ${overdueMins}m`;
  } else {
    nextFeedTimeEl.textContent = `${clock} · in ${durationString(diffMs)}`;
  }
}

function renderTodayTotal() {
  const today = startOfToday();
  const total = latestFeeds
    .filter(f => f.timestamp >= today)
    .reduce((sum, f) => sum + (f.amountMl || 0), 0);
  todayTotalEl.textContent = `${total}ml`;
}

function renderHistory() {
  const cutoff = rangeCutoff(currentRange);
  const filtered = latestFeeds.filter(f => f.timestamp >= cutoff);
  historyList.innerHTML = '';
  historyEmpty.hidden = filtered.length !== 0;
  for (let i = 0; i < filtered.length; i++) {
    const feed = filtered[i];
    const fullIndex = latestFeeds.indexOf(feed);
    const older = latestFeeds[fullIndex + 1];
    const gap = older ? `+${durationString(feed.timestamp - older.timestamp)}` : '—';
    const amount = feed.amountMl ? `${feed.amountMl}ml` : 'Bottle';

    const li = document.createElement('li');
    li.innerHTML = `
      <span class="history-time-val">${formatClock(feed.timestamp)}</span>
      <span class="history-amount-val">${amount}</span>
      <span class="history-gap-val">${gap}</span>
      <button class="history-delete" title="Delete">✕</button>
    `;
    li.querySelector('.history-delete').addEventListener('click', () => deleteFeed(feed.id));
    historyList.appendChild(li);
  }
}

historyRange.querySelectorAll('.segment').forEach(seg => {
  seg.addEventListener('click', () => {
    currentRange = seg.dataset.range;
    historyRange.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
    seg.classList.add('active');
    renderHistory();
  });
});

async function logFeed(timestamp, amountMl, intervalHours) {
  const code = getHouseholdCode();
  if (!code) return;
  try {
    await addDoc(feedsCollection(code), {
      type: 'bottle',
      timestamp,
      amountMl,
      intervalHours,
    });
    showToast('Feed logged');
  } catch (e) {
    console.error(e);
    showToast('Could not log feed — check connection');
  }
}

async function deleteFeed(id) {
  const code = getHouseholdCode();
  if (!code) return;
  try {
    await deleteDoc(doc(db, 'households', code, 'feeds', id));
  } catch (e) {
    console.error(e);
    showToast('Could not delete');
  }
}

// --- Profile & weight log ---

function renderWeights() {
  weightList.innerHTML = '';
  weightEmpty.hidden = latestWeights.length !== 0;
  for (const w of latestWeights) {
    const dateStr = new Date(w.timestamp).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="weight-date-val">${dateStr}${w.isBirth ? ' · Birth' : ''}</span>
      <span class="weight-value-val">${w.weightKg}kg</span>
      <button class="history-delete" title="Delete">✕</button>
    `;
    li.querySelector('.history-delete').addEventListener('click', () => deleteWeight(w.id));
    weightList.appendChild(li);
  }
}

async function deleteWeight(id) {
  const code = getHouseholdCode();
  if (!code) return;
  try {
    await deleteDoc(doc(db, 'households', code, 'weights', id));
  } catch (e) {
    console.error(e);
    showToast('Could not delete');
  }
}

profileSaveBtn.addEventListener('click', async () => {
  const code = getHouseholdCode();
  if (!code) return;
  const name = profileNameInput.value.trim();
  const dob = profileDobInput.value;
  try {
    await setDoc(profileDocRef(code), { name, dob }, { merge: true });
    const birthWeight = profileBirthWeightInput.value;
    const hasBirthEntry = latestWeights.some(w => w.isBirth);
    if (birthWeight && dob && !hasBirthEntry) {
      await addDoc(weightsCollection(code), {
        weightKg: Number(birthWeight),
        timestamp: localDateStringToTimestamp(dob),
        isBirth: true,
      });
    }
    profileBirthWeightInput.value = '';
    showToast('Profile saved');
  } catch (e) {
    console.error(e);
    showToast('Could not save — check connection');
  }
});

weightAddBtn.addEventListener('click', async () => {
  const code = getHouseholdCode();
  if (!code) return;
  const dateVal = weightDateInput.value;
  const weightVal = weightValueInput.value;
  if (!dateVal || !weightVal) {
    showToast('Enter a date and weight');
    return;
  }
  try {
    await addDoc(weightsCollection(code), {
      weightKg: Number(weightVal),
      timestamp: localDateStringToTimestamp(dateVal),
    });
    weightDateInput.value = '';
    weightValueInput.value = '';
    showToast('Weight logged');
  } catch (e) {
    console.error(e);
    showToast('Could not log weight — check connection');
  }
});

// --- Amount wheel picker ---

const wheelValues = [];
for (let v = ML_MIN; v <= ML_MAX; v += ML_STEP) wheelValues.push(v);

wheelValues.forEach((v) => {
  const item = document.createElement('div');
  item.className = 'wheel-item';
  item.textContent = `${v}ml`;
  item.dataset.value = v;
  mlWheelTrack.appendChild(item);
});

function wheelIndexForValue(v) {
  return Math.round((v - ML_MIN) / ML_STEP);
}

function scrollWheelTo(value, smooth = false) {
  const index = wheelIndexForValue(value);
  mlWheelTrack.scrollTo({ top: index * WHEEL_ITEM_HEIGHT, behavior: smooth ? 'smooth' : 'auto' });
}

function updateWheelActiveItem() {
  const index = Math.round(mlWheelTrack.scrollTop / WHEEL_ITEM_HEIGHT);
  const clamped = Math.max(0, Math.min(wheelValues.length - 1, index));
  const value = wheelValues[clamped];
  mlWheelTrack.querySelectorAll('.wheel-item').forEach((el, i) => {
    el.classList.toggle('active', i === clamped);
  });
  return value;
}

function onAmountChanged(value) {
  selectedMl = value;
  amountChips.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('selected', Number(c.dataset.ml) === value);
  });
  if (!intervalOverridden) {
    selectedIntervalHours = computeAutoIntervalHours(value);
    highlightIntervalChip();
  }
}

mlWheelTrack.addEventListener('scroll', () => {
  const value = updateWheelActiveItem();
  clearTimeout(wheelScrollTimer);
  wheelScrollTimer = setTimeout(() => onAmountChanged(value), 120);
});

amountChips.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const value = Number(chip.dataset.ml);
    scrollWheelTo(value);
    onAmountChanged(value);
  });
});

function highlightIntervalChip() {
  intervalChips.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('selected', Number(c.dataset.hours) === selectedIntervalHours);
  });
  intervalAutoTag.hidden = intervalOverridden;
}

intervalChips.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    selectedIntervalHours = Number(chip.dataset.hours);
    intervalOverridden = true;
    highlightIntervalChip();
  });
});

// --- Log modal ---

function openLogModal() {
  intervalOverridden = false;
  selectedMl = DEFAULT_ML;
  selectedIntervalHours = computeAutoIntervalHours(DEFAULT_ML);

  const now = new Date();
  feedTimeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  logModal.hidden = false;
  scrollWheelTo(DEFAULT_ML);
  onAmountChanged(DEFAULT_ML);
  updateWheelActiveItem();
}

btnLogFeed.addEventListener('click', openLogModal);
logCancel.addEventListener('click', () => { logModal.hidden = true; });

logConfirm.addEventListener('click', () => {
  let timestamp = Date.now();
  if (feedTimeInput.value) {
    const [h, m] = feedTimeInput.value.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    timestamp = d.getTime();
  }
  logModal.hidden = true;
  logFeed(timestamp, selectedMl, selectedIntervalHours);
});

weightDateInput.value = todayDateString();
weightDateInput.max = todayDateString();
profileDobInput.max = todayDateString();

// --- Share / setup ---

btnShare.addEventListener('click', () => {
  shareCodeEl.textContent = getHouseholdCode();
  shareModal.hidden = false;
});
shareClose.addEventListener('click', () => { shareModal.hidden = true; });
shareCodeEl.addEventListener('click', () => {
  navigator.clipboard?.writeText(getHouseholdCode()).then(() => showToast('Code copied'));
});

btnCreateHousehold.addEventListener('click', () => {
  const code = generateHouseholdCode();
  localStorage.setItem(STORAGE_KEY, code);
  enterApp(code);
  setTimeout(() => {
    shareCodeEl.textContent = code;
    shareModal.hidden = false;
  }, 300);
});

joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!code) {
    setupError.textContent = 'Enter a household code.';
    setupError.hidden = false;
    return;
  }
  setupError.hidden = true;
  localStorage.setItem(STORAGE_KEY, code);
  enterApp(code);
});

setInterval(() => { renderSinceLastFeed(); renderNextFeed(); renderTodayTotal(); }, 15000);

const existingCode = getHouseholdCode();
if (existingCode) {
  enterApp(existingCode);
} else {
  setupScreen.hidden = false;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js?v=7').catch(() => {});
  });
}
