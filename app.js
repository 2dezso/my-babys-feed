import { firebaseConfig } from './firebase-config.js';
import { analyse } from './patterns.js?v=74';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore, collection, addDoc, deleteDoc, doc, setDoc, updateDoc, deleteField,
  query, where, orderBy, limit, documentId, onSnapshot, enableIndexedDbPersistence,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
try { enableIndexedDbPersistence(db); } catch (e) { /* multiple tabs open, fine */ }

const STORAGE_KEY = 'babyfeed_household_code';
const DEFAULT_ML = 90;
const ML_MIN = 10;
const ML_MAX = 300;
const ML_STEP = 5;
const RULER_TICK_PX = 24;
const WHEEL_ITEM_HEIGHT = 40;
const INTERVAL_MIN = 1;
const INTERVAL_MAX = 8;
const INTERVAL_STEP = 0.5;
const BOTTLE_ADJUST_MAX_MINS = 120;
const BOTTLE_ADJUST_STEP_MINS = 5;

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
const pendingTimeEl = document.getElementById('pending-time');
const nextFeedLabelEl = document.getElementById('next-feed-label');
const heroLine = document.getElementById('hero-line');
const todayBottle = document.getElementById('today-bottle');
const tabbar = document.getElementById('tabbar');
const homeDateEl = document.getElementById('home-date');
const homeGreetEl = document.getElementById('home-greet');
const homeFeedWhen = document.getElementById('home-feed-when');
const homeFeedV = document.getElementById('home-feed-v');
const homeFeedS = document.getElementById('home-feed-s');
const homePooWhen = document.getElementById('home-poo-when');
const homePooV = document.getElementById('home-poo-v');
const homePooS = document.getElementById('home-poo-s');
const homeTrendV = document.getElementById('home-trend-v');
const homeTrendS = document.getElementById('home-trend-s');
const trendsSubEl = document.getElementById('trends-sub');
const sinceLastFeedEl = document.getElementById('since-last-feed');
const lastFeedDetailEl = document.getElementById('last-feed-detail');
const nextFeedTimeEl = document.getElementById('next-feed-time');
const nextFeedInEl = document.getElementById('next-feed-in');
const appDateEl = document.getElementById('app-date');
const bottlePill = document.getElementById('bottle-pill');
const bottlePillMain = document.getElementById('bottle-pill-main');
const bottlePillAdjust = document.getElementById('bottle-pill-adjust');
const bottlePillClear = document.getElementById('bottle-pill-clear');
const bottleStatusEl = document.getElementById('bottle-status');
const bottleTitleEl = document.getElementById('bottle-title');
const bottleAdjustModal = document.getElementById('bottle-adjust-modal');
const bottleAdjustWheelTrack = document.getElementById('bottle-adjust-wheel-track');
const bottleAdjustCancel = document.getElementById('bottle-adjust-cancel');
const bottleAdjustConfirm = document.getElementById('bottle-adjust-confirm');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const historyRange = document.getElementById('history-range');
const historyChart = document.getElementById('history-chart');
const historyChartToggle = document.getElementById('history-chart-toggle');
const historyChartScroll = document.getElementById('history-chart-scroll');
const historyChartSvg = document.getElementById('history-chart-svg');
const historyChartCaption = document.getElementById('history-chart-caption');
const chartStatEls = [1, 2, 3].map(n => ({
  value: document.getElementById(`chart-stat-${n}`),
  label: document.getElementById(`chart-stat-${n}-label`),
}));
const toast = document.getElementById('toast');

const btnStartFeedNow = document.getElementById('btn-start-feed-now');
const btnStartFeedSub = document.getElementById('btn-start-feed-sub');
const btnLogFeed = document.getElementById('btn-log-feed');
const logModal = document.getElementById('log-modal');
const logModalTitle = document.getElementById('log-modal-title');
const feedDateInput = document.getElementById('feed-date');
const feedDayChips = document.getElementById('feed-day-chips');
const feedTimeInput = document.getElementById('feed-time');
const sheetMlEl = document.getElementById('sheet-ml');
const mlRuler = document.getElementById('ml-ruler');
const mlTicks = document.getElementById('ml-ticks');
const sheetHint = document.getElementById('sheet-hint');
const sheetWhen = document.getElementById('sheet-when');
const sheetEarlier = document.getElementById('sheet-earlier');
const sheetFixed = document.getElementById('sheet-fixed');
const sheetFixedK = document.getElementById('sheet-fixed-k');
const sheetFixedV = document.getElementById('sheet-fixed-v');
const sheetFixedChange = document.getElementById('sheet-fixed-change');
const sheetGapEl = document.getElementById('sheet-gap');
const sheetAtEl = document.getElementById('sheet-at');
const gapLess = document.getElementById('gap-less');
const gapMore = document.getElementById('gap-more');
const sheetDel = document.getElementById('sheet-del');
const logCancel = document.getElementById('log-cancel');
const logConfirm = document.getElementById('log-confirm');

const shareModal = document.getElementById('share-modal');
const btnShare = document.getElementById('btn-share');
const shareCodeEl = document.getElementById('share-code');
const shareClose = document.getElementById('share-close');

const installModal = document.getElementById('install-modal');
const btnInstallApp = document.getElementById('btn-install-app');
const installModalClose = document.getElementById('install-modal-close');

const confirmDeleteModal = document.getElementById('confirm-delete-modal');
const confirmDeleteCancel = document.getElementById('confirm-delete-cancel');
const confirmDeleteConfirm = document.getElementById('confirm-delete-confirm');

const feedbackFab = document.getElementById('feedback-fab');
const feedbackModal = document.getElementById('feedback-modal');
const feedbackTypeChips = document.getElementById('feedback-type-chips');
const feedbackMessage = document.getElementById('feedback-message');
const feedbackCancel = document.getElementById('feedback-cancel');
const feedbackSend = document.getElementById('feedback-send');

const homeTitleEl = document.getElementById('home-title');
const profileTileLabel = document.getElementById('profile-tile-label');
const profileTileIcon = document.getElementById('profile-tile-icon');
const profileIconBig = document.getElementById('profile-icon-big');
const avatarToneChips = document.getElementById('avatar-tone-chips');
const profileNameInput = document.getElementById('profile-name');
const profileLastNameInput = document.getElementById('profile-last-name');
const profileDobInput = document.getElementById('profile-dob');
const genderChips = document.getElementById('gender-chips');
const profileAgeEl = document.getElementById('profile-age');
const profileSaveBtn = document.getElementById('profile-save');
const profileSkipBtn = document.getElementById('profile-skip');
const profileWelcome = document.getElementById('profile-welcome');
const profileNamePreview = document.getElementById('profile-name-preview');

const trendsPatternsEl = document.getElementById('trends-patterns');
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
const pooDateEl = document.getElementById('poo-header-date');
const pooTodayCountEl = document.getElementById('poo-today-count');
const pooAvgGapEl = document.getElementById('poo-avg-gap');
const pooWeekCols = document.getElementById('poo-week-cols');
const pooWeekTotal = document.getElementById('poo-week-total');
const pooWeekNote = document.getElementById('poo-week-note');
const btnLogPoo = document.getElementById('btn-log-poo');
const pooHistoryList = document.getElementById('poo-history-list');
const pooHistoryEmpty = document.getElementById('poo-history-empty');
const pooHistoryRange = document.getElementById('poo-history-range');
const pooTimeModal = document.getElementById('poo-time-modal');
const pooTimeModalTitle = document.getElementById('poo-time-modal-title');
const pooDateInput = document.getElementById('poo-date');
const pooDayChips = document.getElementById('poo-day-chips');
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
let chartGroup = 'week';
let chartSelectedStart = null;
let currentPooRange = '1d';
let selectedAvatarTone = '';
let selectedGender = '';
let profileOnboarding = false;
let profileDob = '';
let profileFirstName = '';
let selectedPooSize = '';
let bottleMadeAt = null;
let bottleFeedStartedAt = null;
let selectedBottleMinsAgo = 0;
let calendarInitialized = false;
let currentCalYear = 0;
let currentCalMonth = 0;
let currentMonthMilestones = new Map();
let currentMonthUnsub = null;
let editingDateKey = null;
let pendingPhotoDataUrl = null;
let bottleAdjustWheelScrollTimer = null;
let editingFeedId = null;
let pendingDeleteFeedId = null;
let editingPooId = null;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function rangeCutoff(range) {
  if (range === '14d') return Date.now() - 14 * 24 * 60 * 60 * 1000;
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

function feedbackCollection(code) {
  return collection(db, 'households', code, 'feedback');
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

const TAB_SECTION = { feed: 's-feed', home: 's-feed', poo: 's-nappy', milestones: 's-mile', trends: 's-trend' };

function showScreen(name) {
  if (!(name in SCREENS)) name = 'feed';
  Object.values(SCREENS).forEach(el => { el.hidden = true; });
  SCREENS[name].hidden = false;
  feedbackFab.hidden = name !== 'home';
  tabbar.hidden = !(name in TAB_SECTION);
  tabbar.className = `tabs ${TAB_SECTION[name] || 's-feed'}`;
  tabbar.querySelectorAll('.tab').forEach(t => {
    if (t.dataset.nav === name) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

function applyRouteFromHash() {
  const name = (location.hash || '').slice(1);
  if (profileOnboarding && name !== 'profile') setProfileOnboarding(false);
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
    renderTrends();
    renderHome();
  }, (err) => {
    console.error(err);
    showToast('Sync error — check connection');
  });
}

function listenToProfile(code) {
  onSnapshot(profileDocRef(code), (snap) => {
    const data = snap.data() || {};
    const firstName = data.firstName || data.name || '';
    profileNameInput.value = firstName;
    profileLastNameInput.value = data.lastName || '';
    profileDobInput.value = data.dob || '';
    profileDob = data.dob || '';
    selectedAvatarTone = data.avatarTone || '';
    selectedGender = data.gender || '';
    profileTileLabel.textContent = firstName ? `${firstName}'s profile` : 'Profile';
    profileFirstName = firstName;
    const babyTitleName = firstName || 'Charlie';
    homeTitleEl.textContent = babyTitleName;
    document.title = `${babyTitleName}'s First Year`;
    const initial = babyTitleName.charAt(0).toUpperCase();
    document.querySelectorAll('.me:not(.back)').forEach(el => { el.textContent = initial; });
    document.body.classList.toggle('gender-pink', selectedGender === 'female');
    updateAvatarIcons();
    highlightToneChip();
    highlightGenderChip();
    renderProfileAge();
    renderProfilePreview();
    renderTrends();
    renderHome();
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

function highlightGenderChip() {
  genderChips.querySelectorAll('.gender-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.gender === selectedGender);
  });
}

genderChips.querySelectorAll('.gender-card').forEach(chip => {
  chip.addEventListener('click', () => {
    selectedGender = selectedGender === chip.dataset.gender ? '' : chip.dataset.gender;
    highlightGenderChip();
    document.body.classList.toggle('gender-pink', selectedGender === 'female');
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

function renderProfilePreview() {
  const fullName = [profileNameInput.value.trim(), profileLastNameInput.value.trim()].filter(Boolean).join(' ');
  profileNamePreview.textContent = fullName || 'Your baby';
}

function setProfileOnboarding(on) {
  profileOnboarding = on;
  profileWelcome.hidden = !on;
  profileSkipBtn.hidden = !on;
  profileSaveBtn.textContent = on ? 'Save and continue' : 'Save profile';
}

function finishProfileOnboarding() {
  setProfileOnboarding(false);
  goTo('feed');
  shareCodeEl.textContent = getHouseholdCode();
  shareModal.hidden = false;
}

function listenToPoos(code) {
  const q = query(poosCollection(code), orderBy('timestamp', 'desc'), limit(500));
  onSnapshot(q, (snapshot) => {
    latestPoos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSinceLastPoo();
    renderPooStats();
    renderPooHistory();
    renderHome();
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
  lastPooDetailEl.textContent = `ago · ${last.size ? `${last.size.toLowerCase()}, ` : ''}at ${formatClock(last.timestamp)}`;
}

// A day with this many poos fills its bar; anything above is clipped.
const POO_WEEK_MAX_BAR = 5;

function renderPooStats() {
  const today = startOfToday();
  const todayCount = latestPoos.filter(p => p.timestamp >= today).length;
  pooTodayCountEl.textContent = todayCount === 1 ? '1 poo' : `${todayCount} poos`;

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = latestPoos.filter(p => p.timestamp >= weekAgo);
  pooAvgGapEl.textContent = recent.length < 2
    ? '—'
    : durationString((recent[0].timestamp - recent[recent.length - 1].timestamp) / (recent.length - 1));

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date(today);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const count = latestPoos.filter(p => p.timestamp >= start.getTime() && p.timestamp < end.getTime()).length;
    days.push({ start, count, isToday: i === 0 });
  }

  pooWeekCols.innerHTML = '';
  for (const day of days) {
    const col = document.createElement('div');
    col.className = `wcol${day.isToday ? ' today' : ''}`;
    const bar = document.createElement('i');
    if (day.count === 0) bar.className = 'zero';
    else bar.style.height = `${Math.min(100, day.count / POO_WEEK_MAX_BAR * 100)}%`;
    const label = document.createElement('span');
    label.textContent = day.start.toLocaleDateString([], { weekday: 'narrow' });
    col.title = `${day.start.toLocaleDateString([], { weekday: 'long' })}: ${day.count}`;
    col.append(bar, label);
    pooWeekCols.appendChild(col);
  }

  const total = days.reduce((sum, d) => sum + d.count, 0);
  pooWeekTotal.textContent = total === 1 ? '1 poo' : `${total} poos`;

  const missed = days.filter(d => !d.isToday && d.count === 0)
    .map(d => d.start.toLocaleDateString([], { weekday: 'long' }));
  pooWeekNote.hidden = missed.length === 0;
  if (missed.length === 1) pooWeekNote.textContent = `No poo on ${missed[0]}`;
  else if (missed.length > 1) pooWeekNote.textContent = `No poo on ${missed.slice(0, -1).join(', ')} or ${missed[missed.length - 1]}`;
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

  const groups = new Map();
  for (const poo of filtered) {
    const key = dayKeyForTimestamp(poo.timestamp);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(poo);
  }

  for (const key of Array.from(groups.keys()).sort((a, b) => b - a)) {
    const dayPoos = groups.get(key);

    const headerLi = document.createElement('li');
    headerLi.className = 'day-group-header';
    headerLi.innerHTML = `<span class="day-group-label">${dayLabelForKey(key)}</span><span class="day-group-total">${dayPoos.length === 1 ? '1 poo' : `${dayPoos.length} poos`}</span>`;
    pooHistoryList.appendChild(headerLi);

    for (const poo of dayPoos) {
      const fullIndex = latestPoos.indexOf(poo);
      const older = latestPoos[fullIndex + 1];
      const gap = older ? durationString(poo.timestamp - older.timestamp) : '—';

      const li = document.createElement('li');
      if (poo.note) li.className = 'has-note';
      li.innerHTML = `
        <span class="history-time-val">${formatClock(poo.timestamp)}</span>
        ${poo.size ? `<span class="poo-size-tag">${escapeHtml(poo.size)}</span>` : '<span></span>'}
        <span class="history-gap-val">${gap}</span>
        <button class="history-delete" title="Delete" aria-label="Delete">✕</button>
        ${poo.note ? `<span class="poo-note-row">${escapeHtml(poo.note)}</span>` : ''}
      `;
      li.addEventListener('click', () => openPooTimeModal(poo));
      li.querySelector('.history-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deletePoo(poo.id);
      });
      pooHistoryList.appendChild(li);
    }
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

async function updatePoo(id, timestamp, size, note) {
  const code = getHouseholdCode();
  if (!code) return;
  try {
    await updateDoc(doc(db, 'households', code, 'poos', id), {
      timestamp,
      size: size || deleteField(),
      note: note || deleteField(),
    });
    showToast('Poo updated');
  } catch (e) {
    console.error(e);
    showToast('Could not save — check connection');
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

function openPooTimeModal(poo) {
  editingPooId = poo ? poo.id : null;
  const baseTime = poo ? new Date(poo.timestamp) : new Date();
  pooDateInput.value = `${baseTime.getFullYear()}-${String(baseTime.getMonth() + 1).padStart(2, '0')}-${String(baseTime.getDate()).padStart(2, '0')}`;
  pooDateInput.max = todayDateString();
  syncDayChips(pooDateInput, pooDayChips);
  pooTimeInput.value = `${String(baseTime.getHours()).padStart(2, '0')}:${String(baseTime.getMinutes()).padStart(2, '0')}`;
  selectedPooSize = poo?.size || '';
  highlightPooSizeChip();
  pooNoteInput.value = poo?.note || '';
  pooTimeModalTitle.textContent = poo ? 'Edit poo' : 'Log poo';
  pooTimeConfirm.textContent = poo ? 'Save' : 'Log poo';
  pooTimeModal.hidden = false;
}

btnLogPoo.addEventListener('click', () => openPooTimeModal());

pooTimeCancel.addEventListener('click', () => { pooTimeModal.hidden = true; editingPooId = null; });

pooTimeConfirm.addEventListener('click', () => {
  const timestamp = combineDateTimeToTimestamp(pooDateInput.value, pooTimeInput.value);
  const note = pooNoteInput.value.trim();
  showRangeContaining(timestamp, pooHistoryRange, ["1d", "7d"], (r) => { currentPooRange = r; });
  pooTimeModal.hidden = true;
  if (editingPooId) {
    updatePoo(editingPooId, timestamp, selectedPooSize, note);
    editingPooId = null;
  } else {
    logPoo(timestamp, selectedPooSize, note);
  }
});

// A past entry older than the tab being viewed would save but vanish from the list, so
// move to the first tab wide enough to show it.
function showRangeContaining(ts, segmentedEl, order, setRange) {
  const buttons = Array.from(segmentedEl.querySelectorAll(".segment"));
  const active = buttons.find(b => b.classList.contains("active"));
  if (!active || active.dataset.range === "all") return;
  if (ts >= rangeCutoff(active.dataset.range)) return;
  const target = order.find(r => buttons.some(b => b.dataset.range === r) && ts >= rangeCutoff(r));
  if (!target) return;
  setRange(target);
  buttons.forEach(b => b.classList.toggle("active", b.dataset.range === target));
  renderHistory();
  renderPooHistory();
}

function updateFeedActionButtons(isPending) {
  // Both buttons stay where they are: Log past is only dimmed and switched off while a feed is running.
  btnLogFeed.disabled = isPending;
  btnStartFeedNow.classList.toggle('pending', isPending);
  btnStartFeedSub.textContent = isPending && latestFeeds[0] ? `Feeding for ${durationString(Date.now() - latestFeeds[0].timestamp)}` : '';
}

function renderSinceLastFeed() {
  const last = latestFeeds[0];
  const isPending = !!last && last.amountMl == null;
  heroCard.classList.toggle('hero-pending', isPending);
  updateFeedActionButtons(isPending);
  if (!last) {
    sinceLastFeedEl.textContent = '—';
    lastFeedDetailEl.textContent = 'No feeds yet';
    return;
  }
  const since = durationString(Date.now() - last.timestamp);
  if (isPending) {
    pendingTimeEl.textContent = since;
  } else {
    sinceLastFeedEl.textContent = since;
    lastFeedDetailEl.textContent = `ago · ${last.amountMl}ml`;
  }
}

heroCard.addEventListener('click', () => {
  if (latestFeeds.length && latestFeeds[0].amountMl == null) {
    openLogModal(latestFeeds[0]);
  }
});

// The next feed is a guess, so a late feed is never "overdue": the pill and line turn amber and say how long ago it was expected.
function renderNextFeed() {
  const last = latestFeeds[0];
  nextFeedLabelEl.textContent = 'Next feed';
  nextFeedInEl.classList.remove('late');
  heroLine.classList.remove('late');
  if (!last || last.amountMl == null) {
    heroLine.hidden = true;
    nextFeedTimeEl.textContent = '—';
    nextFeedInEl.hidden = true;
    return;
  }
  const now = Date.now();
  const intervalMs = (last.intervalHours || 3) * 60 * 60 * 1000;
  const nextTs = last.timestamp + intervalMs;
  const late = now > nextTs;
  const diffMs = Math.abs(nextTs - now);

  nextFeedTimeEl.textContent = formatClock(nextTs);
  nextFeedInEl.hidden = false;
  if (diffMs < 60000) {
    nextFeedInEl.textContent = 'now';
  } else if (late) {
    nextFeedInEl.classList.add('late');
    heroLine.classList.add('late');
    nextFeedLabelEl.textContent = 'Expected';
    nextFeedInEl.textContent = `${durationString(diffMs)} ago`;
  } else {
    nextFeedInEl.textContent = `in ${durationString(diffMs)}`;
  }
  // The bar fills from the last feed to the next one. Once late it stays full.
  const share = late ? 1 : Math.max(0, (now - last.timestamp) / intervalMs);
  heroLine.hidden = false;
  heroLine.style.setProperty('--p', share.toFixed(4));
}

// What a normal day adds up to, from the last week of finished days. Only used to scale the bottle picture.
function usualDailyMl() {
  const today = startOfToday();
  const days = Array.from(dailyFeedTotals().entries())
    .filter(([day]) => day < today && day >= today - 7 * 86400000)
    .map(([, t]) => t.total);
  return days.length ? days.reduce((s, v) => s + v, 0) / days.length : 0;
}

// Today's total is shown at the top of the Past feeds list; here it only sets how full the hero bottle is.
function renderTodayTotal() {
  const today = startOfToday();
  const total = latestFeeds.filter(f => f.timestamp >= today).reduce((sum, f) => sum + (f.amountMl || 0), 0);
  // The bottle starts the day empty and fills a little with every finished feed.
  const usual = usualDailyMl() || 8 * (lastCompletedAmount() || DEFAULT_ML);
  const fill = Math.max(0, Math.min(1, total / usual));
  todayBottle.style.setProperty('--fill', fill.toFixed(3));
  todayBottle.setAttribute('aria-label', `Today's milk so far: ${total}ml, about ${Math.round(fill * 100)}% of a usual day`);
}

function renderHeaderDate() {
  const label = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  appDateEl.textContent = label;
  pooDateEl.textContent = label;
  homeDateEl.textContent = label;
}

// "Today" screen: one summary per section, each leading with the most useful number.
function renderHome() {
  const name = profileFirstName || 'Charlie';
  const today = startOfToday();
  const todayFeeds = latestFeeds.filter(f => f.timestamp >= today && f.amountMl != null);
  const todayPoos = latestPoos.filter(p => p.timestamp >= today);
  const total = todayFeeds.reduce((sum, f) => sum + f.amountMl, 0);

  const parts = [];
  if (profileDob) parts.push(`${name} is ${ageString(profileDob).replace(/ old$/, '')} old.`);
  parts.push(`<b>${todayFeeds.length} ${todayFeeds.length === 1 ? 'feed' : 'feeds'}</b> and <b>${todayPoos.length} ${todayPoos.length === 1 ? 'nappy' : 'nappies'}</b> so far today.`);
  homeGreetEl.innerHTML = parts.join(' ');

  const last = latestFeeds[0];
  if (!last) {
    homeFeedWhen.textContent = '';
    homeFeedV.textContent = 'No feeds yet';
    homeFeedS.textContent = 'Tap to log the first one';
  } else if (last.amountMl == null) {
    homeFeedWhen.textContent = formatClock(last.timestamp);
    homeFeedV.innerHTML = `${durationString(Date.now() - last.timestamp)} <span>feeding now</span>`;
    homeFeedS.textContent = 'Amount still to add';
  } else {
    const nextTs = last.timestamp + (last.intervalHours || 3) * 3600000;
    homeFeedWhen.textContent = formatClock(last.timestamp);
    homeFeedV.innerHTML = `${durationString(Date.now() - last.timestamp)} <span>since last</span>`;
    homeFeedS.textContent = `${Date.now() > nextTs ? 'Expected' : 'Next one around'} ${formatClock(nextTs)} · ${total}ml today`;
  }

  const lastPoo = latestPoos[0];
  homePooWhen.textContent = lastPoo ? formatClock(lastPoo.timestamp) : '';
  homePooV.innerHTML = `${todayPoos.length} <span>today</span>`;
  homePooS.textContent = lastPoo ? `Last one ${durationString(Date.now() - lastPoo.timestamp)} ago` : 'None logged yet';

  const r = analyse(latestFeeds);
  const summary = trendsSummary(r);
  homeTrendV.textContent = summary.headline;
  homeTrendS.textContent = summary.sub;
}

// A made bottle keeps for 2 hours. Once the baby starts drinking from it, it is good for 1 hour from that moment.
const BOTTLE_GOOD_FOR_MS = 2 * 60 * 60 * 1000;
const BOTTLE_IN_USE_MS = 60 * 60 * 1000;
// After the hour is up the reminder to discard stays for a while, then the row goes back to idle on its own.
const BOTTLE_IN_USE_NOTICE_MS = 30 * 60 * 1000;

function listenToBottle(code) {
  onSnapshot(bottleDocRef(code), (snap) => {
    const data = snap.data() || {};
    bottleMadeAt = data.madeAt || null;
    bottleFeedStartedAt = data.feedStartedAt || null;
    renderBottleStatus();
  }, (err) => {
    console.error(err);
  });
}

// Idle, the row shows a formula scoop. Once a timer is running the scoop turns into a small bottle whose
// level drains as the time runs out (--left goes from 1 to 0).
function renderBottleStatus() {
  const now = Date.now();
  const inUse = !bottleMadeAt && bottleFeedStartedAt && now - bottleFeedStartedAt < BOTTLE_IN_USE_MS + BOTTLE_IN_USE_NOTICE_MS;
  const timing = !!bottleMadeAt || !!inUse;
  bottlePillClear.hidden = !timing;
  bottlePillAdjust.hidden = timing;
  bottlePill.classList.toggle('timing', timing);
  bottlePill.classList.remove('bottle-expired');
  if (!timing) {
    bottleTitleEl.textContent = 'Made a bottle?';
    bottleStatusEl.textContent = 'Tap to start a 2 hour timer';
    bottlePill.style.setProperty('--left', '1');
    return;
  }
  const totalMs = inUse ? BOTTLE_IN_USE_MS : BOTTLE_GOOD_FOR_MS;
  const remaining = totalMs - (now - (inUse ? bottleFeedStartedAt : bottleMadeAt));
  bottlePill.style.setProperty('--left', Math.max(0, Math.min(1, remaining / totalMs)).toFixed(3));
  bottleTitleEl.textContent = inUse ? 'Bottle in use' : 'Bottle made';
  if (remaining <= 0) {
    bottleStatusEl.textContent = inUse ? 'Over 1h since the feed started. Discard what is left' : 'Over 2 hours old. Discard it';
    bottlePill.classList.add('bottle-expired');
  } else {
    bottleStatusEl.textContent = `Good for ${durationString(remaining)}`;
  }
}

async function startBottleTimer(minsAgo) {
  const code = getHouseholdCode();
  if (!code) return;
  try {
    await setDoc(bottleDocRef(code), { madeAt: Date.now() - minsAgo * 60000, feedStartedAt: null }, { merge: true });
    showToast(minsAgo > 0 ? `Bottle timer started (${minsAgo}m ago)` : 'Bottle timer started');
  } catch (e) {
    console.error(e);
    showToast('Could not save — check connection');
  }
}

bottlePillMain.addEventListener('click', () => startBottleTimer(0));

bottlePillClear.addEventListener('click', async () => {
  const code = getHouseholdCode();
  if (!code) return;
  try {
    await setDoc(bottleDocRef(code), { madeAt: null, feedStartedAt: null }, { merge: true });
    showToast('Bottle timer cleared');
  } catch (e) {
    console.error(e);
    showToast('Could not save — check connection');
  }
});

// --- Bottle adjust wheel picker ---

const bottleAdjustWheelValues = [];
for (let v = 0; v <= BOTTLE_ADJUST_MAX_MINS; v += BOTTLE_ADJUST_STEP_MINS) bottleAdjustWheelValues.push(v);

function formatBottleAdjustLabel(mins) {
  return mins === 0 ? 'Just now' : `${mins}m ago`;
}

bottleAdjustWheelValues.forEach((v) => {
  const item = document.createElement('div');
  item.className = 'wheel-item';
  item.textContent = formatBottleAdjustLabel(v);
  item.dataset.value = v;
  bottleAdjustWheelTrack.appendChild(item);
});

function bottleAdjustWheelIndexForValue(v) {
  return Math.round(v / BOTTLE_ADJUST_STEP_MINS);
}

function scrollBottleAdjustWheelTo(value, smooth = false) {
  const index = bottleAdjustWheelIndexForValue(value);
  bottleAdjustWheelTrack.scrollTo({ top: index * WHEEL_ITEM_HEIGHT, behavior: smooth ? 'smooth' : 'auto' });
}

function updateBottleAdjustWheelActiveItem() {
  const index = Math.round(bottleAdjustWheelTrack.scrollTop / WHEEL_ITEM_HEIGHT);
  const clamped = Math.max(0, Math.min(bottleAdjustWheelValues.length - 1, index));
  const value = bottleAdjustWheelValues[clamped];
  bottleAdjustWheelTrack.querySelectorAll('.wheel-item').forEach((el, i) => {
    el.classList.toggle('active', i === clamped);
  });
  return value;
}

bottleAdjustWheelTrack.addEventListener('scroll', () => {
  const value = updateBottleAdjustWheelActiveItem();
  clearTimeout(bottleAdjustWheelScrollTimer);
  bottleAdjustWheelScrollTimer = setTimeout(() => { selectedBottleMinsAgo = value; }, 120);
});

bottlePillAdjust.addEventListener('click', () => {
  selectedBottleMinsAgo = 0;
  bottleAdjustModal.hidden = false;
  scrollBottleAdjustWheelTo(0);
  updateBottleAdjustWheelActiveItem();
});
bottleAdjustCancel.addEventListener('click', () => { bottleAdjustModal.hidden = true; });
bottleAdjustConfirm.addEventListener('click', () => {
  bottleAdjustModal.hidden = true;
  startBottleTimer(selectedBottleMinsAgo);
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

// --- Past feeds chart (All) ---

const CHART_H = 170;
const CHART_LEFT = 30;
const CHART_RIGHT = 8;
const CHART_TOP = 20;
const CHART_BOTTOM = 140;
const CHART_MIN_WIDTH = 300;

function shiftDays(ms, n) {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

function startOfWeekMs(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return d.getTime();
}

function dailyFeedTotals() {
  const totals = new Map();
  for (const f of latestFeeds) {
    if (f.amountMl == null) continue;
    const key = dayKeyForTimestamp(f.timestamp);
    const entry = totals.get(key) || { total: 0, count: 0 };
    entry.total += f.amountMl;
    entry.count += 1;
    totals.set(key, entry);
  }
  return totals;
}

// Week buckets hold the week's total ml. `complete` is false for the current week and for a first
// week that began before the first logged feed, so neither drags down the average.
function buildChartBuckets(totals, group) {
  const today = startOfToday();
  const firstDay = totals.size ? Math.min(...totals.keys()) : today;
  const buckets = [];
  if (group === 'week') {
    for (let s = startOfWeekMs(firstDay); s <= today; s = shiftDays(s, 7)) {
      let total = 0;
      let count = 0;
      for (let i = 0, d = s; i < 7; i++, d = shiftDays(d, 1)) {
        const t = totals.get(d);
        if (t) { total += t.total; count += t.count; }
      }
      const end = shiftDays(s, 7);
      const partial = end > today;
      buckets.push({ start: s, end, value: total, total, count, partial, complete: !partial && s >= firstDay });
    }
    return buckets;
  }
  for (let s = firstDay; s <= today; s = shiftDays(s, 1)) {
    const t = totals.get(s) || { total: 0, count: 0 };
    buckets.push({ start: s, end: shiftDays(s, 1), value: t.total, total: t.total, count: t.count, partial: s === today, complete: s !== today });
  }
  return buckets;
}

function chartBarLabel(bucket, index, buckets, byWeek) {
  const d = new Date(bucket.start);
  const isMonday = (d.getDay() + 6) % 7 === 0;
  if (!byWeek && !isMonday && index !== 0) return '';
  const prev = index > 0 ? new Date(buckets[index - 1].start) : null;
  const newMonth = !prev || prev.getMonth() !== d.getMonth() || !byWeek;
  return newMonth ? d.toLocaleDateString([], { day: 'numeric', month: 'short' }) : String(d.getDate());
}

function setChartStat(i, value, label) {
  chartStatEls[i].value.textContent = value;
  chartStatEls[i].label.textContent = label;
}

function renderChartStats(totals) {
  const today = startOfToday();
  const completeDays = Array.from(totals.entries()).filter(([day]) => day !== today).map(([, t]) => t);
  const dayAvg = completeDays.length ? Math.round(completeDays.reduce((s, t) => s + t.total, 0) / completeDays.length) : 0;

  const weeks = buildChartBuckets(totals, 'week').filter(w => w.complete && w.count > 0);
  setChartStat(0, completeDays.length ? `${dayAvg}ml` : '—', 'Avg / day');
  if (weeks.length >= 2 && weeks[0].value > 0) {
    const change = Math.round((weeks[weeks.length - 1].value / weeks[0].value - 1) * 100);
    const since = new Date(weeks[0].start).toLocaleDateString([], { day: 'numeric', month: 'short' });
    setChartStat(1, `${change >= 0 ? '+' : ''}${change}%`, `Since ${since}`);
  } else {
    setChartStat(1, '—', 'Change');
  }
  const logged = Array.from(totals.values()).reduce((s, t) => s + t.count, 0);
  setChartStat(2, String(logged), 'Feeds logged');
  historyChartSvg.setAttribute('aria-label', chartGroup === 'week' ? 'Total milk per week' : 'Total milk each day');
}

function niceChartStep(maxValue) {
  if (maxValue <= 600) return 200;
  if (maxValue <= 1500) return 500;
  if (maxValue <= 3000) return 1000;
  return 2000;
}

// Draws the All-time chart and returns the selected bar's bucket.
function renderHistoryChart() {
  const totals = dailyFeedTotals();
  const byWeek = chartGroup === 'week';
  const buckets = buildChartBuckets(totals, chartGroup);

  let selectionReset = false;
  if (!buckets.some(b => b.start === chartSelectedStart)) {
    const withFeeds = buckets.filter(b => b.count > 0);
    chartSelectedStart = (withFeeds.length ? withFeeds[withFeeds.length - 1] : buckets[buckets.length - 1]).start;
    selectionReset = true;
  }
  const selectedIndex = buckets.findIndex(b => b.start === chartSelectedStart);

  const minSlot = byWeek ? 30 : 20;
  const plotW = Math.max(CHART_MIN_WIDTH - CHART_LEFT - CHART_RIGHT, buckets.length * minSlot);
  const width = plotW + CHART_LEFT + CHART_RIGHT;
  const slot = plotW / buckets.length;
  const barW = Math.min(slot * 0.62, 26);

  const complete = buckets.filter(b => b.complete);
  const avg = complete.length ? Math.round(complete.reduce((s, b) => s + b.value, 0) / complete.length) : 0;
  const step = niceChartStep(Math.max(avg, ...buckets.map(b => b.value), 1));
  const top = Math.ceil(Math.max(step, avg, ...buckets.map(b => b.value)) / step) * step;
  const y = v => CHART_BOTTOM - (v / top) * (CHART_BOTTOM - CHART_TOP);

  let svg = '';
  for (const v of [0, top / 2, top]) {
    svg += `<line class="hc-grid" x1="${CHART_LEFT}" x2="${width - CHART_RIGHT}" y1="${y(v)}" y2="${y(v)}"/>`;
    svg += `<text class="hc-axis" x="${CHART_LEFT - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
  }
  if (avg) {
    svg += `<line class="hc-avg" x1="${CHART_LEFT}" x2="${width - CHART_RIGHT}" y1="${y(avg)}" y2="${y(avg)}"/>`;
    svg += `<text class="hc-axis" x="${CHART_LEFT + 4}" y="${y(avg) - 4}">avg ${avg}ml</text>`;
  }
  buckets.forEach((b, i) => {
    const slotX = CHART_LEFT + i * slot;
    const cx = slotX + slot / 2;
    const isSel = i === selectedIndex;
    if (b.value > 0) {
      const cls = `hc-bar${isSel ? ' sel' : ''}${b.partial ? ' partial' : ''}`;
      svg += `<rect class="${cls}" x="${cx - barW / 2}" y="${y(b.value)}" width="${barW}" height="${CHART_BOTTOM - y(b.value)}" rx="3"/>`;
    }
    const label = chartBarLabel(b, i, buckets, byWeek);
    if (label) svg += `<text class="hc-axis${isSel ? ' hc-axis-sel' : ''}" x="${cx}" y="154" text-anchor="middle">${label}</text>`;
    if (b.partial) svg += `<text class="hc-axis" x="${cx}" y="165" text-anchor="middle">${byWeek ? 'so far' : 'today'}</text>`;
    svg += `<rect class="hc-hit" data-start="${b.start}" x="${slotX}" y="0" width="${slot}" height="${CHART_H}"/>`;
  });
  const sel = buckets[selectedIndex];
  if (sel.value > 0) {
    svg += `<text class="hc-val" x="${CHART_LEFT + selectedIndex * slot + slot / 2}" y="${y(sel.value) - 5}" text-anchor="middle">${sel.value}</text>`;
  }

  historyChartSvg.setAttribute('viewBox', `0 0 ${width} ${CHART_H}`);
  historyChartSvg.style.width = width > CHART_MIN_WIDTH ? `${width}px` : '100%';
  historyChartSvg.innerHTML = svg;
  if (selectionReset) historyChartScroll.scrollLeft = historyChartScroll.scrollWidth;

  historyChartCaption.textContent = byWeek
    ? 'Total ml per week, each week starting Monday. Tap a bar to see that week.'
    : 'Total ml each day. Tap a bar to see that day.';
  renderChartStats(totals);
  return sel;
}

historyChartSvg.addEventListener('click', (e) => {
  const hit = e.target.closest('.hc-hit');
  if (!hit) return;
  chartSelectedStart = Number(hit.dataset.start);
  renderHistory();
});

historyChartToggle.querySelectorAll('.chart-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    chartGroup = btn.dataset.group;
    chartSelectedStart = null;
    historyChartToggle.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderHistory();
  });
});

function historyFeedsToShow() {
  const charted = currentRange === 'all';
  historyChart.hidden = !charted;
  if (charted) {
    const sel = renderHistoryChart();
    return latestFeeds.filter(f => f.timestamp >= sel.start && f.timestamp < sel.end);
  }
  const cutoff = rangeCutoff(currentRange);
  return latestFeeds.filter(f => f.timestamp >= cutoff);
}

function renderHistory() {
  const filtered = historyFeedsToShow();
  historyList.innerHTML = '';
  historyEmpty.hidden = filtered.length !== 0;

  const groups = new Map();
  for (const feed of filtered) {
    const key = dayKeyForTimestamp(feed.timestamp);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(feed);
  }

  // Today's total lives in this list, so today always gets its row, even before the first feed of the day.
  if (currentRange !== 'all' && !groups.has(startOfToday())) groups.set(startOfToday(), []);

  for (const key of Array.from(groups.keys()).sort((a, b) => b - a)) {
    const dayFeeds = groups.get(key);
    const dayTotal = dayFeeds.reduce((sum, f) => sum + (f.amountMl || 0), 0);

    const headerLi = document.createElement('li');
    const isToday = key === startOfToday();
    headerLi.className = `day-group-header${isToday ? ' today' : ''}`;
    headerLi.innerHTML = `<span class="day-group-label">${dayLabelForKey(key)}${isToday ? ` · ${dayFeeds.length} ${dayFeeds.length === 1 ? 'feed' : 'feeds'}` : ''}</span><span class="day-group-total">${dayTotal}ml</span>`;
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
        <button class="history-delete" title="Delete" aria-label="Delete">✕</button>
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
    chartSelectedStart = null;
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
  // The bottle is now being drunk from: the 2-hour "made" timer gives way to 1 hour from the start of the feed.
  try {
    await setDoc(bottleDocRef(code), { madeAt: null, feedStartedAt: timestamp }, { merge: true });
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

// --- Feedback ---

let selectedFeedbackType = 'idea';

feedbackFab.addEventListener('click', () => {
  selectedFeedbackType = 'idea';
  feedbackMessage.value = '';
  feedbackTypeChips.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('selected', c.dataset.type === selectedFeedbackType);
  });
  feedbackModal.hidden = false;
});

feedbackTypeChips.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    selectedFeedbackType = chip.dataset.type;
    feedbackTypeChips.querySelectorAll('.chip').forEach(c => {
      c.classList.toggle('selected', c === chip);
    });
  });
});

feedbackCancel.addEventListener('click', () => {
  feedbackModal.hidden = true;
});

feedbackSend.addEventListener('click', async () => {
  const code = getHouseholdCode();
  const message = feedbackMessage.value.trim();
  if (!code || !message) return;
  try {
    await addDoc(feedbackCollection(code), {
      type: selectedFeedbackType,
      message,
      timestamp: Date.now(),
    });
    feedbackModal.hidden = true;
    showToast('Thanks for the feedback!');
  } catch (e) {
    console.error(e);
    showToast('Could not send — check connection');
  }
});

// --- Profile ---

profileDobInput.addEventListener('input', () => {
  profileDob = profileDobInput.value;
  renderProfileAge();
});

profileNameInput.addEventListener('input', renderProfilePreview);
profileLastNameInput.addEventListener('input', renderProfilePreview);

profileSaveBtn.addEventListener('click', async () => {
  const code = getHouseholdCode();
  if (!code) return;
  const firstName = profileNameInput.value.trim();
  const lastName = profileLastNameInput.value.trim();
  const dob = profileDobInput.value;
  try {
    await setDoc(profileDocRef(code), { firstName, lastName, dob, avatarTone: selectedAvatarTone, gender: selectedGender }, { merge: true });
    showToast('Profile saved');
    if (profileOnboarding) finishProfileOnboarding();
  } catch (e) {
    console.error(e);
    showToast('Could not save — check connection');
  }
});

profileSkipBtn.addEventListener('click', finishProfileOnboarding);

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

// --- Trends: patterns read from the feed log (see patterns.js) ---

function durationLabel(hours) {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// "21:45" — rounded to the nearest quarter hour, since the pattern is never to the minute.
function clockLabel(totalMinutes) {
  const rounded = (Math.round(totalMinutes / 15) * 15) % 1440;
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

function joinList(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function patternBarsSvg(values, { max, label }) {
  const width = 300, height = 84, gap = 4;
  const barW = (width - gap * (values.length - 1)) / values.length;
  const bars = values.map((v, i) => {
    const h = Math.max(2, (v / max) * (height - 4));
    const isLast = i === values.length - 1;
    return `<rect x="${(i * (barW + gap)).toFixed(1)}" y="${(height - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${isLast ? 'var(--sec)' : 'var(--sec-soft)'}" />`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" class="trends-svg" role="img" aria-label="${label}">${bars}</svg>`;
}

function feedingTimesSvg(hourly) {
  const width = 300, height = 70, gap = 3;
  const barW = (width - gap * 23) / 24;
  const max = Math.max(...hourly, 0.5);
  const bars = hourly.map((v, i) => {
    const h = Math.max(2, (v / max) * (height - 4));
    return `<rect x="${(i * (barW + gap)).toFixed(1)}" y="${(height - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" fill="var(--sec)" opacity="${v > 0 ? 0.35 + 0.65 * (v / max) : 0.15}" />`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" class="trends-svg" role="img" aria-label="Feeds by hour of day">${bars}</svg>
    <div class="trends-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>`;
}

// A pattern only counts as established once two weeks agree (or a flat result has held for three).
function trendTier(p) {
  return p.status === 'recognised' || (p.status === 'steady' && p.steadyWeeks) ? 'est' : 'maybe';
}

function trendBadge(p) {
  if (p.status === 'recognised') return 'Two weeks running';
  if (p.status === 'steady') return p.steadyWeeks ? `Steady for ${p.steadyWeeks} weeks` : 'So far';
  if (p.status === 'emerging') return 'This week';
  return 'Last few days';
}

// Each card leads with one number, then one plain sentence. Anything extra goes in a small note.
function trendItem({ short, title, badge, tier, value, unit, text, note, extra }) {
  const html = `<article class="tr${tier === 'maybe' ? ' maybe' : ''}">
    <div class="tr-top"><h3>${title}</h3>${badge ? `<span class="badge">${badge}</span>` : ''}</div>
    ${value ? `<div class="tr-val">${value}${unit ? ` <span>${unit}</span>` : ''}</div>` : ''}
    ${text ? `<p>${text}</p>` : ''}${extra || ''}${note ? `<p class="tr-note">${note}</p>` : ''}
  </article>`;
  return { tier, short, html };
}

function changeWord(p, up, down) {
  return p.dir === 'up' ? up : down;
}

function overnightItem(r) {
  const o = r.overnight;
  if (!o || o.status === 'none' || !r.nights || r.nights.length < 7) return null;
  const before = o.before != null ? durationLabel(o.before) : '';
  let text;
  if (o.status === 'recognised') text = `${changeWord(o, 'Longer', 'Shorter')} two weeks in a row. It was ${before} last week and ${durationLabel(o.first)} the week before.`;
  else if (o.status === 'emerging') text = `${changeWord(o, 'Up', 'Down')} from ${before} last week.`;
  else if (o.status === 'early') text = `The last few nights. Before that it was ${before}.`;
  else text = 'Holding steady from week to week.';
  const note = o.bedtimeFeed && o.stretchEnds
    ? `The long stretch usually runs from about ${clockLabel(o.bedtimeFeed.hour * 60 + o.bedtimeFeed.minute)} to ${clockLabel(o.stretchEnds.hour * 60 + o.stretchEnds.minute)}.`
    : '';
  return trendItem({ short: 'Overnight stretch', title: 'Overnight stretch', badge: trendBadge(o), tier: trendTier(o),
    value: durationLabel(o.recent), unit: 'longest stretch, on average', text, note });
}

function timesItem(r) {
  const t = r.times;
  if (!t) return null;
  const tier = t.days >= 14 ? 'est' : 'maybe';
  const chips = t.anchors.length
    ? `<div class="tchips">${t.anchors.map((a) => `<span>${clockLabel(a.minutes)}</span>`).join('')}</div>`
    : '';
  return trendItem({ short: 'Usual feed times', title: 'Usual feed times', badge: tier === 'est' ? 'Most days' : `Last ${t.days} days`, tier,
    text: t.anchors.length ? 'Most days there is a feed around these times.' : 'Feeds are spread through the day without a set rhythm yet.',
    extra: `${chips}${feedingTimesSvg(t.hourly)}`, note: `When feeds happened over the last ${t.days} days.` });
}

function volumeItem(r) {
  const v = r.volume;
  if (!v || v.status === 'none' || !r.dailyTotals || r.dailyTotals.length < 7) return null;
  const before = v.before != null ? Math.round(v.before) : null;
  let text;
  if (v.status === 'recognised') text = `${changeWord(v, 'Up', 'Down')} two weeks in a row. It was ${before}ml last week.`;
  else if (v.status === 'emerging') text = `${changeWord(v, 'Up', 'Down')} from ${before}ml last week.`;
  else if (v.status === 'early') text = `The last few days. Before that it was ${before}ml.`;
  else text = 'Holding steady from week to week.';
  const chart = patternBarsSvg(r.dailyTotals.map((d) => d.v), {
    max: Math.max(...r.dailyTotals.map((d) => d.v)),
    label: `Milk per day for the last ${r.dailyTotals.length} days`,
  });
  return trendItem({ short: 'Milk per day', title: 'Milk per day', badge: trendBadge(v), tier: trendTier(v),
    value: `${Math.round(v.recent)}ml`, unit: 'a day', text, extra: chart, note: `Each bar is one day, last ${r.dailyTotals.length} days.` });
}

function gapsItem(r) {
  const g = r.daytimeGaps;
  if (!g || g.status === 'none') return null;
  const before = g.before != null ? durationLabel(g.before) : '';
  let text;
  if (g.status === 'recognised' || g.status === 'emerging') text = `${changeWord(g, 'Further apart', 'Closer together')} than last week, when it was ${before}.`;
  else if (g.status === 'early') text = `The last few days. Before that it was ${before}.`;
  else text = 'Holding steady from week to week.';
  return trendItem({ short: 'Daytime gaps', title: 'Daytime gaps', badge: trendBadge(g), tier: trendTier(g),
    value: durationLabel(g.recent), unit: 'between daytime feeds', text });
}

function trendItems(r) {
  if (!r.nights) return [];
  return [overnightItem(r), timesItem(r), volumeItem(r), gapsItem(r)].filter(Boolean);
}

function trendsSummary(r) {
  const items = trendItems(r);
  if (!items.length) return { headline: 'Patterns', sub: 'Log a few days of feeds to see them' };
  const est = items.filter((i) => i.tier === 'est').length;
  const maybe = items.length - est;
  const parts = [];
  if (est) parts.push(`${est} settled`);
  if (maybe) parts.push(`${maybe} that might be starting`);
  return { headline: (items.find((i) => i.tier === 'est') || items[0]).short, sub: parts.join(', ') };
}

// The hero answers one question: how long was the longest stretch last night? The two facts under it give the
// times and the fortnight's best, and in the bars the longest night is the solid one with its length written on it.
function trendsHero(r) {
  const o = r.overnight;
  const shown = (r.nights || []).slice(-14);
  if (!o || !o.last || shown.length < 3) {
    return `<section class="hero"><svg class="ill" aria-hidden="true"><use href="#ill-moon"/></svg><div class="hero-l">Longest stretch overnight</div><div class="hero-n">—</div><div class="hero-s">Shows here once a few nights are logged.</div></section>`;
  }
  const max = Math.max(...shown.map((n) => n.hours));
  const bestIndex = shown.findIndex((n) => n.hours === max);
  const lastIsBest = bestIndex === shown.length - 1;
  const bars = shown.map((n, i) => {
    const cls = [i === bestIndex ? 'best' : '', i === shown.length - 1 ? 'last' : ''].filter(Boolean).join(' ');
    const label = i === bestIndex ? `<b>${durationLabel(n.hours)}</b>` : '';
    return `<span class="night ${cls}">${label}<i style="height:${Math.max(8, n.hours / max * 100).toFixed(0)}%"></i></span>`;
  }).join('');
  return `<section class="hero">
    <svg class="ill" aria-hidden="true"><use href="#ill-moon"/></svg>
    <div class="hero-l">Longest stretch last night</div>
    <div class="hero-n">${durationLabel(o.last.hours)}</div>
    <div class="hero-facts">
      <div><small>Between feeds at</small><b>${formatClock(o.last.start)} and ${formatClock(o.last.end)}</b></div>
      <div><small>Longest in two weeks</small><b>${lastIsBest ? 'Last night' : durationLabel(max)}</b></div>
    </div>
    <div class="nights" role="img" aria-label="Longest overnight stretch for each of the last ${shown.length} nights. The longest was ${durationLabel(max)}.">${bars}</div>
    <div class="nights-cap"><span>${new Date(shown[0].start).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span><span>Last night</span></div>
  </section>`;
}

function renderTrends() {
  if (!trendsPatternsEl) return;
  const r = analyse(latestFeeds);
  const dayCount = new Set(latestFeeds.map((f) => dayKeyForTimestamp(f.timestamp))).size;
  trendsSubEl.textContent = dayCount ? `From ${dayCount} ${dayCount === 1 ? 'day' : 'days'} of feeds` : 'From the feed log';

  const items = trendItems(r);
  const est = items.filter((i) => i.tier === 'est');
  const maybe = items.filter((i) => i.tier === 'maybe');
  let html = trendsHero(r);
  if (!items.length) {
    html += `<div class="th"><h2>Patterns</h2><p>Log a few days of feeds and patterns will start to show up here.</p></div>`;
  }
  if (est.length) {
    html += `<div class="th"><h2>Established</h2><p>Seen two weeks running or more.</p></div>${est.map((i) => i.html).join('')}`;
  }
  if (maybe.length) {
    html += `<div class="th"><h2>Might be starting</h2><p>Only the last few days. Too early to be sure.</p></div>${maybe.map((i) => i.html).join('')}`;
  }
  trendsPatternsEl.innerHTML = html;
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

// --- Log a feed sheet ---
// One sheet does three jobs: log a past feed ('log'), add the amount to a feed that was started ('complete'),
// and change a saved feed ('edit'). Only 'log' asks when it was; the other two keep the feed's own time
// unless "Change" is tapped. The next-feed time is never typed: it is the start time plus the gap.

let sheetMode = 'log';
let sheetAgo = null;          // minutes ago for a new feed; -1 means a time typed in; null means not chosen yet
let sheetTimeChanged = false; // complete/edit only: the saved time was replaced by typed values
let sheetBaseTs = null;       // complete/edit only: the feed's own time

function formatIntervalLabel(hours) {
  const whole = Math.floor(hours);
  return hours % 1 === 0 ? `${whole}h` : `${whole}h 30m`;
}

(function buildRuler() {
  let html = '';
  for (let v = ML_MIN; v <= ML_MAX; v += ML_STEP) {
    const major = v % 20 === 0;
    html += `<div class="tk${major ? ' m' : ''}"><i></i>${major ? `<span>${v}</span>` : ''}</div>`;
  }
  mlTicks.innerHTML = html;
})();

function rulerValue() {
  const steps = Math.round(mlRuler.scrollLeft / RULER_TICK_PX);
  const max = (ML_MAX - ML_MIN) / ML_STEP;
  return ML_MIN + Math.max(0, Math.min(max, steps)) * ML_STEP;
}

function setRulerValue(v) {
  mlRuler.scrollLeft = ((v - ML_MIN) / ML_STEP) * RULER_TICK_PX;
}

function lastCompletedAmount(excludeId) {
  const f = latestFeeds.find(x => x.amountMl != null && x.id !== excludeId);
  return f ? f.amountMl : null;
}

function onAmountChanged(value) {
  selectedMl = value;
  sheetMlEl.textContent = String(value);
  mlRuler.setAttribute('aria-valuenow', String(value));
  const lastAmt = lastCompletedAmount(editingFeedId);
  if (sheetMode === 'edit' || lastAmt == null) sheetHint.textContent = '';
  else sheetHint.textContent = value === lastAmt ? 'Same as the last feed' : `Last feed was ${lastAmt}ml`;
  sheetHint.hidden = !sheetHint.textContent;
  if (!intervalOverridden) selectedIntervalHours = computeAutoIntervalHours(value);
  drawSheet();
}

mlRuler.addEventListener('scroll', () => {
  const v = rulerValue();
  if (v !== selectedMl) onAmountChanged(v);
});

mlRuler.addEventListener('keydown', (e) => {
  const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
  if (!dir) return;
  e.preventDefault();
  setRulerValue(Math.max(ML_MIN, Math.min(ML_MAX, selectedMl + dir * ML_STEP)));
});

function pickedTimeTs() {
  if (!feedDateInput.value || !feedTimeInput.value) return null;
  return combineDateTimeToTimestamp(feedDateInput.value, feedTimeInput.value);
}

// The start time the sheet would save right now, or null when none has been chosen yet.
function sheetStartTs() {
  if (sheetMode === 'log') {
    if (sheetAgo > 0) return Date.now() - sheetAgo * 60000;
    if (sheetAgo === -1) return pickedTimeTs();
    return null;
  }
  return sheetTimeChanged ? pickedTimeTs() : sheetBaseTs;
}

function drawSheet() {
  const gap = selectedIntervalHours;
  sheetGapEl.textContent = formatIntervalLabel(gap);
  gapLess.disabled = gap <= INTERVAL_MIN;
  gapMore.disabled = gap >= INTERVAL_MAX;

  const ts = sheetStartTs();
  sheetAtEl.textContent = ts == null ? '–:–' : formatClock(ts + gap * 3600000);

  if (sheetMode === 'log') {
    sheetWhen.querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.ago) === sheetAgo));
    sheetEarlier.hidden = sheetAgo !== -1;
    logConfirm.textContent = ts == null ? 'Choose when it was' : 'Log feed';
  } else {
    sheetFixed.hidden = sheetTimeChanged;
    sheetEarlier.hidden = !sheetTimeChanged;
    if (!sheetTimeChanged && sheetBaseTs != null) {
      sheetFixedK.textContent = sheetMode === 'complete' ? 'Started' : 'When';
      sheetFixedV.textContent = sheetMode === 'complete'
        ? `${formatClock(sheetBaseTs)}, ${durationString(Date.now() - sheetBaseTs)} ago`
        : `${dayLabelForKey(dayKeyForTimestamp(sheetBaseTs))}, ${formatClock(sheetBaseTs)}`;
    }
    logConfirm.textContent = sheetMode === 'complete' ? 'Save amount' : 'Save';
  }
  logConfirm.disabled = ts == null;
}

sheetWhen.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-ago]');
  if (!btn) return;
  sheetAgo = Number(btn.dataset.ago);
  if (sheetAgo === -1) {
    feedDateInput.value = todayDateString();
    feedTimeInput.value = '';
    syncDayChips(feedDateInput, feedDayChips);
  }
  drawSheet();
});

sheetFixedChange.addEventListener('click', () => {
  const d = new Date(sheetBaseTs);
  feedDateInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  feedTimeInput.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  syncDayChips(feedDateInput, feedDayChips);
  sheetTimeChanged = true;
  drawSheet();
});

function nudgeGap(delta) {
  selectedIntervalHours = Math.max(INTERVAL_MIN, Math.min(INTERVAL_MAX, selectedIntervalHours + delta));
  intervalOverridden = true;
  drawSheet();
}
gapLess.addEventListener('click', () => nudgeGap(-INTERVAL_STEP));
gapMore.addEventListener('click', () => nudgeGap(INTERVAL_STEP));

function openLogModal(feed) {
  editingFeedId = feed ? feed.id : null;
  const isPending = !!feed && feed.amountMl == null;
  sheetMode = !feed ? 'log' : (isPending ? 'complete' : 'edit');
  sheetAgo = null;
  sheetTimeChanged = false;
  sheetBaseTs = feed ? feed.timestamp : null;

  const startMl = feed?.amountMl ?? lastCompletedAmount(feed?.id) ?? DEFAULT_ML;
  intervalOverridden = !!feed && !isPending;
  selectedMl = startMl;
  selectedIntervalHours = feed?.intervalHours || computeAutoIntervalHours(startMl);

  feedDateInput.value = todayDateString();
  feedDateInput.max = todayDateString();
  feedTimeInput.value = '';
  syncDayChips(feedDateInput, feedDayChips);

  logModalTitle.textContent = sheetMode === 'log' ? 'Log a feed' : (isPending ? 'Complete feed' : 'Edit feed');
  sheetWhen.hidden = sheetMode !== 'log';
  sheetDel.hidden = sheetMode !== 'edit';
  sheetFixed.hidden = sheetMode === 'log';
  sheetEarlier.hidden = true;

  logModal.hidden = false;
  setRulerValue(startMl);
  onAmountChanged(startMl);
}

function dateStringForOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function syncDayChips(input, chipsEl) {
  chipsEl.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('selected', input.value === dateStringForOffset(Number(c.dataset.offset)));
  });
}

function wireDayPicker(input, chipsEl) {
  input.addEventListener('input', () => syncDayChips(input, chipsEl));
  input.addEventListener('change', () => syncDayChips(input, chipsEl));
  chipsEl.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      input.value = dateStringForOffset(Number(chip.dataset.offset));
      syncDayChips(input, chipsEl);
    });
  });
}

wireDayPicker(feedDateInput, feedDayChips);
wireDayPicker(pooDateInput, pooDayChips);

// The typed date and time feed the "around" time, so redraw on every change.
['input', 'change'].forEach(evt => {
  feedDateInput.addEventListener(evt, drawSheet);
  feedTimeInput.addEventListener(evt, drawSheet);
});
feedDayChips.addEventListener('click', drawSheet);

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

btnStartFeedNow.addEventListener('click', () => {
  if (latestFeeds.length && latestFeeds[0].amountMl == null) {
    openLogModal(latestFeeds[0]);
  } else {
    startFeed(Date.now(), computeAutoIntervalHours(DEFAULT_ML));
  }
});

function closeLogModal() {
  logModal.hidden = true;
  editingFeedId = null;
}

btnLogFeed.addEventListener('click', () => openLogModal());
logCancel.addEventListener('click', closeLogModal);
logModal.addEventListener('click', (e) => { if (e.target === logModal) closeLogModal(); });

sheetDel.addEventListener('click', () => {
  const id = editingFeedId;
  closeLogModal();
  if (id) openConfirmDeleteModal(id);
});

logConfirm.addEventListener('click', () => {
  const timestamp = sheetStartTs();
  if (timestamp == null) return;
  showRangeContaining(timestamp, historyRange, ["1d", "7d", "14d"], (r) => { currentRange = r; chartSelectedStart = null; });
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

// --- Add to Home Screen ---

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isRunningStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

let deferredInstallPrompt = null;

if (!isRunningStandalone() && isIosDevice()) {
  btnInstallApp.hidden = false;
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!isRunningStandalone()) btnInstallApp.hidden = false;
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  btnInstallApp.hidden = true;
});

btnInstallApp.addEventListener('click', async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    btnInstallApp.hidden = true;
  } else if (isIosDevice()) {
    installModal.hidden = false;
  }
});

installModalClose.addEventListener('click', () => { installModal.hidden = true; });

btnCreateHousehold.addEventListener('click', () => {
  const code = generateHouseholdCode();
  localStorage.setItem(STORAGE_KEY, code);
  history.replaceState(null, '', '#profile');
  setProfileOnboarding(true);
  enterApp(code);
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

renderHeaderDate();
setInterval(() => { renderHeaderDate(); renderSinceLastFeed(); renderNextFeed(); renderTodayTotal(); renderSinceLastPoo(); renderPooStats(); renderProfileAge(); renderBottleStatus(); renderHome(); }, 15000);

renderTrends();
renderHome();
renderTodayTotal();
renderPooStats();
renderSinceLastPoo();
renderFunFact();

const existingCode = getHouseholdCode();
if (existingCode) {
  enterApp(existingCode);
} else {
  setupScreen.hidden = false;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js?v=74').catch(() => {});
  });
}

// iOS Safari ignores user-scalable=no, so block pinch-zoom gestures and double-tap zoom directly.
['gesturestart', 'gesturechange', 'gestureend'].forEach(evt => {
  document.addEventListener(evt, (e) => e.preventDefault());
});
