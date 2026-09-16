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
const ML_MIN = 10;
const ML_MAX = 300;
const ML_STEP_LOW = 5;
const ML_STEP_HIGH_THRESHOLD = 120;
const ML_STEP_HIGH = 10;
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
const bottlePillMain = document.getElementById('bottle-pill-main');
const bottlePillAdjust = document.getElementById('bottle-pill-adjust');
const bottleStatusEl = document.getElementById('bottle-status');
const bottleAdjustModal = document.getElementById('bottle-adjust-modal');
const bottleAdjustChips = document.getElementById('bottle-adjust-chips');
const bottleAdjustCancel = document.getElementById('bottle-adjust-cancel');
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
const logCancel = document.getElementById('log-cancel');
const logConfirm = document.getElementById('log-confirm');

const shareModal = document.getElementById('share-modal');
const btnShare = document.getElementById('btn-share');
const shareCodeEl = document.getElementById('share-code');
const shareClose = document.getElementById('share-close');

const confirmDeleteModal = document.getElementById('confirm-delete-modal');
const confirmDeleteCancel = document.getElementById('confirm-delete-cancel');
const confirmDeleteConfirm = document.getElementById('confirm-delete-confirm');

const appTitleEl = document.getElementById('app-title');
const homeTitleEl = document.getElementById('home-title');
const profileTileLabel = document.getElementById('profile-tile-label');
const profileTileIcon = document.getElementById('profile-tile-icon');
const profileIconBig = document.getElementById('profile-icon-big');
const avatarToneChips = document.getElementById('avatar-tone-chips');
const profileNameInput = document.getElementById('profile-name');
const profileDobInput = document.getElementById('profile-dob');
const profileAgeEl = document.getElementById('profile-age');
const profileSaveBtn = document.getElementById('profile-save');

const trendsChartMilkByWeightEl = document.getElementById('trends-chart-milk-by-weight');
const trendsChartMilkEl = document.getElementById('trends-chart-milk');
const trendsChartBabyEl = document.getElementById('trends-chart-baby');
const trendsSummaryEl = document.getElementById('trends-summary');
const trendsLegendNameEl = document.getElementById('trends-legend-name');
const trendsDobHintEl = document.getElementById('trends-dob-hint');
const trendsFunFactEl = document.getElementById('trends-fun-fact');

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
let currentRange = '1d';
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
let pendingDeleteFeedId = null;

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
    const babyTitleName = data.name || 'Charlie';
    const possessive = babyTitleName + (babyTitleName.endsWith('s') ? '’' : '’s');
    appTitleEl.textContent = `${possessive} First Year`;
    homeTitleEl.textContent = `${possessive} First Year`;
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
  const now = new Date();
  if (dob.getTime() > now.getTime()) return '';

  const diffDays = Math.floor((now.getTime() - dob.getTime()) / 86400000);

  // Stay in weeks through the first 8 weeks regardless of calendar month
  // length, then switch to months — otherwise a baby born in a 31-day month
  // could flip to "1 month" a few days before a clean "5 weeks old" mark.
  if (diffDays >= 56) {
    // Exact calendar months: find the largest N where dob + N months hasn't
    // passed `now` yet, using the Date constructor's native month rollover
    // (handles e.g. 31st-of-the-month births against shorter months safely).
    let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
    let anchor = new Date(dob.getFullYear(), dob.getMonth() + months, dob.getDate());
    while (anchor.getTime() > now.getTime() && months > 0) {
      months -= 1;
      anchor = new Date(dob.getFullYear(), dob.getMonth() + months, dob.getDate());
    }
    const days = Math.round((now.getTime() - anchor.getTime()) / 86400000);
    return `${months} month${months !== 1 ? 's' : ''}${days > 0 ? `, ${days}d` : ''} old`;
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
  if (last.amountMl == null) {
    nextFeedTimeEl.textContent = 'TBC';
    return;
  }
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

async function startBottleTimer(minsAgo) {
  const code = getHouseholdCode();
  if (!code) return;
  try {
    await setDoc(bottleDocRef(code), { madeAt: Date.now() - minsAgo * 60000 }, { merge: true });
    showToast(minsAgo > 0 ? `Bottle timer started (${minsAgo}m ago)` : 'Bottle timer started');
  } catch (e) {
    console.error(e);
    showToast('Could not save — check connection');
  }
}

bottlePillMain.addEventListener('click', () => startBottleTimer(0));

bottlePillAdjust.addEventListener('click', () => { bottleAdjustModal.hidden = false; });
bottleAdjustCancel.addEventListener('click', () => { bottleAdjustModal.hidden = true; });
bottleAdjustChips.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    bottleAdjustModal.hidden = true;
    startBottleTimer(Number(chip.dataset.mins));
  });
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
      li.addEventListener('click', () => openLogModal(feed));
      li.querySelector('.history-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        openConfirmDeleteModal(feed.id);
      });
      li.querySelector('.add-amount-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openLogModal(feed);
      });
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
    return;
  }
  // The prepared bottle is now in use — its "good for 2 hours" timer no longer applies.
  try {
    await setDoc(bottleDocRef(code), { madeAt: null }, { merge: true });
  } catch (e) {
    console.error(e);
  }
}

async function finishFeed(id, timestamp, amountMl, intervalHours) {
  const code = getHouseholdCode();
  if (!code) return;
  try {
    await updateDoc(doc(db, 'households', code, 'feeds', id), { timestamp, amountMl, intervalHours });
    showToast('Feed updated');
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

function openConfirmDeleteModal(feedId) {
  pendingDeleteFeedId = feedId;
  confirmDeleteModal.hidden = false;
}

confirmDeleteCancel.addEventListener('click', () => {
  confirmDeleteModal.hidden = true;
  pendingDeleteFeedId = null;
});

confirmDeleteConfirm.addEventListener('click', () => {
  confirmDeleteModal.hidden = true;
  if (pendingDeleteFeedId) deleteFeed(pendingDeleteFeedId);
  pendingDeleteFeedId = null;
});

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

const FUN_BABY_FACTS = [
  'Newborns blink far less often than adults — about once or twice a minute, compared to 15-20 times for grown-ups.',
  "Babies are born with about 300 bones, but adults only have 206 — many fuse together as they grow.",
  "A baby's sense of smell is so strong they can recognize their mother's scent within days of being born.",
  "Newborns can't produce tears when they cry until they're about 1-3 months old.",
  "Babies are born without kneecaps — they start as cartilage and harden into bone later.",
  "A baby's heart beats almost twice as fast as an adult's — around 120-160 beats per minute.",
  "Babies can recognize their mother's voice from inside the womb.",
  "Newborns are naturally short-sighted — they focus best on things 8-12 inches away, about the distance to a parent's face while feeding.",
  "Babies can't properly taste salt until they're about 4 months old.",
  "A baby's brain reaches about 80% of its adult size by age 3.",
  'Babies have more taste buds than adults, including some on the roof of the mouth and back of the throat.',
  'Newborns sleep 16-17 hours a day on average, just in short bursts rather than one long stretch.',
  'Babies are born with a natural reflex to hold their breath underwater, which fades by around 6 months.',
  "A baby's skull has soft spots (fontanelles) that help them through the birth canal and allow rapid brain growth.",
  "Babies can't feel embarrassment — that emotion doesn't develop until around age 2.",
  'Newborns typically lose 5-10% of their birth weight in the first few days before starting to gain it back.',
  "Babies have a strong grasp reflex — strong enough that some can briefly support their own weight gripping a finger.",
  "A baby's hearing is fully developed before birth — they can hear sounds from around 18 weeks in the womb.",
  'Babies are not great at regulating their own body heat yet, which is part of why swaddling and warm layers help.',
  'The average baby triples their birth weight by their first birthday.',
  'Babies produce about twice as much saliva as adults relative to their size, especially once teething starts.',
  "A baby's eye color can keep changing for up to a year after birth as pigment develops.",
];

function weeklyFunFact() {
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  const weekIndex = Math.floor(daysSinceEpoch / 7);
  return FUN_BABY_FACTS[weekIndex % FUN_BABY_FACTS.length];
}

function renderFunFact() {
  if (!trendsFunFactEl) return;
  trendsFunFactEl.textContent = weeklyFunFact();
}

// Illustrative general guidelines (approximate typical values by age in months),
// not medical advice and not specific to sex. Linearly interpolated between points.
const WORLD_AVG_ML_BY_MONTH = [
  { month: 0, ml: 350 },
  { month: 1, ml: 700 },
  { month: 2, ml: 800 },
  { month: 3, ml: 850 },
  { month: 4, ml: 900 },
  { month: 5, ml: 900 },
  { month: 6, ml: 900 },
  { month: 7, ml: 880 },
  { month: 8, ml: 860 },
  { month: 9, ml: 840 },
  { month: 10, ml: 820 },
  { month: 11, ml: 800 },
  { month: 12, ml: 780 },
];

const WORLD_AVG_WEIGHT_KG_BY_MONTH = [
  { month: 0, kg: 3.3 },
  { month: 1, kg: 4.2 },
  { month: 2, kg: 5.1 },
  { month: 3, kg: 5.8 },
  { month: 4, kg: 6.4 },
  { month: 5, kg: 6.9 },
  { month: 6, kg: 7.3 },
  { month: 7, kg: 7.6 },
  { month: 8, kg: 7.9 },
  { month: 9, kg: 8.2 },
  { month: 10, kg: 8.5 },
  { month: 11, kg: 8.7 },
  { month: 12, kg: 8.9 },
];

function interpolateAtMonth(table, month, key) {
  if (month <= table[0].month) return table[0][key];
  if (month >= table[table.length - 1].month) return table[table.length - 1][key];
  for (let i = 0; i < table.length - 1; i++) {
    if (month >= table[i].month && month <= table[i + 1].month) {
      const t = (month - table[i].month) / (table[i + 1].month - table[i].month);
      return table[i][key] + t * (table[i + 1][key] - table[i][key]);
    }
  }
  return table[table.length - 1][key];
}

const MONTH_MS = 30.44 * 86400000;

function computeBabyMonthlyAverages() {
  if (!profileDob) return [];
  const [y, m, d] = profileDob.split('-').map(Number);
  const dobTs = new Date(y, m - 1, d).getTime();

  const totals = new Map();
  for (const f of latestFeeds) {
    if (f.amountMl == null) continue;
    const monthIndex = Math.floor((f.timestamp - dobTs) / MONTH_MS);
    if (monthIndex < 0) continue;
    totals.set(monthIndex, (totals.get(monthIndex) || 0) + f.amountMl);
  }

  const now = Date.now();
  const points = [];
  for (const [monthIndex, total] of totals) {
    const monthStart = dobTs + monthIndex * MONTH_MS;
    const monthEnd = monthStart + MONTH_MS;
    const elapsedDays = inclusiveCalendarDays(monthStart, Math.min(now, monthEnd));
    points.push({ month: monthIndex, ml: total / elapsedDays });
  }
  points.sort((a, b) => a.month - b.month);
  return points;
}

// Counts calendar dates touched from startMs through endMs, inclusive — e.g. a baby
// born Monday morning and it's now Wednesday afternoon has fed across 3 calendar
// dates (Mon/Tue/Wed), not the ~2.x raw elapsed days between the two timestamps.
function inclusiveCalendarDays(startMs, endMs) {
  const startDay = new Date(startMs);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(endMs);
  endDay.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / 86400000) + 1);
}

function ageRefPoints(table, key) {
  const pts = [];
  for (let mo = 0; mo <= 12; mo++) pts.push({ x: mo, y: interpolateAtMonth(table, mo, key) });
  return pts;
}

function weightMilkRefPoints() {
  const pts = [];
  for (let mo = 0; mo <= 12; mo += 0.25) {
    pts.push({
      x: interpolateAtMonth(WORLD_AVG_WEIGHT_KG_BY_MONTH, mo, 'kg'),
      y: interpolateAtMonth(WORLD_AVG_ML_BY_MONTH, mo, 'ml'),
    });
  }
  return pts;
}

function buildLineChartSvg({ refPoints, babyPoints, xMin = 0, xMax, yMax, yGridValues, yTickFormat, xTicks, xTickFormat, showRef = true }) {
  const width = 300;
  const height = 170;
  const padLeft = 34;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 20;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const x = (val) => padLeft + ((Math.min(Math.max(val, xMin), xMax) - xMin) / (xMax - xMin)) * plotW;
  const y = (val) => padTop + plotH - (Math.min(val, yMax) / yMax) * plotH;

  const gridLines = yGridValues.map(val => `
    <line x1="${padLeft}" y1="${y(val)}" x2="${width - padRight}" y2="${y(val)}" stroke="var(--border)" stroke-width="1" />
    <text x="${padLeft - 5}" y="${y(val) + 3}" text-anchor="end" font-size="8" fill="var(--muted)">${yTickFormat(val)}</text>
  `).join('');

  const xLabels = xTicks.map(t => `
    <text x="${x(t)}" y="${height - 4}" text-anchor="middle" font-size="8" fill="var(--muted)">${xTickFormat(t)}</text>
  `).join('');

  const refLine = showRef && refPoints
    ? `<polyline points="${refPoints.map(p => `${x(p.x)},${y(p.y)}`).join(' ')}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4,3" />`
    : '';
  const babyPolyline = babyPoints && babyPoints.length > 1
    ? `<polyline points="${babyPoints.map(p => `${x(p.x)},${y(p.y)}`).join(' ')}" fill="none" stroke="var(--primary)" stroke-width="2.5" />`
    : '';
  const babyDots = babyPoints
    ? babyPoints.map(p => `<circle cx="${x(p.x)}" cy="${y(p.y)}" r="2.8" fill="var(--primary)" />`).join('')
    : '';

  return `
    <svg viewBox="0 0 ${width} ${height}" class="trends-svg">
      ${gridLines}
      ${xLabels}
      ${refLine}
      ${babyPolyline}
      ${babyDots}
    </svg>
  `;
}

function comparisonPhrase(babyAvg, worldAvg) {
  const diffPct = ((babyAvg - worldAvg) / worldAvg) * 100;
  if (Math.abs(diffPct) < 10) return 'about the same as';
  if (diffPct >= 25) return 'quite a bit more than';
  if (diffPct >= 10) return 'a little more than';
  if (diffPct <= -25) return 'quite a bit less than';
  return 'a little less than';
}

function renderTrendsChart() {
  if (!trendsChartMilkByWeightEl) return;

  trendsChartMilkByWeightEl.innerHTML = buildLineChartSvg({
    refPoints: weightMilkRefPoints(),
    xMin: 3,
    xMax: 9,
    yMax: 1100,
    yGridValues: [0, 300, 600, 900],
    yTickFormat: (v) => `${v}`,
    xTicks: [3, 5, 7, 9],
    xTickFormat: (v) => `${v}kg`,
  });

  trendsChartMilkEl.innerHTML = buildLineChartSvg({
    refPoints: ageRefPoints(WORLD_AVG_ML_BY_MONTH, 'ml'),
    xMax: 12,
    yMax: 1100,
    yGridValues: [0, 300, 600, 900],
    yTickFormat: (v) => `${v}`,
    xTicks: [0, 3, 6, 9, 12],
    xTickFormat: (mo) => (mo === 0 ? 'Birth' : mo + 'mo'),
  });

  trendsDobHintEl.hidden = !!profileDob;
  const babyPoints = computeBabyMonthlyAverages().map(p => ({ x: p.month, y: p.ml }));
  trendsChartBabyEl.innerHTML = buildLineChartSvg({
    babyPoints,
    xMax: 12,
    yMax: 1100,
    yGridValues: [0, 300, 600, 900],
    yTickFormat: (v) => `${v}`,
    xTicks: [0, 3, 6, 9, 12],
    xTickFormat: (mo) => (mo === 0 ? 'Birth' : mo + 'mo'),
    showRef: false,
  });

  if (babyPoints.length > 0) {
    const latest = babyPoints[babyPoints.length - 1];
    const worldAtLatest = interpolateAtMonth(WORLD_AVG_ML_BY_MONTH, latest.x, 'ml');
    const babyAvg = latest.y;
    const name = trendsLegendNameEl.textContent || 'Your baby';
    const phrase = comparisonPhrase(babyAvg, worldAtLatest);
    trendsSummaryEl.textContent = `${name} is averaging about ${Math.round(babyAvg)}ml/day this month — ${phrase} the ${Math.round(worldAtLatest)}ml/day average for babies around this age. This is just a general average though — every baby is different, so there's no need to worry if yours doesn't match.`;
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
    if (key === profileDob) btn.classList.add('birthday');
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
for (let v = ML_MIN; v <= ML_MAX; v += (v < ML_STEP_HIGH_THRESHOLD ? ML_STEP_LOW : ML_STEP_HIGH)) wheelValues.push(v);

wheelValues.forEach((v) => {
  const item = document.createElement('div');
  item.className = 'wheel-item';
  item.textContent = `${v}ml`;
  item.dataset.value = v;
  mlWheelTrack.appendChild(item);
});

function wheelIndexForValue(v) {
  return wheelValues.indexOf(v);
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
  const isPending = !!feed && feed.amountMl == null;
  const startMl = feed?.amountMl ?? DEFAULT_ML;

  intervalOverridden = !!feed && !isPending;
  selectedMl = startMl;
  selectedIntervalHours = feed?.intervalHours || computeAutoIntervalHours(startMl);

  const baseTime = feed ? new Date(feed.timestamp) : new Date();
  feedDateInput.value = `${baseTime.getFullYear()}-${String(baseTime.getMonth() + 1).padStart(2, '0')}-${String(baseTime.getDate()).padStart(2, '0')}`;
  feedDateInput.max = todayDateString();
  updateDateLabel(feedDateInput, feedDateLabel);
  feedTimeInput.value = `${String(baseTime.getHours()).padStart(2, '0')}:${String(baseTime.getMinutes()).padStart(2, '0')}`;

  logModalTitle.textContent = isPending ? 'Add amount' : (feed ? 'Edit feed' : 'Log a feed');
  logConfirm.textContent = isPending ? 'Save amount' : (feed ? 'Save' : 'Log feed');

  logModal.hidden = false;
  scrollWheelTo(startMl);
  onAmountChanged(startMl);
  updateWheelActiveItem();
  highlightIntervalChip();
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
renderFunFact();

const existingCode = getHouseholdCode();
if (existingCode) {
  enterApp(existingCode);
} else {
  setupScreen.hidden = false;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js?v=35').catch(() => {});
  });
}
