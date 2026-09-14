import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore, collection, addDoc, deleteDoc, doc, setDoc, updateDoc,
  query, where, orderBy, limit, documentId, onSnapshot, enableIndexedDbPersistence,
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
const pooScreen = document.getElementById('poo-screen');
const joinForm = document.getElementById('join-form');
const joinCodeInput = document.getElementById('join-code');
const setupError = document.getElementById('setup-error');
const btnCreateHousehold = document.getElementById('btn-create-household');

const heroCard = document.getElementById('hero-card');
const heroLabelEl = document.getElementById('hero-label');
const sinceLastFeedEl = document.getElementById('since-last-feed');
const lastFeedDetailEl = document.getElementById('last-feed-detail');
const nextFeedTimeEl = document.getElementById('next-feed-time');
const todayTotalEl = document.getElementById('today-total-value');
const bottlePill = document.getElementById('bottle-pill');
const bottleStatusEl = document.getElementById('bottle-status');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const historyRange = document.getElementById('history-range');
const toast = document.getElementById('toast');

const btnStartFeedNow = document.getElementById('btn-start-feed-now');
const btnLogFeed = document.getElementById('btn-log-feed');
const logModal = document.getElementById('log-modal');
const logModalTitle = document.getElementById('log-modal-title');
const feedDateInput = document.getElementById('feed-date');
const feedDateLabel = document.getElementById('feed-date-label');
const feedTimeInput = document.getElementById('feed-time');
const amountChips = document.getElementById('amount-chips');
const mlWheelTrack = document.getElementById('ml-wheel-track');
const intervalChips = document.getElementById('interval-chips');
const intervalAutoTag = document.getElementById('interval-auto-tag');
const logStart = document.getElementById('log-start');
const logCancel = document.getElementById('log-cancel');
const logConfirm = document.getElementById('log-confirm');

const shareModal = document.getElementById('share-modal');
const btnShare = document.getElementById('btn-share');
const shareCodeEl = document.getElementById('share-code');
const shareClose = document.getElementById('share-close');

const profileTileLabel = document.getElementById('profile-tile-label');
const profileTileIcon = document.getElementById('profile-tile-icon');
const profileIconBig = document.getElementById('profile-icon-big');
const avatarToneChips = document.getElementById('avatar-tone-chips');
const profileNameInput = document.getElementById('profile-name');
const profileDobInput = document.getElementById('profile-dob');
const profileAgeEl = document.getElementById('profile-age');
const profileSaveBtn = document.getElementById('profile-save');

const trendsChartEl = document.getElementById('trends-chart');
const trendsSummaryEl = document.getElementById('trends-summary');
const trendsLegendNameEl = document.getElementById('trends-legend-name');
const trendsDobHintEl = document.getElementById('trends-dob-hint');

const calPrev = document.getElementById('cal-prev');
const calNext = document.getElementById('cal-next');
const calMonthLabel = document.getElementById('cal-month-label');
const calGrid = document.getElementById('cal-grid');
const calDobHint = document.getElementById('cal-dob-hint');

const milestoneModal = document.getElementById('milestone-modal');
const milestoneModalTitle = document.getElementById('milestone-modal-title');
const milestonePhotoPreview = document.getElementById('milestone-photo-preview');
const milestonePhotoBtn = document.getElementById('milestone-photo-btn');
const milestonePhotoInput = document.getElementById('milestone-photo-input');
const milestoneCaption = document.getElementById('milestone-caption');
const milestoneCancel = document.getElementById('milestone-cancel');
const milestoneSave = document.getElementById('milestone-save');
const milestoneDelete = document.getElementById('milestone-delete');

const sinceLastPooEl = document.getElementById('since-last-poo');
const lastPooDetailEl = document.getElementById('last-poo-detail');
const btnLogPoo = document.getElementById('btn-log-poo');
const pooHistoryList = document.getElementById('poo-history-list');
const pooHistoryEmpty = document.getElementById('poo-history-empty');
const pooHistoryRange = document.getElementById('poo-history-range');
const pooTimeModal = document.getElementById('poo-time-modal');
const pooDateInput = document.getElementById('poo-date');
const pooDateLabel = document.getElementById('poo-date-label');
const pooTimeInput = document.getElementById('poo-time');
const pooSizeChips = document.getElementById('poo-size-chips');
const pooNoteInput = document.getElementById('poo-note');
const pooTimeCancel = document.getElementById('poo-time-cancel');
const pooTimeConfirm = document.getElementById('poo-time-confirm');

let selectedMl = DEFAULT_ML;
let selectedIntervalHours = 3;
let intervalOverridden = false;
let latestFeeds = [];
let latestPoos = [];
let currentRange = 'today';
let currentPooRange = 'today';
let selectedAvatarTone = '';
let profileDob = '';
let selectedPooSize = '';
let bottleMadeAt = null;
let calendarInitialized = false;
let currentCalYear = 0;
let currentCalMonth = 0;
let currentMonthMilestones = new Map();
let currentMonthUnsub = null;
let editingDateKey = null;
let pendingPhotoDataUrl = null;
let wheelScrollTimer = null;
let editingFeedId = null;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function rangeCutoff(range) {
  if (range === '7d') return Date.now() - 7 * 24 * 60 * 60 * 1000;
  if (range === '1d') return Date.now() - 24 * 60 * 60 * 1000;
  return startOfToday();
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

function poosCollection(code) {
  return collection(db, 'households', code, 'poos');
}

function bottleDocRef(code) {
  return doc(db, 'households', code, 'bottle', 'info');
}

function getHouseholdCode() {
  return localStorage.getItem(STORAGE_KEY);
}

function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  poo: pooScreen,
};

function showScreen(name) {
  Object.values(SCREENS).forEach(el => { el.hidden = true; });
  (SCREENS[name] || SCREENS.feed).hidden = false;
}

function applyRouteFromHash() {
  const name = (location.hash || '').slice(1);
  showScreen(name in SCREENS ? name : 'feed');
  if (name === 'milestones') ensureCalendarInitialized();
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
  listenToPoos(code);
  listenToBottle(code);
}

function listenToFeeds(code) {
  const q = query(feedsCollection(code), orderBy('timestamp', 'desc'), limit(3000));
  onSnapshot(q, (snapshot) => {
    latestFeeds = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSinceLastFeed();
    renderNextFeed();
    renderTodayTotal();
    renderHistory();
    renderTrendsChart();
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
    profileDob = data.dob || '';
    selectedAvatarTone = data.avatarTone || '';
    profileTileLabel.textContent = data.name || 'Profile';
    trendsLegendNameEl.textContent = data.name || 'Your baby';
    updateAvatarIcons();
    highlightToneChip();
    renderProfileAge();
    renderTrendsChart();
    if (calendarInitialized) renderCalendar();
  }, (err) => {
    console.error(err);
  });
}

function updateAvatarIcons() {
  const icon = `👶${selectedAvatarTone}`;
  profileTileIcon.textContent = icon;
  profileIconBig.textContent = icon;
}

function highlightToneChip() {
  avatarToneChips.querySelectorAll('.tone-chip').forEach(c => {
    c.classList.toggle('selected', c.dataset.tone === selectedAvatarTone);
  });
}

avatarToneChips.querySelectorAll('.tone-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    selectedAvatarTone = chip.dataset.tone;
    updateAvatarIcons();
    highlightToneChip();
  });
});

function ageString(dobStr) {
  const [y, m, d] = dobStr.split('-').map(Number);
  const dob = new Date(y, m - 1, d);
  const diffDays = Math.floor((Date.now() - dob.getTime()) / 86400000);
  if (diffDays < 0) return '';
  const months = Math.floor(diffDays / 30.44);
  if (months >= 1) {
    const remDays = Math.round(diffDays - months * 30.44);
    return `${months} month${months !== 1 ? 's' : ''}${remDays > 0 ? `, ${remDays}d` : ''} old`;
  }
  const weeks = Math.floor(diffDays / 7);
  if (weeks >= 1) {
    const remDays = diffDays - weeks * 7;
    return `${weeks} week${weeks !== 1 ? 's' : ''}${remDays > 0 ? `, ${remDays}d` : ''} old`;
  }
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} old`;
}

function renderProfileAge() {
  profileAgeEl.textContent = profileDob ? ageString(profileDob) : '';
}

function listenToPoos(code) {
  const q = query(poosCollection(code), orderBy('timestamp', 'desc'), limit(500));
  onSnapshot(q, (snapshot) => {
    latestPoos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSinceLastPoo();
    renderPooHistory();
  }, (err) => {
    console.error(err);
    showToast('Sync error — check connection');
  });
}

function renderSinceLastPoo() {
  if (latestPoos.length === 0) {
    sinceLastPooEl.textContent = '—';
    lastPooDetailEl.textContent = 'No poos yet';
    return;
  }
  const last = latestPoos[0];
  sinceLastPooEl.textContent = durationString(Date.now() - last.timestamp);
  lastPooDetailEl.textContent = `Last at ${formatClock(last.timestamp)} · ${timeAgo(last.timestamp)}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderPooHistory() {
  const cutoff = rangeCutoff(currentPooRange);
  const filtered = latestPoos.filter(p => p.timestamp >= cutoff);
  pooHistoryList.innerHTML = '';
  pooHistoryEmpty.hidden = filtered.length !== 0;
  for (let i = 0; i < filtered.length; i++) {
    const poo = filtered[i];
    const fullIndex = latestPoos.indexOf(poo);
    const older = latestPoos[fullIndex + 1];
    const gap = older ? durationString(poo.timestamp - older.timestamp) : '—';

    const li = document.createElement('li');
    li.innerHTML = `
      <span class="history-time-val">${formatClock(poo.timestamp)}${poo.size ? ` · ${poo.size}` : ''}</span>
      <span class="history-gap-val">${gap}</span>
      <button class="history-delete" title="Delete">✕</button>
      ${poo.note ? `<span class="poo-note-row">${escapeHtml(poo.note)}</span>` : ''}
    `;
    li.querySelector('.history-delete').addEventListener('click', () => deletePoo(poo.id));
    pooHistoryList.appendChild(li);
  }
}

pooHistoryRange.querySelectorAll('.segment').forEach(seg => {
  seg.addEventListener('click', () => {
    currentPooRange = seg.dataset.range;
    pooHistoryRange.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
    seg.classList.add('active');
    renderPooHistory();
  });
});

async function logPoo(timestamp, size, note) {
  const code = getHouseholdCode();
  if (!code) return;
  try {
    await addDoc(poosCollection(code), {
      timestamp,
      ...(size ? { size } : {}),
      ...(note ? { note } : {}),
    });
    showToast('Poo logged');
  } catch (e) {
    console.error(e);
    showToast('Could not log poo — check connection');
  }
}

async function deletePoo(id) {
  const code = getHouseholdCode();
  if (!code) return;
  try {
    await deleteDoc(doc(db, 'households', code, 'poos', id));
  } catch (e) {
    console.error(e);
    showToast('Could not delete');
  }
}

function highlightPooSizeChip() {
  pooSizeChips.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('selected', c.dataset.size === selectedPooSize);
  });
}

pooSizeChips.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    selectedPooSize = selectedPooSize === chip.dataset.size ? '' : chip.dataset.size;
    highlightPooSizeChip();
  });
});

btnLogPoo.addEventListener('click', () => {
  const now = new Date();
  pooDateInput.value = todayDateString();
  pooDateInput.max = todayDateString();
  updateDateLabel(pooDateInput, pooDateLabel);
  pooTimeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  selectedPooSize = '';
  highlightPooSizeChip();
  pooNoteInput.value = '';
  pooTimeModal.hidden = false;
});

pooTimeCancel.addEventListener('click', () => { pooTimeModal.hidden = true; });

pooTimeConfirm.addEventListener('click', () => {
  const timestamp = combineDateTimeToTimestamp(pooDateInput.value, pooTimeInput.value);
  const note = pooNoteInput.value.trim();
  pooTimeModal.hidden = true;
  logPoo(timestamp, selectedPooSize, note);
});

function renderSinceLastFeed() {
  if (latestFeeds.length === 0) {
    heroCard.classList.remove('hero-pending');
    heroLabelEl.textContent = 'Since last feed';
    sinceLastFeedEl.textContent = '—';
    lastFeedDetailEl.textContent = 'No feeds yet';
    return;
  }
  const last = latestFeeds[0];
  const isPending = last.amountMl == null;
  heroCard.classList.toggle('hero-pending', isPending);
  sinceLastFeedEl.textContent = durationString(Date.now() - last.timestamp);
  if (isPending) {
    heroLabelEl.textContent = 'Feeding now';
    lastFeedDetailEl.textContent = 'Tap to add amount';
  } else {
    heroLabelEl.textContent = 'Since last feed';
    lastFeedDetailEl.textContent = `Last fed at ${formatClock(last.timestamp)} · ${last.amountMl}ml · ${timeAgo(last.timestamp)}`;
  }
}

heroCard.addEventListener('click', () => {
  if (latestFeeds.length && latestFeeds[0].amountMl == null) {
    openLogModal(latestFeeds[0]);
  }
});

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

const BOTTLE_GOOD_FOR_MS = 2 * 60 * 60 * 1000;

function listenToBottle(code) {
  onSnapshot(bottleDocRef(code), (snap) => {
    const data = snap.data() || {};
    bottleMadeAt = data.madeAt || null;
    renderBottleStatus();
  }, (err) => {
    console.error(err);
  });
}

function renderBottleStatus() {
  if (!bottleMadeAt) {
    bottleStatusEl.textContent = 'Tap to start';
    bottlePill.classList.remove('bottle-expired');
    return;
  }
  const remaining = BOTTLE_GOOD_FOR_MS - (Date.now() - bottleMadeAt);
  if (remaining <= 0) {
    bottleStatusEl.textContent = 'Expired — discard';
    bottlePill.classList.add('bottle-expired');
  } else {
    bottleStatusEl.textContent = `${durationString(remaining)} left`;
    bottlePill.classList.remove('bottle-expired');
  }
}

bottlePill.addEventListener('click', async () => {
  const code = getHouseholdCode();
  if (!code) return;
  try {
    await setDoc(bottleDocRef(code), { madeAt: Date.now() }, { merge: true });
    showToast('Bottle timer started');
  } catch (e) {
    console.error(e);
    showToast('Could not save — check connection');
  }
});

function dayKeyForTimestamp(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabelForKey(dayStartMs) {
  const diffDays = Math.round((startOfToday() - dayStartMs) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return new Date(dayStartMs).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function renderHistory() {
  const cutoff = rangeCutoff(currentRange);
  const filtered = latestFeeds.filter(f => f.timestamp >= cutoff);
  historyList.innerHTML = '';
  historyEmpty.hidden = filtered.length !== 0;

  const groups = new Map();
  for (const feed of filtered) {
    const key = dayKeyForTimestamp(feed.timestamp);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(feed);
  }

  for (const key of Array.from(groups.keys()).sort((a, b) => b - a)) {
    const dayFeeds = groups.get(key);
    const dayTotal = dayFeeds.reduce((sum, f) => sum + (f.amountMl || 0), 0);

    const headerLi = document.createElement('li');
    headerLi.className = 'day-group-header';
    headerLi.innerHTML = `<span class="day-group-label">${dayLabelForKey(key)}</span><span class="day-group-total">${dayTotal}ml</span>`;
    historyList.appendChild(headerLi);

    for (const feed of dayFeeds) {
      const fullIndex = latestFeeds.indexOf(feed);
      const older = latestFeeds[fullIndex + 1];
      const gap = older ? durationString(feed.timestamp - older.timestamp) : '—';
      const amountHtml = feed.amountMl != null
        ? `<span class="history-amount-val">${feed.amountMl}ml</span>`
        : `<button class="add-amount-btn">Add amount</button>`;

      const li = document.createElement('li');
      li.innerHTML = `
        <span class="history-time-val">${formatClock(feed.timestamp)}</span>
        ${amountHtml}
        <span class="history-gap-val">${gap}</span>
        <button class="history-delete" title="Delete">✕</button>
      `;
      li.querySelector('.history-delete').addEventListener('click', () => deleteFeed(feed.id));
      li.querySelector('.add-amount-btn')?.addEventListener('click', () => openLogModal(feed));
      historyList.appendChild(li);
    }
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

async function startFeed(timestamp, intervalHours) {
  const code = getHouseholdCode();
  if (!code) return;
  try {
    await addDoc(feedsCollection(code), {
      type: 'bottle',
      timestamp,
      intervalHours,
    });
    showToast('Feed started');
  } catch (e) {
    console.error(e);
    showToast('Could not start feed — check connection');
  }
}

async function finishFeed(id, timestamp, amountMl, intervalHours) {
  const code = getHouseholdCode();
  if (!code) return;
  try {
    await updateDoc(doc(db, 'households', code, 'feeds', id), { timestamp, amountMl, intervalHours });
    showToast('Amount saved');
  } catch (e) {
    console.error(e);
    showToast('Could not save — check connection');
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

// --- Profile ---

profileDobInput.addEventListener('input', () => {
  profileDob = profileDobInput.value;
  renderProfileAge();
});

profileSaveBtn.addEventListener('click', async () => {
  const code = getHouseholdCode();
  if (!code) return;
  const name = profileNameInput.value.trim();
  const dob = profileDobInput.value;
  try {
    await setDoc(profileDocRef(code), { name, dob, avatarTone: selectedAvatarTone }, { merge: true });
    showToast('Profile saved');
  } catch (e) {
    console.error(e);
    showToast('Could not save — check connection');
  }
});

// --- Trends & Facts ---

// Illustrative general guideline (approximate typical formula/bottle intake by age),
// not medical advice. Linearly interpolated between these key points.
const WORLD_AVG_ML_BY_WEEK = [
  { week: 0, ml: 300 },
  { week: 1, ml: 450 },
  { week: 2, ml: 550 },
  { week: 4, ml: 650 },
  { week: 6, ml: 750 },
  { week: 8, ml: 800 },
  { week: 12, ml: 850 },
  { week: 16, ml: 900 },
  { week: 26, ml: 900 },
  { week: 39, ml: 850 },
  { week: 52, ml: 800 },
];

function worldAvgAtWeek(week) {
  const pts = WORLD_AVG_ML_BY_WEEK;
  if (week <= pts[0].week) return pts[0].ml;
  if (week >= pts[pts.length - 1].week) return pts[pts.length - 1].ml;
  for (let i = 0; i < pts.length - 1; i++) {
    if (week >= pts[i].week && week <= pts[i + 1].week) {
      const t = (week - pts[i].week) / (pts[i + 1].week - pts[i].week);
      return pts[i].ml + t * (pts[i + 1].ml - pts[i].ml);
    }
  }
  return pts[pts.length - 1].ml;
}

function computeBabyWeeklyAverages() {
  if (!profileDob) return [];
  const [y, m, d] = profileDob.split('-').map(Number);
  const dobTs = new Date(y, m - 1, d).getTime();

  const totals = new Map();
  for (const f of latestFeeds) {
    if (f.amountMl == null) continue;
    const weekIndex = Math.floor((f.timestamp - dobTs) / (7 * 86400000));
    if (weekIndex < 0) continue;
    totals.set(weekIndex, (totals.get(weekIndex) || 0) + f.amountMl);
  }

  const now = Date.now();
  const points = [];
  for (const [weekIndex, total] of totals) {
    const weekStart = dobTs + weekIndex * 7 * 86400000;
    const weekEnd = weekStart + 7 * 86400000;
    const elapsedDays = Math.max(1, Math.round((Math.min(now, weekEnd) - weekStart) / 86400000));
    points.push({ week: weekIndex, ml: total / elapsedDays });
  }
  points.sort((a, b) => a.week - b.week);
  return points;
}

function renderTrendsChart() {
  if (!trendsChartEl) return;
  trendsDobHintEl.hidden = !!profileDob;

  const babyPoints = computeBabyWeeklyAverages();
  const maxWeek = 52;
  const maxMl = 1100;
  const width = 300;
  const height = 170;
  const padLeft = 34;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 20;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const x = (week) => padLeft + (Math.min(week, maxWeek) / maxWeek) * plotW;
  const y = (ml) => padTop + plotH - (Math.min(ml, maxMl) / maxMl) * plotH;

  const refPoints = [];
  for (let w = 0; w <= maxWeek; w++) refPoints.push(`${x(w)},${y(worldAvgAtWeek(w))}`);

  const gridLines = [0, 300, 600, 900].map(ml => `
    <line x1="${padLeft}" y1="${y(ml)}" x2="${width - padRight}" y2="${y(ml)}" stroke="var(--border)" stroke-width="1" />
    <text x="${padLeft - 5}" y="${y(ml) + 3}" text-anchor="end" font-size="8" fill="var(--muted)">${ml}</text>
  `).join('');

  const xLabels = [0, 13, 26, 39, 52].map(w => `
    <text x="${x(w)}" y="${height - 4}" text-anchor="middle" font-size="8" fill="var(--muted)">${w === 0 ? 'Birth' : w + 'w'}</text>
  `).join('');

  const babyPolyline = babyPoints.length > 1
    ? `<polyline points="${babyPoints.map(p => `${x(p.week)},${y(p.ml)}`).join(' ')}" fill="none" stroke="var(--primary)" stroke-width="2.5" />`
    : '';
  const babyDots = babyPoints.map(p => `<circle cx="${x(p.week)}" cy="${y(p.ml)}" r="2.8" fill="var(--primary)" />`).join('');

  trendsChartEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="trends-svg">
      ${gridLines}
      ${xLabels}
      <polyline points="${refPoints.join(' ')}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4,3" />
      ${babyPolyline}
      ${babyDots}
    </svg>
  `;

  if (babyPoints.length > 0) {
    const latest = babyPoints[babyPoints.length - 1];
    const worldAtLatest = Math.round(worldAvgAtWeek(latest.week));
    const babyAvg = Math.round(latest.ml);
    const name = trendsLegendNameEl.textContent || 'Your baby';
    trendsSummaryEl.textContent = `This week: ${name} ~${babyAvg}ml/day vs world average ~${worldAtLatest}ml/day`;
  } else {
    trendsSummaryEl.textContent = '';
  }
}

// --- Milestones ---

function milestonesCollection(code) {
  return collection(db, 'households', code, 'milestones');
}

function dateKeyFor(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function computeFirstYearBounds() {
  if (!profileDob) return null;
  const [y, m] = profileDob.split('-').map(Number);
  const startIdx = y * 12 + (m - 1);
  const endIdx = startIdx + 11;
  return {
    startYear: y, startMonth: m - 1,
    endYear: Math.floor(endIdx / 12), endMonth: endIdx % 12,
  };
}

function isMonthInBounds(year, month) {
  const bounds = computeFirstYearBounds();
  if (!bounds) return true;
  const idx = year * 12 + month;
  return idx >= bounds.startYear * 12 + bounds.startMonth && idx <= bounds.endYear * 12 + bounds.endMonth;
}

function ensureCalendarInitialized() {
  if (calendarInitialized) {
    renderCalendar();
    return;
  }
  calendarInitialized = true;
  if (profileDob) {
    const [y, m] = profileDob.split('-').map(Number);
    currentCalYear = y;
    currentCalMonth = m - 1;
  } else {
    const now = new Date();
    currentCalYear = now.getFullYear();
    currentCalMonth = now.getMonth();
  }
  loadMonth(currentCalYear, currentCalMonth);
}

function loadMonth(year, month) {
  if (currentMonthUnsub) {
    currentMonthUnsub();
    currentMonthUnsub = null;
  }
  currentMonthMilestones = new Map();
  renderCalendar();

  const code = getHouseholdCode();
  if (!code) return;
  const startKey = dateKeyFor(year, month, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const endKey = dateKeyFor(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
  const q = query(
    milestonesCollection(code),
    where(documentId(), '>=', startKey),
    where(documentId(), '<', endKey)
  );
  currentMonthUnsub = onSnapshot(q, (snapshot) => {
    currentMonthMilestones = new Map(snapshot.docs.map(d => [d.id, d.data()]));
    renderCalendar();
  }, (err) => {
    console.error(err);
    showToast('Sync error — check connection');
  });
}

function renderCalendar() {
  calMonthLabel.textContent = new Date(currentCalYear, currentCalMonth, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
  calDobHint.hidden = !!profileDob;

  const bounds = computeFirstYearBounds();
  const idx = currentCalYear * 12 + currentCalMonth;
  calPrev.disabled = !!bounds && idx <= bounds.startYear * 12 + bounds.startMonth;
  calNext.disabled = !!bounds && idx >= bounds.endYear * 12 + bounds.endMonth;

  calGrid.innerHTML = '';
  const firstOfMonth = new Date(currentCalYear, currentCalMonth, 1);
  const daysInMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Mon=0..Sun=6

  for (let i = 0; i < firstWeekday; i++) {
    const filler = document.createElement('span');
    filler.className = 'cal-day out-of-range';
    calGrid.appendChild(filler);
  }

  const todayKey = todayDateString();
  for (let day = 1; day <= daysInMonth; day++) {
    const key = dateKeyFor(currentCalYear, currentCalMonth, day);
    const entry = currentMonthMilestones.get(key);
    const btn = document.createElement('button');
    btn.className = 'cal-day';
    btn.textContent = String(day);
    if (key === todayKey) btn.classList.add('today-marker');
    if (entry) {
      btn.classList.add('has-entry');
      if (entry.photoDataUrl) {
        btn.classList.add('has-photo');
        btn.style.backgroundImage = `url(${entry.photoDataUrl})`;
      }
    }
    btn.addEventListener('click', () => openMilestoneModal(key));
    calGrid.appendChild(btn);
  }
}

calPrev.addEventListener('click', () => {
  let year = currentCalYear;
  let month = currentCalMonth - 1;
  if (month < 0) { month = 11; year -= 1; }
  if (!isMonthInBounds(year, month)) return;
  currentCalYear = year;
  currentCalMonth = month;
  loadMonth(year, month);
});

calNext.addEventListener('click', () => {
  let year = currentCalYear;
  let month = currentCalMonth + 1;
  if (month > 11) { month = 0; year += 1; }
  if (!isMonthInBounds(year, month)) return;
  currentCalYear = year;
  currentCalMonth = month;
  loadMonth(year, month);
});

function openMilestoneModal(dateKey) {
  editingDateKey = dateKey;
  pendingPhotoDataUrl = null;
  const entry = currentMonthMilestones.get(dateKey);
  const [y, m, d] = dateKey.split('-').map(Number);
  milestoneModalTitle.textContent = new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  milestoneCaption.value = entry?.caption || '';
  if (entry?.photoDataUrl) {
    milestonePhotoPreview.src = entry.photoDataUrl;
    milestonePhotoPreview.hidden = false;
  } else {
    milestonePhotoPreview.hidden = true;
    milestonePhotoPreview.src = '';
  }
  milestoneDelete.hidden = !entry;
  milestonePhotoInput.value = '';
  milestoneModal.hidden = false;
}

milestonePhotoBtn.addEventListener('click', () => milestonePhotoInput.click());

milestonePhotoInput.addEventListener('change', () => {
  const file = milestonePhotoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1000;
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round(height * maxDim / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round(width * maxDim / height);
        height = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      pendingPhotoDataUrl = canvas.toDataURL('image/jpeg', 0.7);
      milestonePhotoPreview.src = pendingPhotoDataUrl;
      milestonePhotoPreview.hidden = false;
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

milestoneCancel.addEventListener('click', () => { milestoneModal.hidden = true; });

milestoneSave.addEventListener('click', async () => {
  const code = getHouseholdCode();
  if (!code || !editingDateKey) return;
  const caption = milestoneCaption.value.trim();
  const existing = currentMonthMilestones.get(editingDateKey);
  const photoDataUrl = pendingPhotoDataUrl || existing?.photoDataUrl || null;
  if (!caption && !photoDataUrl) {
    showToast('Add a photo or a note first');
    return;
  }
  try {
    await setDoc(doc(db, 'households', code, 'milestones', editingDateKey), {
      ...(photoDataUrl ? { photoDataUrl } : {}),
      ...(caption ? { caption } : {}),
      updatedAt: Date.now(),
    });
    showToast('Milestone saved');
    milestoneModal.hidden = true;
  } catch (e) {
    console.error(e);
    showToast('Could not save — photo may be too large, or check connection');
  }
});

milestoneDelete.addEventListener('click', async () => {
  const code = getHouseholdCode();
  if (!code || !editingDateKey) return;
  try {
    await deleteDoc(doc(db, 'households', code, 'milestones', editingDateKey));
    showToast('Milestone deleted');
    milestoneModal.hidden = true;
  } catch (e) {
    console.error(e);
    showToast('Could not delete');
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

function openLogModal(feed) {
  editingFeedId = feed ? feed.id : null;
  intervalOverridden = false;
  selectedMl = DEFAULT_ML;
  selectedIntervalHours = computeAutoIntervalHours(DEFAULT_ML);

  const baseTime = feed ? new Date(feed.timestamp) : new Date();
  feedDateInput.value = `${baseTime.getFullYear()}-${String(baseTime.getMonth() + 1).padStart(2, '0')}-${String(baseTime.getDate()).padStart(2, '0')}`;
  feedDateInput.max = todayDateString();
  updateDateLabel(feedDateInput, feedDateLabel);
  feedTimeInput.value = `${String(baseTime.getHours()).padStart(2, '0')}:${String(baseTime.getMinutes()).padStart(2, '0')}`;

  logModalTitle.textContent = feed ? 'Add amount' : 'Log a feed';
  logStart.hidden = !!feed;
  logConfirm.textContent = feed ? 'Save amount' : 'Log feed';

  logModal.hidden = false;
  scrollWheelTo(DEFAULT_ML);
  onAmountChanged(DEFAULT_ML);
  updateWheelActiveItem();
}

function updateDateLabel(input, label) {
  const val = input.value;
  if (!val || val === todayDateString()) {
    label.textContent = 'Today';
    return;
  }
  const [y, m, d] = val.split('-').map(Number);
  label.textContent = new Date(y, m - 1, d).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

feedDateInput.addEventListener('change', () => updateDateLabel(feedDateInput, feedDateLabel));

function combineDateTimeToTimestamp(dateStr, timeStr) {
  const now = new Date();
  const [y, mo, d] = (dateStr || todayDateString()).split('-').map(Number);
  let h = now.getHours();
  let mi = now.getMinutes();
  if (timeStr) {
    [h, mi] = timeStr.split(':').map(Number);
  }
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
}

function readModalTimestamp() {
  return combineDateTimeToTimestamp(feedDateInput.value, feedTimeInput.value);
}

btnStartFeedNow.addEventListener('click', () => {
  startFeed(Date.now(), computeAutoIntervalHours(DEFAULT_ML));
});

btnLogFeed.addEventListener('click', () => openLogModal());
logCancel.addEventListener('click', () => { logModal.hidden = true; editingFeedId = null; });

logStart.addEventListener('click', () => {
  const timestamp = readModalTimestamp();
  logModal.hidden = true;
  startFeed(timestamp, selectedIntervalHours);
});

logConfirm.addEventListener('click', () => {
  const timestamp = readModalTimestamp();
  logModal.hidden = true;
  if (editingFeedId) {
    finishFeed(editingFeedId, timestamp, selectedMl, selectedIntervalHours);
    editingFeedId = null;
  } else {
    logFeed(timestamp, selectedMl, selectedIntervalHours);
  }
});

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

setInterval(() => { renderSinceLastFeed(); renderNextFeed(); renderTodayTotal(); renderSinceLastPoo(); renderProfileAge(); renderBottleStatus(); }, 15000);

renderTrendsChart();

const existingCode = getHouseholdCode();
if (existingCode) {
  enterApp(existingCode);
} else {
  setupScreen.hidden = false;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js?v=18').catch(() => {});
  });
}
