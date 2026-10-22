import { firebaseConfig } from './firebase-config.js';
import { analyse } from './patterns.js?v=174';
import { initializeApp } from './vendor/firebase-app.js';
import { getAuth, initializeAuth, browserLocalPersistence, signInAnonymously } from './vendor/firebase-auth.js';
import {
  getFirestore, initializeFirestore, memoryLocalCache, getDocFromServer, collection, addDoc, deleteDoc, doc, setDoc, updateDoc, deleteField,
  query, where, orderBy, limit, documentId, onSnapshot, getDoc, writeBatch, enableIndexedDbPersistence, getDocs, getCountFromServer, getAggregateFromServer, count, sum,
} from './vendor/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
// Inside the iPhone app the phone's browser database (IndexedDB) cannot be trusted: after the app has been in the
// background it can stop answering, and Firebase then waits on it forever, so nothing loads or saves. The app therefore
// keeps its sign-in in plain local storage and its copy of the diary in memory, and talks to the server for the rest.
// The website keeps the offline copy on the phone as before.
const inNativeApp = !!window.Capacitor?.isNativePlatform?.();
const db = inNativeApp
  ? initializeFirestore(app, { localCache: memoryLocalCache(), experimentalAutoDetectLongPolling: true })
  : getFirestore(app);
if (!inNativeApp) {
  try { enableIndexedDbPersistence(db); } catch (e) { /* multiple tabs open, fine */ }
}

// The iPhone app's plugins (notifications, the lock screen timer). Capacitor's registerPlugin() comes from its JavaScript
// package, which this app does not load (there is no build step), so calling it failed and both features stayed hidden.
// The bridge Capacitor injects into the app has the call that registerPlugin() itself uses, so plugins are reached
// through that. Outside the app (or if the bridge is missing) this gives null and the features stay off.
function nativePlugin(name) {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.() || typeof cap.nativePromise !== 'function') return null;
  return new Proxy({}, {
    get: (_, method) => (method === 'then' ? undefined : (options) => cap.nativePromise(name, String(method), options || {})),
  });
}

// A short log of what went wrong, kept on this phone only, shown by the connection check so a problem can be reported.
const DIAG_KEY = 'babyfeed_diag';
function diag(msg) {
  try {
    const list = JSON.parse(localStorage.getItem(DIAG_KEY) || '[]');
    list.push(`${new Date().toISOString().slice(5, 19).replace('T', ' ')} ${msg}`);
    localStorage.setItem(DIAG_KEY, JSON.stringify(list.slice(-40)));
  } catch (e) { /* no log */ }
}
diag(`opened (${inNativeApp ? 'iPhone app' : 'website'})`);

// Every device signs in quietly (no email or password) and registers itself as a member of the household. The
// security rules (firestore.rules) only let registered members read or write that household's data.
const auth = inNativeApp ? initializeAuth(app, { persistence: browserLocalPersistence }) : getAuth(app);
// Sign-in never holds the app up for long: the data can still be reached without it under the current rules, and if it
// cannot, the diary shows an error instead of waiting forever.
async function signedIn() {
  try { await withTimeout(auth.authStateReady(), 4000); } catch (e) { diag('sign-in: saved sign-in did not load'); }
  if (!auth.currentUser) {
    try { await withTimeout(signInAnonymously(auth), 8000); } catch (e) { diag(`sign-in failed: ${e.code || e.message}`); }
  }
  return auth.currentUser;
}
const MEMBER_KEY = 'babyfeed_member_of';
async function joinHousehold(code) {
  try {
    if (!(await signedIn())) return;
    const member = setDoc(doc(db, 'households', code, 'members', auth.currentUser.uid), { lastSeen: Date.now() }, { merge: true })
      .then(() => localStorage.setItem(MEMBER_KEY, `${code}:${auth.currentUser.uid}`));
    // Offline, the write waits for the connection, so never hold the app up for it.
    await Promise.race([member, new Promise((resolve) => setTimeout(resolve, 4000))]);
  } catch (e) {
    // Sign-in not switched on yet, or no connection: carry on, the older rules still allow the app to work.
    console.warn('Could not register this device', e);
    diag(`register failed: ${e.code || e.message}`);
  }
}

const STORAGE_KEY = 'babyfeed_household_code';
const DEFAULT_ML = 90;
const ML_MIN = 10;
const ML_MAX = 300;
const ML_STEP = 5;

// Amounts are always saved in ml. Ounces are only how they are shown and picked, kept per device, so switching never
// changes anything that is stored.
const UNIT_KEY = 'babyfeed_unit';
const ML_PER_OZ = 29.5735;
let unit = (() => { try { return localStorage.getItem(UNIT_KEY) === 'oz' ? 'oz' : 'ml'; } catch (e) { return 'ml'; } })();
function ozString(ml) { return String(Math.round((ml / ML_PER_OZ) * 10) / 10); }
function amountNumber(ml) { return unit === 'oz' ? ozString(ml) : String(ml); }
function fmtAmount(ml) { return `${amountNumber(ml)}${unit}`; }
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
const babySheet = document.getElementById('baby-sheet');
const profileBornEl = document.getElementById('profile-born');
const profileTitleEl = document.getElementById('profile-title');
const editBabyValueEl = document.getElementById('edit-baby-v');
const sofarEl = document.getElementById('sofar');
const yearBlock = document.getElementById('year-block');
const yearNudge = document.getElementById('year-nudge');
const yearDayEl = document.getElementById('year-day');
const yearLeftEl = document.getElementById('year-left');
const yearBarEl = document.getElementById('year-bar');
const yearTicksEl = document.getElementById('year-ticks');
const yearNextEl = document.getElementById('year-next');
const statFeedsEl = document.getElementById('stat-feeds');
const statLitresEl = document.getElementById('stat-litres');
const statPoosEl = document.getElementById('stat-poos');
const statMomentsEl = document.getElementById('stat-moments');
const shareCodeRowEl = document.getElementById('share-code-row');
const settingsScreen = document.getElementById('settings-screen');
const pooScreen = document.getElementById('poo-screen');
const joinForm = document.getElementById('join-form');
const joinCodeInput = document.getElementById('join-code');
const setupError = document.getElementById('setup-error');
const btnCreateHousehold = document.getElementById('btn-create-household');

const heroCard = document.getElementById('hero-card');
const pendingTimeEl = document.getElementById('pending-time');
const lastFeedLabelEl = document.getElementById('last-feed-label');
const pendingDetailEl = document.getElementById('pending-detail');
const nextFeedLabelEl = document.getElementById('next-feed-label');
const heroLine = document.getElementById('hero-line');
const lateCalmEl = document.getElementById('late-calm');
const todayBottle = document.getElementById('today-bottle');
const bottleBrandTrack = document.getElementById('bottle-brand-track');
const tabbar = document.getElementById('tabbar');
const homeDateEl = document.getElementById('home-date');
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
const timeWheel = document.getElementById('time-wheel');
const timeHours = document.getElementById('time-hours');
const timeMins = document.getElementById('time-mins');
const sheetHint = document.getElementById('sheet-hint');
const amountTrack = document.getElementById('amount-track');
const gapChips = document.getElementById('gap-chips');
const feedWhenLabel = document.getElementById('feed-when-label');
const sheetDel = document.getElementById('sheet-del');
const logCancel = document.getElementById('log-cancel');
const logConfirm = document.getElementById('log-confirm');
const logTimeOnly = document.getElementById('log-time-only');

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
let currentRange = '7d';
let chartGroup = 'week';
let chartSelectedStart = null;
let currentPooRange = '7d';
let selectedAvatarTone = '';
let selectedGender = '';
let profileOnboarding = false;
let profileDob = '';
let profileFirstName = '';
let profileIsDemo = false; // the example household given to App Review; it cannot be deleted from the app
let profileLastName = '';
let selectedPooSize = '';
let bottleMadeAt = null;
let bottleFeedStartedAt = null;
let selectedBottleMinsAgo = 0;
let calendarInitialized = false;
let currentCalYear = 0;
let currentCalMonth = 0;
let currentMonthMilestones = new Map();
let currentMonthUnsub = null;
let loadedMonthKey = null;
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

// A short message at the bottom of the screen. With an action (such as Undo) it stays longer and carries a button.
let toastTimer = null;
function showToast(msg, action) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-act';
    btn.textContent = action.label;
    btn.addEventListener('click', () => { toast.hidden = true; action.run(); });
    toast.appendChild(btn);
  }
  toast.classList.toggle('has-act', !!action);
  toast.hidden = false;
  const isProblem = /^(could not|sync error|this phone cannot|the service is)/i.test(msg);
  toastTimer = setTimeout(() => { toast.hidden = true; }, action ? 7000 : isProblem ? 6000 : 2000);
}

// Puts a just-deleted feed or poo back exactly as it was, under the same id.

function generateHouseholdCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  // 32 characters, so a random byte can be reduced with & 31 without favouring any of them.
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[bytes[i] & 31];
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
  settings: settingsScreen,
  poo: pooScreen,
};

const TAB_SECTION = { feed: 's-feed', home: 's-feed', poo: 's-nappy', milestones: 's-mile', trends: 's-trend' };

function showScreen(name) {
  if (!(name in SCREENS)) name = 'feed';
  Object.values(SCREENS).forEach(el => { el.hidden = true; });
  SCREENS[name].hidden = false;
  tabbar.hidden = !(name in TAB_SECTION);
  tabbar.className = `tabs ${TAB_SECTION[name] || 's-feed'}`;
  tabbar.querySelectorAll('.tab').forEach(t => {
    if (t.dataset.nav === name) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  document.documentElement.classList.toggle('on-home', name === 'home');
  if (name === 'profile') { scrollBottleBrandWheelTo(selectedBottleBrand); refreshProfileCounts(); }
  if (name === 'poo') ensurePoosListener();
  if (name === 'settings') shareCodeRowEl.textContent = getHouseholdCode() || '';
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

async function enterApp(code) {
  setupScreen.hidden = true;
  if (!(location.hash.slice(1) in SCREENS)) {
    history.replaceState(null, '', '#feed');
  }
  applyRouteFromHash();
  // A device that has registered before starts straight away; only the very first open waits for it.
  const joining = joinUnlessDeleted(code);
  let known = false;
  try { await withTimeout(auth.authStateReady(), 4000); known = !!auth.currentUser && localStorage.getItem(MEMBER_KEY) === `${code}:${auth.currentUser.uid}`; } catch (e) { /* treat as a first open */ }
  if (!known) await joining;
  listenToFeeds(code);
  listenToProfile(code);
  listenToBottle(code);
}

// The feed list is read as a recent window (the last 28 days) rather than everything, so opening the app costs a few
// hundred reads however long it has been used. The most recent older feed is also read, so "Last feed" is right after a
// long break. Everything older is read only when the All tab is opened.
const FEED_WINDOW_DAYS = 28;
let windowFeeds = [];
let olderFeeds = [];
let olderAllLoaded = false;
let feedCutoff = 0;
let oldestFeedTs = null;
let feedsLoaded = false; // becomes true with the first answer from the feed list, so empty-state hints never flash

function setFeeds() {
  const seen = new Set(windowFeeds.map(f => f.id));
  latestFeeds = [...windowFeeds, ...olderFeeds.filter(f => !seen.has(f.id))].sort((a, b) => b.timestamp - a.timestamp);
  renderSinceLastFeed();
  renderNextFeed();
  renderTodayTotal();
  renderHistory();
  renderTrends();
  renderFirstRunHints();
  syncLiveFeed();
}

// A live listener that is refused stops for good, so every listener reports to one place. The common cause once the
// security rules are on is a phone whose registration had not landed yet (a slow first connection): it registers
// again and reloads once. Other causes get a message that names the real problem instead of "check connection".
let lastListenToast = 0;
function listenToastOnce(msg) {
  if (Date.now() - lastListenToast < 30000) return;
  lastListenToast = Date.now();
  showToast(msg);
}
async function handleListenError(err) {
  console.error(err);
  diag(`live update stopped: ${(err && (err.code || err.message)) || 'unknown'}`);
  const reason = err && err.code;
  if (reason === 'permission-denied') {
    const code = getHouseholdCode();
    let tried = false;
    try { tried = sessionStorage.getItem('babyfeed_healed') === '1'; } catch (e) { /* treat as not tried */ }
    if (code && !tried) {
      try { sessionStorage.setItem('babyfeed_healed', '1'); } catch (e) { /* the reload may repeat once more; harmless */ }
      await joinHousehold(code);
      location.reload();
      return;
    }
    listenToastOnce('This phone cannot open the diary. Check the household code in Settings.');
  } else if (reason === 'resource-exhausted') {
    listenToastOnce('The service is very busy right now. Please try again in a little while.');
  } else {
    listenToastOnce('Sync error. Check your connection');
  }
}

function listenToFeeds(code) {
  feedCutoff = startOfToday() - FEED_WINDOW_DAYS * 86400000;
  onSnapshot(query(feedsCollection(code), where('timestamp', '>=', feedCutoff), orderBy('timestamp', 'desc')), (snapshot) => {
    windowFeeds = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    feedsLoaded = true;
    setFeeds();
  }, handleListenError);
  onSnapshot(query(feedsCollection(code), where('timestamp', '<', feedCutoff), orderBy('timestamp', 'desc'), limit(1)), (snapshot) => {
    if (olderAllLoaded) return;
    olderFeeds = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setFeeds();
  }, handleListenError);
  lookupOldestFeed(code);
}

// All the feeds older than the window, live, once the All tab asks for them.
function ensureOlderFeeds() {
  const code = getHouseholdCode();
  if (!code || olderAllLoaded) return;
  olderAllLoaded = true;
  onSnapshot(query(feedsCollection(code), where('timestamp', '<', feedCutoff), orderBy('timestamp', 'desc')), (snapshot) => {
    olderFeeds = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setFeeds();
  }, (err) => {
    console.error(err);
    olderAllLoaded = false;
    showToast('Could not load the older feeds. Check your connection');
  });
}

// One small read for the date of the very first feed, so Trends can say how many days it covers.
async function lookupOldestFeed(code) {
  try {
    const first = await getDocs(query(feedsCollection(code), orderBy('timestamp', 'asc'), limit(1)));
    oldestFeedTs = first.docs.length ? first.docs[0].data().timestamp : null;
    renderTrends();
  } catch (e) { /* offline: the label falls back to the window */ }
}

function listenToProfile(code) {
  onSnapshot(profileDocRef(code), (snap) => {
    const data = snap.data() || {};
    const firstName = data.firstName || data.name || '';
    // The sheet's boxes are only refreshed while it is closed, so a change arriving mid-typing never overwrites what is typed.
    if (babySheet.hidden) {
      profileNameInput.value = firstName;
      profileLastNameInput.value = data.lastName || '';
      profileDobInput.value = data.dob || '';
    }
    profileLastName = data.lastName || '';
    profileIsDemo = !!data.demo;
    profileDob = data.dob || '';
    selectedAvatarTone = data.avatarTone || '';
    selectedGender = data.gender || '';
    selectedBottleBrand = data.bottleBrand || 'mam';
    applyBottleBrand();
    if (!profileScreen.hidden) scrollBottleBrandWheelTo(selectedBottleBrand);
    profileTileLabel.textContent = firstName ? `${firstName}’s profile` : 'Profile';
    profileFirstName = firstName;
    const babyTitleName = firstName || 'Your baby';
    homeTitleEl.textContent = `${babyTitleName}’${babyTitleName.endsWith('s') ? '' : 's'} First Year`;
    document.title = `${babyTitleName}'s First Year`;
    const initial = firstName ? firstName.charAt(0).toUpperCase() : '·';
    document.querySelectorAll('.me:not(.back)').forEach(el => { el.textContent = initial; });
    document.body.classList.toggle('gender-pink', selectedGender === 'female');
    document.body.classList.toggle('feed-blue', selectedGender === 'blue');
    updateAvatarIcons();
    highlightToneChip();
    highlightGenderChip();
    renderProfileAge();
    renderProfilePreview();
    renderSinceLastFeed();
    renderTrends();
    syncReminder(); // the reminder names the baby, so it follows the name as soon as it arrives
    syncLiveFeed(); // so does the lock screen timer
    if (calendarInitialized) renderCalendar();
  }, handleListenError);
}

// The profile picture is a drawn baby face. The saved value is still the old skin-tone marker, so nothing stored changes.
const AVATAR_SKIN = { '🏻': '#f9dcc4', '': '#f1c9a5', '🏽': '#d9a37a', '🏾': '#a86f47', '🏿': '#6b4630' };
function babyFaceSvg(tone) {
  const skin = AVATAR_SKIN[tone] || AVATAR_SKIN[''];
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="10.5" cy="35" r="4.5" fill="${skin}"/><circle cx="53.5" cy="35" r="4.5" fill="${skin}"/><circle cx="32" cy="34" r="22" fill="${skin}"/><path d="M32 12c-3 0-5 2-5 4.500 0 1.800 1.600 2.800 3 2.200" fill="none" stroke="#2b201c" stroke-width="2.400" stroke-linecap="round"/><circle cx="24.500" cy="34" r="2.600" fill="#2b201c"/><circle cx="39.500" cy="34" r="2.600" fill="#2b201c"/><ellipse cx="19.500" cy="41" rx="3.600" ry="2.400" fill="#ff9fb1" opacity=".6"/><ellipse cx="44.500" cy="41" rx="3.600" ry="2.400" fill="#ff9fb1" opacity=".6"/><path d="M26.500 42c2.800 3.600 8.200 3.600 11 0" fill="none" stroke="#2b201c" stroke-width="2.400" stroke-linecap="round"/></svg>`;
}
avatarToneChips.querySelectorAll('.swatch').forEach(c => { c.style.background = AVATAR_SKIN[c.dataset.tone]; });
function updateAvatarIcons() {
  profileIconBig.innerHTML = babyFaceSvg(selectedAvatarTone);
}

function highlightToneChip() {
  avatarToneChips.querySelectorAll('.swatch').forEach(c => {
    c.classList.toggle('selected', c.dataset.tone === selectedAvatarTone);
    c.setAttribute('aria-pressed', String(c.dataset.tone === selectedAvatarTone));
  });
}

avatarToneChips.querySelectorAll('.swatch').forEach(chip => {
  chip.addEventListener('click', () => {
    selectedAvatarTone = chip.dataset.tone;
    saveProfileFields({ avatarTone: selectedAvatarTone });
    updateAvatarIcons();
    highlightToneChip();
  });
});

function highlightGenderChip() {
  genderChips.querySelectorAll('.swatch').forEach(c => {
    const current = selectedGender === 'female' || selectedGender === 'blue' ? selectedGender : 'male';
    const on = c.dataset.gender === current;
    c.classList.toggle('selected', on);
    c.setAttribute('aria-pressed', String(on));
  });
}

genderChips.querySelectorAll('.swatch').forEach(chip => {
  chip.addEventListener('click', () => {
    selectedGender = chip.dataset.gender;
    highlightGenderChip();
    document.body.classList.toggle('gender-pink', selectedGender === 'female');
    document.body.classList.toggle('feed-blue', selectedGender === 'blue');
    saveProfileFields({ gender: selectedGender });
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

// The baby page: age, how far through the first year, and the next month birthday. All worked out from the birthday.
const YEAR_MONTH_MS = 86400000;
function parseDobString(dobStr) {
  if (!dobStr) return null;
  const [y, m, d] = dobStr.split('-').map(Number);
  const dob = new Date(y, m - 1, d);
  return Number.isNaN(dob.getTime()) ? null : dob;
}
function monthsAfter(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, date.getDate());
}
function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function renderProfileAge() {
  const dob = parseDobString(profileDob);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const valid = dob && dob.getTime() <= today.getTime();
  profileAgeEl.textContent = valid ? ageString(profileDob) : '';
  profileBornEl.textContent = valid ? `Born ${dob.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : '';
  yearBlock.hidden = !valid;
  yearNudge.hidden = !!valid;
  if (!valid) return;

  const firstBirthday = monthsAfter(dob, 12);
  const total = Math.round((firstBirthday - dob) / YEAR_MONTH_MS);
  const done = Math.max(0, Math.min(total, Math.round((today - dob) / YEAR_MONTH_MS)));
  const finished = today.getTime() >= firstBirthday.getTime();
  let months = (today.getFullYear() - dob.getFullYear()) * 12 + today.getMonth() - dob.getMonth();
  if (monthsAfter(dob, months).getTime() > today.getTime()) months -= 1;
  months = Math.max(0, months);

  yearDayEl.textContent = finished ? 'First year complete' : `Day ${done + 1} of the first year`;
  yearLeftEl.textContent = finished ? '' : `${plural(total - done, 'day')} to go`;
  yearBarEl.style.transform = `scaleX(${(done / total).toFixed(4)})`;
  yearTicksEl.innerHTML = Array.from({ length: 12 }, (_, i) => `<span class="${i < months ? 'done' : ''}">${i + 1}</span>`).join('');
  if (finished) {
    yearNextEl.textContent = 'Happy first birthday and beyond';
  } else {
    const next = monthsAfter(dob, months + 1);
    const left = Math.round((next - today) / YEAR_MONTH_MS);
    const when = next.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    yearNextEl.textContent = `${months + 1 === 12 ? 'First birthday' : `${plural(months + 1, 'month')} old`} on ${when}, ${left === 0 ? 'today' : `in ${plural(left, 'day')}`}`;
  }
}

function renderProfilePreview() {
  const fullName = [profileFirstName, profileLastName].filter(Boolean).join(' ');
  profileNamePreview.textContent = fullName || 'Your baby';
  profileTitleEl.textContent = profileFirstName || 'Your baby';
  editBabyValueEl.textContent = fullName;
  sofarEl.textContent = `${profileFirstName || 'Your baby'} so far`;
}

// The four totals are worked out by Google on its side (a count and a sum, charged at about one read per thousand
// entries), so they stay exact however many feeds there are and nothing is downloaded.
let profileCounts = { feeds: null, ml: null, poos: null, moments: null };
function renderProfileCounts() {
  const c = profileCounts;
  statFeedsEl.textContent = c.feeds == null ? '–' : c.feeds.toLocaleString();
  if (c.ml == null) statLitresEl.textContent = '–';
  else if (unit === 'oz') statLitresEl.textContent = Math.round(c.ml / ML_PER_OZ).toLocaleString();
  else statLitresEl.textContent = (c.ml / 1000).toLocaleString(undefined, { maximumFractionDigits: c.ml >= 10000 ? 0 : 1 });
  document.getElementById('stat-litres-label').textContent = unit === 'oz' ? 'fl oz' : 'litres';
  statPoosEl.textContent = c.poos == null ? '–' : c.poos.toLocaleString();
  statMomentsEl.textContent = c.moments == null ? '–' : c.moments.toLocaleString();
}
async function refreshProfileCounts() {
  renderProfileCounts();
  const code = getHouseholdCode();
  if (!code) return;
  const [feeds, poos, moments] = await Promise.allSettled([
    getAggregateFromServer(query(feedsCollection(code), where('amountMl', '>=', 0)), { feeds: count(), ml: sum('amountMl') }),
    getCountFromServer(poosCollection(code)),
    getCountFromServer(milestonesCollection(code)),
  ]);
  profileCounts = {
    feeds: feeds.status === 'fulfilled' ? feeds.value.data().feeds : null,
    ml: feeds.status === 'fulfilled' ? feeds.value.data().ml : null,
    poos: poos.status === 'fulfilled' ? poos.value.data().count : null,
    moments: moments.status === 'fulfilled' ? moments.value.data().count : null,
  };
  renderProfileCounts();
}

// A first-time household opens the name sheet straight away; Continue and Skip both lead on to the Feeds page.
function setProfileOnboarding(on) {
  profileOnboarding = on;
  profileWelcome.hidden = !on;
  profileSkipBtn.hidden = !on;
  profileSaveBtn.hidden = !on;
  if (on) openBabySheet();
}

function finishProfileOnboarding() {
  setProfileOnboarding(false);
  goTo('feed');
  shareCodeEl.textContent = getHouseholdCode();
  shareModal.hidden = false;
}

// Like the feeds, the poo list follows only the last 28 days, plus the single most recent older poo, so "Last poo" is
// right after a long gap and the oldest recent poo still shows its gap. Nothing here needs older poos: the list shows
// 1 or 7 days, and the page's totals come from the server (see refreshProfileCounts).
let windowPoos = [];
let poosLoaded = false;
let poosListening = false;
// The poo list is only read when the Poos page is first opened, so people who rarely use it never pay for it.
function ensurePoosListener() {
  const code = getHouseholdCode();
  if (!code || poosListening) return;
  poosListening = true;
  listenToPoos(code);
}
let olderPoo = [];
function setPoos() {
  const seen = new Set(windowPoos.map(p => p.id));
  latestPoos = [...windowPoos, ...olderPoo.filter(p => !seen.has(p.id))].sort((a, b) => b.timestamp - a.timestamp);
  renderSinceLastPoo();
  renderPooStats();
  renderPooHistory();
}
function listenToPoos(code) {
  const cutoff = startOfToday() - FEED_WINDOW_DAYS * 86400000;
  onSnapshot(query(poosCollection(code), where('timestamp', '>=', cutoff), orderBy('timestamp', 'desc')), (snapshot) => {
    windowPoos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    poosLoaded = true;
    setPoos();
  }, handleListenError);
  onSnapshot(query(poosCollection(code), where('timestamp', '<', cutoff), orderBy('timestamp', 'desc'), limit(1)), (snapshot) => {
    olderPoo = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setPoos();
  }, handleListenError);
}

function renderSinceLastPoo() {
  if (!poosLoaded) {
    sinceLastPooEl.textContent = '—';
    lastPooDetailEl.textContent = 'Loading…';
    return;
  }
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
  if (!poosLoaded) {
    pooTodayCountEl.textContent = '—';
    pooAvgGapEl.textContent = '—';
    return;
  }
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
  if (!poosLoaded) {
    pooHistoryList.innerHTML = '';
    pooHistoryEmpty.hidden = true;
    return;
  }
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
        ${poo.note ? `<span class="poo-note-row"><svg class="ico" aria-hidden="true"><use href="#i-chat"/></svg><span>${escapeHtml(poo.note)}</span></span>` : ''}
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


// --- Log a poo sheet ---
// The same shape as Log a feed: When (Today or Other day, then the time wheels), then the one choice that is particular
// to a poo, its size, as three cards, then an optional note. The time starts on now, since a poo is usually logged
// straight away, and a size is optional.
const pooHours = document.getElementById('poo-hours');
const pooMins = document.getElementById('poo-mins');
buildTimeColumn(pooHours, 24);
buildTimeColumn(pooMins, 60);

function readPooWheel() {
  highlightTimeColumn(pooHours);
  highlightTimeColumn(pooMins);
  pooTimeInput.value = `${String(timeColumnIndex(pooHours)).padStart(2, '0')}:${String(timeColumnIndex(pooMins)).padStart(2, '0')}`;
}
function setPooWheel(hours, minutes) {
  pooHours.scrollTo({ top: hours * TIME_ROW, behavior: 'auto' });
  pooMins.scrollTo({ top: minutes * TIME_ROW, behavior: 'auto' });
  readPooWheel();
}
[pooHours, pooMins].forEach((col) => {
  col.addEventListener('scroll', readPooWheel);
  col.addEventListener('click', (e) => {
    const item = e.target.closest('.tw-item');
    if (!item) return;
    col.scrollTo({ top: Number(item.dataset.v) * TIME_ROW, behavior: 'smooth' });
    readPooWheel();
  });
  col.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    col.scrollTo({ top: Math.max(0, Math.min(col.children.length - 1, timeColumnIndex(col) + d)) * TIME_ROW, behavior: 'smooth' });
  });
});

function setPooDay(dateStr, forceOther = false) {
  pooDateInput.value = dateStr;
  const which = forceOther || dateStr !== dateStringForOffset(0) ? 'other' : '0';
  pooDayChips.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.offset === which));
  pooDateInput.hidden = which !== 'other';
}
pooDayChips.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.offset === 'other') setPooDay(pooDateInput.value || dateStringForOffset(0), true);
  else setPooDay(dateStringForOffset(0));
});
pooDateInput.addEventListener('change', () => { if (pooDateInput.value) setPooDay(pooDateInput.value, true); });

function highlightPooSizeChip() {
  pooSizeChips.querySelectorAll('.psize').forEach(c => {
    const on = c.dataset.size === selectedPooSize;
    c.classList.toggle('selected', on);
    c.setAttribute('aria-pressed', String(on));
  });
}

pooSizeChips.querySelectorAll('.psize').forEach(chip => {
  chip.addEventListener('click', () => {
    selectedPooSize = selectedPooSize === chip.dataset.size ? '' : chip.dataset.size;
    highlightPooSizeChip();
  });
});

function openPooTimeModal(poo) {
  editingPooId = poo ? poo.id : null;
  const baseTime = poo ? new Date(poo.timestamp) : new Date();
  pooDateInput.max = todayDateString();
  setPooDay(`${baseTime.getFullYear()}-${String(baseTime.getMonth() + 1).padStart(2, '0')}-${String(baseTime.getDate()).padStart(2, '0')}`);
  selectedPooSize = poo?.size || '';
  highlightPooSizeChip();
  pooNoteInput.value = poo?.note || '';
  pooTimeModalTitle.lastChild.textContent = poo ? 'Edit poo' : 'Log a poo';
  pooTimeConfirm.textContent = poo ? 'Save' : 'Log poo';
  pooTimeModal.hidden = false;
  // The wheels can only be positioned once the sheet is on screen.
  setPooWheel(baseTime.getHours(), baseTime.getMinutes());
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
  btnStartFeedSub.textContent = isPending ? 'Add the amount' : '';
}

function renderSinceLastFeed() {
  const last = latestFeeds[0];
  const isPending = !!last && last.amountMl == null;
  heroCard.classList.toggle('hero-pending', isPending);
  updateFeedActionButtons(isPending);
  if (!last) {
    if (!feedsLoaded) {
      lastFeedLabelEl.textContent = 'Last feed';
      sinceLastFeedEl.textContent = '—';
      lastFeedDetailEl.textContent = '';
      return;
    }
    lastFeedLabelEl.textContent = profileFirstName ? `Ready for ${profileFirstName}’s first feed` : 'Ready for the first feed';
    sinceLastFeedEl.textContent = 'No feeds yet';
    sinceLastFeedEl.classList.add('is-empty');
    lastFeedDetailEl.textContent = '';
    return;
  }
  lastFeedLabelEl.textContent = 'Last feed';
  sinceLastFeedEl.classList.remove('is-empty');
  const since = durationString(Date.now() - last.timestamp);
  if (isPending) {
    pendingTimeEl.textContent = since;
    pendingTimeEl.classList.toggle('long', since.length > 4); // "1h 12m" has to fit inside the ring
    pendingDetailEl.textContent = `Started at ${formatClock(last.timestamp)}`;
  } else {
    sinceLastFeedEl.textContent = since;
    lastFeedDetailEl.textContent = `ago · ${fmtAmount(last.amountMl)}`;
  }
}

// The next feed is a guess, so a late feed is never "overdue": the pill and line turn amber and say how long ago it was expected.
function renderNextFeed() {
  syncReminder();
  const last = latestFeeds[0];
  nextFeedLabelEl.textContent = 'Next feed';
  nextFeedInEl.classList.remove('late');
  heroLine.classList.remove('late');
  lateCalmEl.hidden = true;
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
    lateCalmEl.hidden = false;
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
  todayBottle.setAttribute('aria-label', `Today's milk so far: ${fmtAmount(total)}, about ${Math.round(fill * 100)}% of a usual day`);
}

function renderHeaderDate() {
  const label = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  appDateEl.textContent = label;
  pooDateEl.textContent = label;
  homeDateEl.textContent = label;
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
  }, handleListenError);
}

// What the bottle row should show right now.
//   made:   a bottle was made and no feed has started from it. Good for 2 hours from when it was made.
//   in use: a feed started. Good for 1 hour from the start of the feed, but never past 2 hours from when the bottle
//           was made. So a bottle made 90 minutes before the feed has 30 minutes left, not a fresh hour.
function bottleState(now = Date.now()) {
  const feeding = bottleFeedStartedAt && (!bottleMadeAt || bottleMadeAt <= bottleFeedStartedAt);
  if (feeding) {
    const byFeed = bottleFeedStartedAt + BOTTLE_IN_USE_MS;
    const byMade = bottleMadeAt ? bottleMadeAt + BOTTLE_GOOD_FOR_MS : Infinity;
    const expiresAt = Math.min(byFeed, byMade);
    // After the reminder has been shown for a while the row goes back to idle on its own.
    if (now > expiresAt + BOTTLE_IN_USE_NOTICE_MS) return { kind: 'idle' };
    return { kind: 'inUse', expiresAt, startedAt: bottleFeedStartedAt, cutShort: byMade < byFeed };
  }
  if (bottleMadeAt) return { kind: 'made', expiresAt: bottleMadeAt + BOTTLE_GOOD_FOR_MS, startedAt: bottleMadeAt };
  return { kind: 'idle' };
}

// Idle, the row shows a formula scoop. Once a timer is running the scoop turns into a small bottle whose
// level drains as the time runs out (--left goes from 1 to 0).
function renderBottleStatus() {
  const now = Date.now();
  const state = bottleState(now);
  const timing = state.kind !== 'idle';
  bottlePillClear.hidden = !timing;
  bottlePillAdjust.hidden = timing;
  bottlePill.classList.toggle('timing', timing);
  bottlePill.classList.remove('bottle-expired');
  if (!timing) {
    bottleTitleEl.textContent = 'Made a bottle?';
    bottleStatusEl.textContent = 'Tap to start';
    bottlePill.style.setProperty('--left', '1');
    return;
  }
  const remaining = state.expiresAt - now;
  const span = Math.max(1, state.expiresAt - state.startedAt);
  bottlePill.style.setProperty('--left', Math.max(0, Math.min(1, remaining / span)).toFixed(3));
  bottleTitleEl.textContent = state.kind === 'inUse' ? 'Bottle in use' : 'Bottle made';
  if (remaining > 0) {
    bottleStatusEl.textContent = `Good for ${durationString(remaining)}`;
    return;
  }
  bottlePill.classList.add('bottle-expired');
  if (state.kind === 'made' || state.cutShort) bottleStatusEl.textContent = 'Over 2 hours since it was made. Discard it';
  else bottleStatusEl.textContent = 'Over 1h since the feed started. Discard what is left';
}

async function startBottleTimer(minsAgo) {
  const code = getHouseholdCode();
  if (!code) return;
  inBackground(setDoc(bottleDocRef(code), { madeAt: Date.now() - minsAgo * 60000, feedStartedAt: null }, { merge: true }), 'Could not save. Check your connection');
  showToast(minsAgo > 0 ? `Bottle timer started (${minsAgo}m ago)` : 'Bottle timer started');
}


bottlePillClear.addEventListener('click', async () => {
  const code = getHouseholdCode();
  if (!code) return;
  inBackground(setDoc(bottleDocRef(code), { madeAt: null, feedStartedAt: null }, { merge: true }), 'Could not save. Check your connection');
  showToast('Bottle timer cleared');
});

// --- Bottle adjust wheel picker ---

const bottleAdjustWheelValues = [];
for (let v = 0; v <= BOTTLE_ADJUST_MAX_MINS; v += BOTTLE_ADJUST_STEP_MINS) bottleAdjustWheelValues.push(v);

function formatBottleAdjustLabel(mins) {
  if (mins === 0) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''} ago`;
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

// "Earlier" asks when the bottle was made, starting on "Just now", so a bottle made a while ago can be
// set correctly.
function openBottleAdjust() {
  // Only a bottle that is still waiting to be used can be corrected; anything else starts a new one.
  const waiting = bottleState().kind === 'made';
  const minsAgo = waiting ? Math.round((Date.now() - bottleMadeAt) / 60000 / BOTTLE_ADJUST_STEP_MINS) * BOTTLE_ADJUST_STEP_MINS : 0;
  selectedBottleMinsAgo = Math.max(0, Math.min(BOTTLE_ADJUST_MAX_MINS, minsAgo));
  bottleAdjustConfirm.textContent = waiting ? 'Update timer' : 'Start timer';
  bottleAdjustModal.hidden = false;
  scrollBottleAdjustWheelTo(selectedBottleMinsAgo);
  updateBottleAdjustWheelActiveItem();
}
// One tap on the row starts the timer from now. "Earlier" opens the picker for a bottle made a while ago.
bottlePillMain.addEventListener('click', () => startBottleTimer(0));
bottlePillAdjust.addEventListener('click', openBottleAdjust);
bottleAdjustCancel.addEventListener('click', () => { bottleAdjustModal.hidden = true; });
bottleAdjustConfirm.addEventListener('click', () => {
  // Read the wheel while it is still on screen, in case Start was tapped before the wheel had settled.
  const minsAgo = updateBottleAdjustWheelActiveItem();
  bottleAdjustModal.hidden = true;
  startBottleTimer(minsAgo);
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
  setChartStat(0, completeDays.length ? fmtAmount(dayAvg) : '—', 'Avg / day');
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
    svg += `<text class="hc-axis" x="${CHART_LEFT - 4}" y="${y(v) + 3}" text-anchor="end">${amountNumber(v)}</text>`;
  }
  if (avg) {
    svg += `<line class="hc-avg" x1="${CHART_LEFT}" x2="${width - CHART_RIGHT}" y1="${y(avg)}" y2="${y(avg)}"/>`;
    svg += `<text class="hc-axis" x="${CHART_LEFT + 4}" y="${y(avg) - 4}">avg ${fmtAmount(avg)}</text>`;
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
    svg += `<text class="hc-val" x="${CHART_LEFT + selectedIndex * slot + slot / 2}" y="${y(sel.value) - 5}" text-anchor="middle">${amountNumber(sel.value)}</text>`;
  }

  historyChartSvg.setAttribute('viewBox', `0 0 ${width} ${CHART_H}`);
  historyChartSvg.style.width = width > CHART_MIN_WIDTH ? `${width}px` : '100%';
  historyChartSvg.innerHTML = svg;
  if (selectionReset) historyChartScroll.scrollLeft = historyChartScroll.scrollWidth;

  historyChartCaption.textContent = byWeek
    ? `Total ${unit} per week, each week starting Monday. Tap a bar to see that week.`
    : `Total ${unit} each day. Tap a bar to see that day.`;
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
    headerLi.innerHTML = `<span class="day-group-label">${dayLabelForKey(key)}${isToday ? ` · ${dayFeeds.length} ${dayFeeds.length === 1 ? 'feed' : 'feeds'}` : ''}</span><span class="day-group-total">${fmtAmount(dayTotal)}</span>`;
    historyList.appendChild(headerLi);

    for (const feed of dayFeeds) {
      const fullIndex = latestFeeds.indexOf(feed);
      const older = latestFeeds[fullIndex + 1];
      const gap = older ? durationString(feed.timestamp - older.timestamp) : '—';
      const amountHtml = feed.amountMl != null
        ? `<span class="history-amount-val">${fmtAmount(feed.amountMl)}</span>`
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
    if (currentRange === 'all') ensureOlderFeeds();
    chartSelectedStart = null;
    historyRange.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
    seg.classList.add('active');
    renderHistory();
  });
});

// Firestore finishes a write only once the server has confirmed it, which can mean a long wait with no signal. The entry
// already shows on screen from the phone's own copy, so messages and follow-up steps never wait for that confirmation.
// A write that is turned down (rather than just waiting) still tells the user.
function inBackground(write, failMessage) {
  Promise.resolve(write).catch((e) => {
    console.error(e);
    diag(`save failed: ${e.code || e.message}`);
    if (failMessage) showToast(failMessage);
  });
}
async function restoreDeleted(kind, item) {
  const code = getHouseholdCode();
  if (!code || !item) return;
  const { id, ...data } = item;
  inBackground(setDoc(doc(db, 'households', code, kind, id), data), 'Could not put it back. Check your connection');
  showToast(kind === 'feeds' ? 'Feed put back' : 'Poo put back');
}
async function deletePoo(id) {
  const code = getHouseholdCode();
  if (!code) return;
  const removed = latestPoos.find(p => p.id === id);
  inBackground(deleteDoc(doc(db, 'households', code, 'poos', id)), 'Could not delete. Check your connection');
  showToast('Poo deleted', { label: 'Undo', run: () => restoreDeleted('poos', removed) });
}
async function deleteFeed(id) {
  const code = getHouseholdCode();
  if (!code) return;
  const removed = latestFeeds.find(f => f.id === id);
  inBackground(deleteDoc(doc(db, 'households', code, 'feeds', id)), 'Could not delete. Check your connection');
  showToast('Feed deleted', { label: 'Undo', run: () => restoreDeleted('feeds', removed) });
}

async function logPoo(timestamp, size, note) {
  const code = getHouseholdCode();
  if (!code) return;
  inBackground(addDoc(poosCollection(code), {
    timestamp,
    ...(size ? { size } : {}),
    ...(note ? { note } : {}),
  }), 'Could not log poo. Check your connection');
  showToast('Poo logged');
}

async function updatePoo(id, timestamp, size, note) {
  const code = getHouseholdCode();
  if (!code) return;
  inBackground(updateDoc(doc(db, 'households', code, 'poos', id), {
    timestamp,
    size: size || deleteField(),
    note: note || deleteField(),
  }), 'Could not save. Check your connection');
  showToast('Poo updated');
}

// Between 23:00 and 05:00 the message after a feed is a warmer one. Daytime keeps the plain one.
const NIGHT_FEED_MESSAGES = [
  'Feed logged. Get some rest.',
  'Feed logged. Back to sleep when you can.',
  'Feed logged. You’re doing well.',
  'Feed logged. Night feeds don’t last forever.',
];
function feedDoneMessage(plain) {
  const h = new Date().getHours();
  if (h >= 23 || h < 5) return NIGHT_FEED_MESSAGES[Math.floor(Math.random() * NIGHT_FEED_MESSAGES.length)];
  return plain;
}

async function logFeed(timestamp, amountMl, intervalHours) {
  const code = getHouseholdCode();
  if (!code) return;
  inBackground(addDoc(feedsCollection(code), {
    type: 'bottle',
    timestamp,
    amountMl,
    intervalHours,
  }), 'Could not log feed. Check your connection');
  showToast(feedDoneMessage('Feed logged'));
}

async function startFeed(timestamp, intervalHours) {
  const code = getHouseholdCode();
  if (!code) return;
  inBackground(addDoc(feedsCollection(code), {
    type: 'bottle',
    timestamp,
    intervalHours,
  }), 'Could not start feed. Check your connection');
  showToast('Feed started');
  // The bottle is now being drunk from: it is good for 1 hour from now, or until 2 hours after it was made if that
  // comes first. The made time is kept so that limit can be worked out (see bottleState).
  inBackground(setDoc(bottleDocRef(code), { feedStartedAt: timestamp }, { merge: true }));
}

async function finishFeed(id, timestamp, amountMl, intervalHours, completing = false) {
  const code = getHouseholdCode();
  if (!code) return;
  inBackground(updateDoc(doc(db, 'households', code, 'feeds', id), { timestamp, amountMl, intervalHours }), 'Could not save. Check your connection');
  showToast(completing ? feedDoneMessage('Feed logged') : 'Feed updated');
  // The feed is over, so the bottle that was being drunk from is done with. A fresh bottle made since is left alone.
  if (completing && bottleFeedStartedAt && (!bottleMadeAt || bottleMadeAt <= bottleFeedStartedAt)) {
    inBackground(setDoc(bottleDocRef(code), { madeAt: null, feedStartedAt: null }, { merge: true }));
  }
}

// No question first: the Undo message puts the feed back exactly as it was, the same as for poos.
function openConfirmDeleteModal(feedId) {
  deleteFeed(feedId);
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

// --- Bottle: the brand picked in Profile decides which bottle is drawn on the Feeds screen ---
// Every brand uses the MAM-style drawing for now; add a design to BOTTLE_DESIGNS and point a brand at it to give it its own.
const BOTTLE_BRANDS = [
  { id: 'mam', name: 'MAM', design: 'mam' },
  { id: 'drbrowns', name: "Dr. Brown's", design: 'mam' },
  { id: 'avent', name: 'Philips Avent', design: 'mam' },
  { id: 'tommee', name: 'Tommee Tippee', design: 'mam' },
  { id: 'nuk', name: 'NUK', design: 'mam' },
  { id: 'comotomo', name: 'Comotomo', design: 'mam' },
  { id: 'medela', name: 'Medela', design: 'mam' },
  { id: 'lansinoh', name: 'Lansinoh', design: 'mam' },
  { id: 'chicco', name: 'Chicco', design: 'mam' },
  { id: 'other', name: 'Another brand', design: 'mam' },
];

const MAM_BODY = 'M20 50H80C81 62 82 70 80 80C78 94 90 106 94 124Q95 150 76 150H24Q5 150 6 124C10 106 22 94 20 80C18 70 19 62 20 50Z';
const BOTTLE_DESIGNS = {
  // A short, soft bottle: dome hood over the teat, rounded collar, body that narrows under the collar and flares to a
  // rounded base with a lighter band and a vent. The milk runs from y=140 (empty) to y=66 (full): a 74 unit range.
  mam: {
    viewBox: '-4 -2 108 158',
    range: '74px',
    inner: `<defs><clipPath id="bottle-body"><path d="${MAM_BODY}"/></clipPath></defs>
      <path class="glass" d="${MAM_BODY}"/>
      <g clip-path="url(#bottle-body)"><g class="milk">
        <path class="wave" d="M-60 64c8-5 16-5 25 0s16 5 25 0 16-5 25 0 16 5 25 0 16-5 25 0 16 5 25 0 16-5 25 0 16 5 25 0 16-5 25 0 16 5 25 0V160H-60z"/>
        <circle class="bub" cx="32" cy="136" r="2.4"/><circle class="bub b2" cx="52" cy="140" r="2"/><circle class="bub b3" cx="70" cy="133" r="1.8"/></g>
        <path class="foot" d="M0 131H100V156H0Z"/></g>
      <path class="tick" d="M64 138h8M64 124h5M64 110h8M64 96h5M64 82h8"/>
      <path class="rim" d="${MAM_BODY}"/>
      <circle class="vent" cx="50" cy="141" r="5"/><circle class="vent2" cx="50" cy="141" r="1.6"/>
      <path class="hood" d="M26 40C24 22 34 4 50 1C66 4 76 22 74 40Z"/>
      <path class="nipple" d="M40 40C39 24 44 12 51 10C58 10 61 24 60 40Z"/>
      <rect class="collar" x="22" y="34" width="56" height="18" rx="8"/>
      <path class="ridge" d="M28 41h44M28 47h44"/>`,
  },
};

let selectedBottleBrand = 'mam';
let bottleBrandScrollTimer = null;

function setBottleDesign(designKey) {
  const design = BOTTLE_DESIGNS[designKey] || BOTTLE_DESIGNS.mam;
  todayBottle.setAttribute('viewBox', design.viewBox);
  todayBottle.style.setProperty('--range', design.range);
  todayBottle.innerHTML = design.inner;
}

function applyBottleBrand() {
  const brand = BOTTLE_BRANDS.find(b => b.id === selectedBottleBrand) || BOTTLE_BRANDS[0];
  setBottleDesign(brand.design);
}

BOTTLE_BRANDS.forEach((brand) => {
  const item = document.createElement('div');
  item.className = 'wheel-item';
  item.setAttribute('role', 'option');
  item.textContent = brand.name;
  item.dataset.id = brand.id;
  bottleBrandTrack.appendChild(item);
});

function scrollBottleBrandWheelTo(id, smooth = false) {
  const index = Math.max(0, BOTTLE_BRANDS.findIndex(b => b.id === id));
  bottleBrandTrack.scrollTo({ top: index * WHEEL_ITEM_HEIGHT, behavior: smooth ? 'smooth' : 'auto' });
  highlightBottleBrandItem(index);
}

function highlightBottleBrandItem(index) {
  bottleBrandTrack.querySelectorAll('.wheel-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
    el.setAttribute('aria-selected', String(i === index));
  });
}

bottleBrandTrack.addEventListener('scroll', () => {
  const index = Math.max(0, Math.min(BOTTLE_BRANDS.length - 1, Math.round(bottleBrandTrack.scrollTop / WHEEL_ITEM_HEIGHT)));
  highlightBottleBrandItem(index);
  clearTimeout(bottleBrandScrollTimer);
  bottleBrandScrollTimer = setTimeout(() => {
    selectedBottleBrand = BOTTLE_BRANDS[index].id;
    applyBottleBrand();
  }, 120);
});

bottleBrandTrack.addEventListener('keydown', (e) => {
  const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
  if (!d) return;
  e.preventDefault();
  const index = Math.max(0, Math.min(BOTTLE_BRANDS.length - 1, Math.round(bottleBrandTrack.scrollTop / WHEEL_ITEM_HEIGHT) + d));
  bottleBrandTrack.scrollTo({ top: index * WHEEL_ITEM_HEIGHT, behavior: 'smooth' });
});

// --- Profile ---
// Nothing here has a Save button: every change is written as soon as it is made, and only the field that changed.

async function saveProfileFields(fields) {
  const code = getHouseholdCode();
  if (!code) return false;
  try {
    await setDoc(profileDocRef(code), fields, { merge: true });
    return true;
  } catch (e) {
    console.error(e);
    showToast('Could not save. Check your connection');
    return false;
  }
}

function openBabySheet() {
  profileNameInput.value = profileFirstName;
  profileLastNameInput.value = profileLastName;
  profileDobInput.value = profileDob;
  profileDobInput.max = todayDateString();
  babySheet.hidden = false;
  if (!profileFirstName) profileNameInput.focus();
}
document.getElementById('edit-baby').addEventListener('click', openBabySheet);
yearNudge.addEventListener('click', openBabySheet);
document.getElementById('baby-cancel').addEventListener('click', () => { babySheet.hidden = true; });
babySheet.addEventListener('click', (e) => { if (e.target === babySheet) babySheet.hidden = true; });
document.getElementById('baby-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fields = {
    firstName: profileNameInput.value.trim(),
    lastName: profileLastNameInput.value.trim(),
    dob: profileDobInput.value,
  };
  babySheet.hidden = true;
  // Show the change straight away; the saved copy arriving from the server then confirms it.
  profileFirstName = fields.firstName;
  profileLastName = fields.lastName;
  profileDob = fields.dob;
  renderProfilePreview();
  renderProfileAge();
  await saveProfileFields(fields);
});

profileSaveBtn.addEventListener('click', finishProfileOnboarding);
profileSkipBtn.addEventListener('click', finishProfileOnboarding);

// --- Trends & Facts ---

// One calm line a week on Trends, where parents are most likely to compare. About perspective, never about amounts or
// anything medical; the last one says where to turn if something feels wrong.
const FUN_BABY_FACTS = [
  'Every baby feeds differently, and that’s fine.',
  'Some days are hungrier than others.',
  'Your baby’s pattern is the only one that matters.',
  'Feeds won’t always match the clock, and that’s okay.',
  'Comparing with other babies rarely helps. Watch your own.',
  'A messy day of feeds is still a day of feeding.',
  'You know your baby better than any app does.',
  'Taking turns at night helps everyone rest.',
  'Early weeks can be unpredictable. That’s part of it.',
  'Logging is for you, not a test. Missed one? Add it later, or let it go.',
  'Small feeds and big feeds all count.',
  'If something feels wrong, your health visitor is there to help.',
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
  if (v.status === 'recognised') text = `${changeWord(v, 'Up', 'Down')} two weeks in a row. It was ${fmtAmount(before)} last week.`;
  else if (v.status === 'emerging') text = `${changeWord(v, 'Up', 'Down')} from ${fmtAmount(before)} last week.`;
  else if (v.status === 'early') text = `The last few days. Before that it was ${fmtAmount(before)}.`;
  else text = 'Holding steady from week to week.';
  const chart = patternBarsSvg(r.dailyTotals.map((d) => d.v), {
    max: Math.max(...r.dailyTotals.map((d) => d.v)),
    label: `Milk per day for the last ${r.dailyTotals.length} days`,
  });
  return trendItem({ short: 'Milk per day', title: 'Milk per day', badge: trendBadge(v), tier: trendTier(v),
    value: fmtAmount(Math.round(v.recent)), unit: 'a day', text, extra: chart, note: `Each bar is one day, last ${r.dailyTotals.length} days.` });
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
  const firstFeedTs = oldestFeedTs ?? (latestFeeds.length ? latestFeeds[latestFeeds.length - 1].timestamp : null);
  const dayCount = firstFeedTs == null ? 0 : Math.round((startOfToday() - dayKeyForTimestamp(firstFeedTs)) / 86400000) + 1;
  trendsSubEl.textContent = dayCount ? `From ${dayCount} ${dayCount === 1 ? 'day' : 'days'} of feeds` : 'From the feed log';

  const items = trendItems(r);
  const est = items.filter((i) => i.tier === 'est');
  const maybe = items.filter((i) => i.tier === 'maybe');
  let html = trendsHero(r);
  if (!items.length) {
    html += `<div class="th"><h2>Patterns</h2><p>The first weeks are unpredictable. Patterns show up later, as you keep logging.</p></div>`;
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

// Every time Milestones is opened it starts on the month we are in. A baby older than a year (or a date before the
// birth month) is kept inside the first-year range, so the calendar never opens on a month it can't show.
function ensureCalendarInitialized() {
  calendarInitialized = true;
  const now = new Date();
  let idx = now.getFullYear() * 12 + now.getMonth();
  const bounds = computeFirstYearBounds();
  if (bounds) {
    idx = Math.max(bounds.startYear * 12 + bounds.startMonth, Math.min(bounds.endYear * 12 + bounds.endMonth, idx));
  }
  currentCalYear = Math.floor(idx / 12);
  currentCalMonth = idx % 12;
  loadMonth(currentCalYear, currentCalMonth);
}

function loadMonth(year, month) {
  const monthKey = dateKeyFor(year, month, 1);
  // Already watching this month: keep what is loaded instead of blanking the calendar and asking again.
  if (currentMonthUnsub && loadedMonthKey === monthKey) {
    renderCalendar();
    return;
  }
  if (currentMonthUnsub) {
    currentMonthUnsub();
    currentMonthUnsub = null;
  }
  loadedMonthKey = monthKey;
  currentMonthMilestones = new Map();
  renderCalendar();

  const code = getHouseholdCode();
  if (!code) return;
  const startKey = monthKey;
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
  }, handleListenError);
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

// The first time someone adds a photo, say plainly who can see it.
const PHOTO_NOTICE_KEY = 'babyfeed_photo_notice_done';
const photoNoticeModal = document.getElementById('photo-notice-modal');
milestonePhotoBtn.addEventListener('click', () => {
  if (readFlag(PHOTO_NOTICE_KEY)) { milestonePhotoInput.click(); return; }
  photoNoticeModal.hidden = false;
});
document.getElementById('photo-notice-cancel').addEventListener('click', () => { photoNoticeModal.hidden = true; });
document.getElementById('photo-notice-go').addEventListener('click', () => {
  setFlag(PHOTO_NOTICE_KEY);
  photoNoticeModal.hidden = true;
  milestonePhotoInput.click();
});

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
  if (!caption && !pendingPhotoDataUrl && !existing?.photoDataUrl) {
    showToast('Add a photo or a note first');
    return;
  }
  // Only what changed is written, and it is merged into the saved entry. The photo is sent only when a new one was
  // picked, so editing the note can never remove a photo, even if this month's entries had not finished loading.
  const changes = { caption: caption || deleteField(), updatedAt: Date.now() };
  if (pendingPhotoDataUrl) changes.photoDataUrl = pendingPhotoDataUrl;
  try {
    await setDoc(doc(db, 'households', code, 'milestones', editingDateKey), changes, { merge: true });
    showToast('Moment saved');
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
    showToast('Moment deleted');
    milestoneModal.hidden = true;
  } catch (e) {
    console.error(e);
    showToast('Could not delete');
  }
});

// --- Log a feed sheet ---
// One sheet does three jobs: log a past feed, add the amount to a feed that was started, and change a saved feed.
// The amount is one scroll wheel, as on the live site. Under it are the time and a small stepper for the next feed.
// A new past feed starts with the time empty, so it is always typed in and never guessed.

let sheetMode = 'log'; // 'log' | 'complete' | 'edit'
let amountValues = [];
const AMOUNT_ROW = 44; // height of one wheel row in px; must match .amt-item in style.css

function formatIntervalLabel(hours) {
  const whole = Math.floor(hours);
  return hours % 1 === 0 ? `${whole}h` : `${whole}h 30m`;
}

// The wheel holds 10 to 300ml in 5ml steps, or in ounces a quarter ounce at a time. Either way the value it hands back
// is ml. An older feed with an odd amount (say 123ml) gets its own row, so editing a feed never changes its amount.
function buildAmountWheel(extra) {
  const values = [];
  const labels = new Map();
  if (unit === 'oz') {
    for (let q = 1; q <= 40; q++) {
      const ml = Math.round((q * ML_PER_OZ) / 4);
      values.push(ml);
      labels.set(ml, String(q / 4));
    }
  } else {
    for (let v = ML_MIN; v <= ML_MAX; v += ML_STEP) values.push(v);
  }
  if (extra != null && !values.includes(extra)) { values.push(extra); values.sort((a, b) => a - b); }
  amountValues = values;
  amountTrack.innerHTML = values.map(v => `<div class="amt-item" role="option" data-v="${v}">${labels.get(v) ?? amountNumber(v)}<small>${unit}</small></div>`).join('');
}
function nearestAmount(ml) {
  return amountValues.reduce((best, v) => (Math.abs(v - ml) < Math.abs(best - ml) ? v : best), amountValues[0]);
}

function amountIndexAtScroll() {
  return Math.max(0, Math.min(amountValues.length - 1, Math.round(amountTrack.scrollTop / AMOUNT_ROW)));
}

function highlightAmount(index) {
  amountTrack.querySelectorAll('.amt-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
    el.classList.toggle('near', Math.abs(i - index) === 1);
    el.setAttribute('aria-selected', String(i === index));
  });
}

function scrollAmountTo(value, smooth = false) {
  const index = Math.max(0, amountValues.indexOf(value));
  amountTrack.scrollTo({ top: index * AMOUNT_ROW, behavior: smooth ? 'smooth' : 'auto' });
  highlightAmount(index);
}

amountTrack.addEventListener('scroll', () => {
  const index = amountIndexAtScroll();
  highlightAmount(index);
  if (amountValues[index] !== selectedMl) onAmountChanged(amountValues[index]);
});

amountTrack.addEventListener('click', (e) => {
  const item = e.target.closest('.amt-item');
  if (item) scrollAmountTo(Number(item.dataset.v), true);
});

amountTrack.addEventListener('keydown', (e) => {
  const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
  if (!d) return;
  e.preventDefault();
  const index = Math.max(0, Math.min(amountValues.length - 1, amountIndexAtScroll() + d));
  scrollAmountTo(amountValues[index], true);
});

function lastCompletedAmount(excludeId) {
  const f = latestFeeds.find(x => x.amountMl != null && x.id !== excludeId);
  return f ? f.amountMl : null;
}

function dateStringForOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Most feeds are logged for today, so the day is a two-way switch. "Other day" shows the phone's date picker
// beside the time.
function setFeedDay(dateStr, forceOther = false) {
  feedDateInput.value = dateStr;
  const which = forceOther ? 'other' : dateStr === dateStringForOffset(0) ? '0' : dateStr === dateStringForOffset(1) ? '1' : 'other';
  feedDayChips.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.offset === which));
  feedDateInput.hidden = which !== 'other';
}

feedDayChips.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.offset === 'other') setFeedDay(feedDateInput.value || dateStringForOffset(0), true);
  else setFeedDay(dateStringForOffset(Number(btn.dataset.offset)));
  drawSheet();
});


function pickedTimeTs() {
  if (!feedDateInput.value || !feedTimeInput.value) return null;
  return combineDateTimeToTimestamp(feedDateInput.value, feedTimeInput.value);
}

function drawSheet() {
  drawGapChips();
  const ts = pickedTimeTs();
  logConfirm.disabled = ts == null;
  if (sheetMode === 'log') logConfirm.textContent = ts == null ? 'Choose the time' : 'Log feed';
  else logConfirm.textContent = sheetMode === 'complete' ? 'Save amount' : 'Save';
  // A past feed can also be saved with just its time. It then waits for its amount, like a feed that was started.
  logTimeOnly.hidden = sheetMode !== 'log';
  logTimeOnly.disabled = ts == null;
}

function onAmountChanged(value) {
  selectedMl = value;
  const lastAmt = lastCompletedAmount(editingFeedId);
  if (sheetMode === 'edit' || lastAmt == null) sheetHint.textContent = '';
  else sheetHint.textContent = (unit === 'oz' ? Math.abs(value - lastAmt) < 4 : value === lastAmt) ? 'Same as the last feed' : `Last feed was ${fmtAmount(lastAmt)}`;
  // The gap follows the amount until it is changed by hand.
  if (!intervalOverridden) selectedIntervalHours = computeAutoIntervalHours(value);
  drawSheet();
}

// The gap is a row of buttons that scrolls sideways: the usual gaps are in view, shorter and longer ones are a swipe
// away. The chosen one is kept in the middle.
const gapButtons = [];
let gapShown = null;
for (let h = INTERVAL_MIN; h <= INTERVAL_MAX; h += INTERVAL_STEP) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = h % 1 ? `${Math.floor(h)}½` : String(h);
  btn.setAttribute('aria-label', formatIntervalLabel(h));
  btn.addEventListener('click', () => {
    selectedIntervalHours = h;
    intervalOverridden = true;
    drawSheet();
  });
  gapChips.appendChild(btn);
  gapButtons.push({ h, btn });
}
// The time the wheels are showing, whether or not it has been chosen yet, so the next feed can be previewed straight away.
function shownTimeTs() {
  if (!feedDateInput.value) return null;
  const hhmm = `${String(timeColumnIndex(timeHours)).padStart(2, '0')}:${String(timeColumnIndex(timeMins)).padStart(2, '0')}`;
  return combineDateTimeToTimestamp(feedDateInput.value, hhmm);
}
function drawGapChips() {
  const base = shownTimeTs();
  document.getElementById('gap-at').textContent = base == null ? '' : `around ${formatClock(base + selectedIntervalHours * 3600000)}`;
  let chosen = null;
  for (const { h, btn } of gapButtons) {
    const on = h === selectedIntervalHours;
    btn.setAttribute('aria-pressed', String(on));
    if (on) chosen = btn;
  }
  // Only move the row when the choice itself changes, so swiping along it to look is never undone.
  if (!chosen || logModal.hidden || gapShown === selectedIntervalHours) return;
  const left = chosen.offsetLeft - (gapChips.clientWidth - chosen.offsetWidth) / 2;
  // Jump when the sheet has just opened, glide when the choice moves while it is open.
  gapChips.scrollTo({ left, behavior: gapShown == null ? 'auto' : 'smooth' });
  gapShown = selectedIntervalHours;
}

['input', 'change'].forEach(evt => {
  feedDateInput.addEventListener(evt, drawSheet);
  feedTimeInput.addEventListener(evt, drawSheet);
});

// --- Time wheel: hours and minutes you scroll, right in the sheet ---
// For a new past feed the wheels start on the current time as a place to scroll from, but the time only counts once
// a wheel has been touched. Until then the button asks for the time, so a feed is never saved at a guessed time.
const TIME_ROW = 36; // height of one row in px; must match .tw-item in style.css
let timeTouched = false;

function buildTimeColumn(el, count) {
  let html = '';
  for (let i = 0; i < count; i++) html += `<div class="tw-item" role="option" data-v="${i}">${String(i).padStart(2, '0')}</div>`;
  el.innerHTML = html;
}
buildTimeColumn(timeHours, 24);
buildTimeColumn(timeMins, 60);

function timeColumnIndex(el) {
  return Math.max(0, Math.min(el.children.length - 1, Math.round(el.scrollTop / TIME_ROW)));
}

function highlightTimeColumn(el) {
  const index = timeColumnIndex(el);
  Array.from(el.children).forEach((c, i) => {
    c.classList.toggle('active', i === index);
    c.setAttribute('aria-selected', String(i === index));
  });
}

function readTimeWheel() {
  highlightTimeColumn(timeHours);
  highlightTimeColumn(timeMins);
  timeWheel.classList.toggle('unset', !timeTouched);
  feedTimeInput.value = timeTouched
    ? `${String(timeColumnIndex(timeHours)).padStart(2, '0')}:${String(timeColumnIndex(timeMins)).padStart(2, '0')}`
    : '';
  drawSheet();
}

function setTimeWheel(hours, minutes, touched) {
  timeTouched = touched;
  timeHours.scrollTo({ top: hours * TIME_ROW, behavior: 'auto' });
  timeMins.scrollTo({ top: minutes * TIME_ROW, behavior: 'auto' });
  readTimeWheel();
}

[timeHours, timeMins].forEach((col) => {
  // Only a real touch, click, mouse wheel or key press counts as choosing a time; placing the wheel from code does not.
  ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(evt => col.addEventListener(evt, () => { timeTouched = true; }, { passive: true }));
  col.addEventListener('scroll', readTimeWheel);
  col.addEventListener('click', (e) => {
    const item = e.target.closest('.tw-item');
    if (!item) return;
    timeTouched = true;
    col.scrollTo({ top: Number(item.dataset.v) * TIME_ROW, behavior: 'smooth' });
    readTimeWheel();
  });
  col.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    col.scrollTo({ top: Math.max(0, Math.min(col.children.length - 1, timeColumnIndex(col) + d)) * TIME_ROW, behavior: 'smooth' });
  });
});

function openLogModal(feed) {
  editingFeedId = feed ? feed.id : null;
  const isPending = !!feed && feed.amountMl == null;
  sheetMode = !feed ? 'log' : (isPending ? 'complete' : 'edit');

  let startMl = feed?.amountMl ?? lastCompletedAmount(feed?.id) ?? DEFAULT_ML;
  intervalOverridden = !!feed && !isPending;
  selectedIntervalHours = feed?.intervalHours || computeAutoIntervalHours(startMl);
  // In ounces a new feed starts on the nearest quarter ounce; an existing feed keeps its exact ml as its own row.
  buildAmountWheel(unit === 'oz' && feed?.amountMl == null ? null : startMl);
  if (!amountValues.includes(startMl)) startMl = nearestAmount(startMl);

  feedDateInput.max = todayDateString();
  let startTime;
  if (feed) {
    const d = new Date(feed.timestamp);
    setFeedDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    startTime = [d.getHours(), d.getMinutes(), true];
  } else {
    setFeedDay(todayDateString());
    const n = new Date();
    startTime = [n.getHours(), n.getMinutes(), false];
  }

  logModalTitle.textContent = sheetMode === 'log' ? 'Log a feed' : (isPending ? 'Finish feed' : 'Edit feed');
  feedWhenLabel.textContent = isPending ? 'Started' : 'When';
  sheetDel.hidden = sheetMode !== 'edit';
  gapShown = null;
  logModal.hidden = false;
  // The wheel can only be positioned once the sheet is on screen.
  scrollAmountTo(startMl);
  setTimeWheel(startTime[0], startTime[1], startTime[2]);
  onAmountChanged(startMl);
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

let startFeedLockedUntil = 0;
btnStartFeedNow.addEventListener('click', () => {
  if (latestFeeds.length && latestFeeds[0].amountMl == null) {
    openLogModal(latestFeeds[0]);
  } else {
    // A second tap before the first feed has come back from the list would start another one.
    if (Date.now() < startFeedLockedUntil) return;
    startFeedLockedUntil = Date.now() + 2000;
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
  const timestamp = pickedTimeTs();
  if (timestamp == null) return;
  showRangeContaining(timestamp, historyRange, ["1d", "7d", "14d"], (r) => { currentRange = r; chartSelectedStart = null; });
  logModal.hidden = true;
  if (editingFeedId) {
    finishFeed(editingFeedId, timestamp, selectedMl, selectedIntervalHours, sheetMode === 'complete');
    editingFeedId = null;
  } else {
    logFeed(timestamp, selectedMl, selectedIntervalHours);
  }
});

logTimeOnly.addEventListener('click', () => {
  const timestamp = pickedTimeTs();
  if (timestamp == null) return;
  showRangeContaining(timestamp, historyRange, ["1d", "7d", "14d"], (r) => { currentRange = r; chartSelectedStart = null; });
  logModal.hidden = true;
  startFeed(timestamp, selectedIntervalHours);
});

profileDobInput.max = todayDateString();

// --- Share / setup ---

btnShare.addEventListener('click', () => {
  shareCodeEl.textContent = getHouseholdCode();
  shareModal.hidden = false;
});
shareClose.addEventListener('click', () => { shareModal.hidden = true; });

// "Use a different code" only makes this phone forget the code, for a wrong code or a different diary. Nothing is
// deleted. The page reloads so nothing from the old diary stays in memory, and the welcome screen takes over.
const switchModal = document.getElementById('switch-modal');
document.getElementById('btn-switch-code').addEventListener('click', () => {
  document.getElementById('switch-code').textContent = getHouseholdCode() || '';
  switchModal.hidden = false;
});
document.getElementById('switch-cancel').addEventListener('click', () => { switchModal.hidden = true; });
document.getElementById('switch-confirm').addEventListener('click', async () => {
  await clearPhoneExtras();
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CREATED_KEY);
    localStorage.removeItem(SHARE_DONE_KEY);
  } catch (e) { /* checked below */ }
  if (getHouseholdCode()) { switchModal.hidden = true; showToast('Could not switch. Please try again'); return; }
  location.replace(location.pathname);
});

// --- Delete this household ---
// Removes everything saved under the household code, for everyone who uses it, then forgets the code on this phone.
// It only ever acts on the code stored here. The order matters because the security rules let only registered devices
// touch a household: the diary data goes first, then the other phones' registrations, then a small dated marker (so
// other phones can be told, and the code cannot be joined again), and this phone's own registration goes last.
// Every step is safe to repeat, so "Try again" after a dropped connection carries on where it stopped.
const deleteModalIds = ['delete-modal', 'delete-confirm-modal', 'delete-progress-modal', 'delete-done-modal'];
const deleteCountEls = ['feeds', 'poos', 'moments'].map((n) => document.getElementById(`delete-n-${n}`));
const deleteWarn = document.getElementById('delete-warn');
const deleteGo1 = document.getElementById('delete-go1');
const deleteGo2 = document.getElementById('delete-go2');
const deleteInput = document.getElementById('delete-confirm-input');
const deleteBackupBtn = document.getElementById('delete-backup');
const deleteBar = document.getElementById('delete-bar');
const NOTICE_KEY = 'babyfeed_notice';
let deleteTotal = 0;
let deleteRunning = false;

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}
function showDeleteStep(id) {
  deleteModalIds.forEach((m) => { document.getElementById(m).hidden = m !== id; });
}
function closeDelete() {
  if (deleteRunning) return;
  showDeleteStep(null);
  backupFile = null;
  setBackupStatus('');
  backupBtn.textContent = 'Download a backup';
}

document.getElementById('btn-delete-household').addEventListener('click', async () => {
  const code = getHouseholdCode();
  if (!code) return;
  if (profileIsDemo) { showToast('This is an example household, so it cannot be deleted.'); return; }
  deleteCountEls.forEach((el) => { el.textContent = '…'; });
  document.getElementById('delete-n-profile').textContent = `${profileFirstName || 'Your baby'}’s profile and bottle`;
  deleteWarn.textContent = 'Everyone with the code loses access. This cannot be undone.';
  deleteGo1.disabled = true;
  deleteBackupBtn.textContent = 'Save a backup first';
  showDeleteStep('delete-modal');
  try {
    // The counts come from the server, so they double as the check that there is a connection.
    const counts = await Promise.all(['feeds', 'poos', 'milestones'].map((name) =>
      withTimeout(getCountFromServer(collection(db, 'households', code, name)), 8000)));
    const n = counts.map((c) => c.data().count);
    deleteCountEls.forEach((el, i) => { el.textContent = String(n[i]); });
    deleteTotal = n[0] + n[1] + n[2] + 2;
    deleteGo1.disabled = false;
  } catch (e) {
    deleteCountEls.forEach((el) => { el.textContent = '—'; });
    deleteWarn.textContent = 'No connection. Connect to the internet to delete a household, so you can be sure it really happened.';
  }
});

deleteBackupBtn.addEventListener('click', async () => {
  const code = getHouseholdCode();
  if (!code) return;
  deleteBackupBtn.disabled = true;
  try {
    if (!backupFile) {
      deleteBackupBtn.textContent = 'Preparing…';
      backupFile = (await prepareBackup(code)).file;
      deleteBackupBtn.textContent = 'Save the backup';
    } else {
      await saveBackup();
      backupFile = null;
      deleteBackupBtn.textContent = 'Save a backup first';
    }
  } catch (e) {
    console.error(e);
    backupFile = null;
    deleteBackupBtn.textContent = 'Could not make the backup. Try again';
  } finally {
    deleteBackupBtn.disabled = false;
  }
});

deleteGo1.addEventListener('click', () => {
  deleteInput.value = '';
  deleteGo2.disabled = true;
  showDeleteStep('delete-confirm-modal');
  deleteInput.focus();
});
deleteInput.addEventListener('input', () => { deleteGo2.disabled = deleteInput.value.trim().toUpperCase() !== 'DELETE'; });
document.querySelectorAll('[data-delete-close]').forEach((b) => b.addEventListener('click', closeDelete));

async function deleteHousehold(code, onProgress) {
  const part = (name) => collection(db, 'households', code, name);
  let done = 0;
  for (const name of ['feeds', 'poos', 'milestones', 'feedback', 'profile', 'bottle']) {
    for (let round = 0; round < 500; round++) {
      const snap = await withTimeout(getDocs(query(part(name), limit(400))), 20000);
      if (snap.empty) break;
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await withTimeout(batch.commit(), 30000);
      done += snap.size;
      onProgress(done);
    }
  }
  const me = auth.currentUser ? auth.currentUser.uid : '';
  const members = await withTimeout(getDocs(part('members')), 20000);
  const others = members.docs.filter((d) => d.id !== me);
  if (others.length) {
    const batch = writeBatch(db);
    others.forEach((d) => batch.delete(d.ref));
    await withTimeout(batch.commit(), 30000);
  }
  await withTimeout(setDoc(doc(db, 'households', code, 'tombstone', 'info'), { deletedAt: Date.now() }), 20000);
  if (me) await withTimeout(deleteDoc(doc(db, 'households', code, 'members', me)), 20000);
}

async function runDelete() {
  const code = getHouseholdCode();
  if (!code || deleteRunning) return;
  deleteRunning = true;
  document.getElementById('delete-error').hidden = true;
  document.getElementById('delete-progress-title').textContent = 'Deleting…';
  document.getElementById('delete-progress-text').textContent = 'Starting';
  deleteBar.style.transform = 'scaleX(0)';
  showDeleteStep('delete-progress-modal');
  try {
    await deleteHousehold(code, (done) => {
      const shown = Math.min(done, deleteTotal || done);
      deleteBar.style.transform = `scaleX(${deleteTotal ? shown / deleteTotal : 0.5})`;
      document.getElementById('delete-progress-text').textContent = deleteTotal ? `${shown} of ${deleteTotal} items` : `${shown} items`;
    });
  } catch (e) {
    console.error(e);
    deleteRunning = false;
    document.getElementById('delete-progress-title').textContent = 'Could not finish deleting';
    document.getElementById('delete-progress-text').textContent = '';
    document.getElementById('delete-error').hidden = false;
    return;
  }
  deleteRunning = false;
  deleteBar.style.transform = 'scaleX(1)';
  await clearPhoneExtras();
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CREATED_KEY);
    localStorage.removeItem(SHARE_DONE_KEY);
  } catch (e) { /* the marker left in the database catches this on the next open */ }
  showDeleteStep('delete-done-modal');
}
deleteGo2.addEventListener('click', runDelete);
document.getElementById('delete-retry').addEventListener('click', runDelete);
document.getElementById('delete-done').addEventListener('click', () => { location.replace(location.pathname); });

// A phone that still holds the code of a deleted household finds out on its next open, forgets the code and says so.
// It looks for the marker before registering, so a deleted household is never quietly recreated.
async function isHouseholdDeleted(code) {
  try {
    await signedIn();
    const snap = await withTimeout(getDoc(doc(db, 'households', code, 'tombstone', 'info')), 3000);
    return snap.exists();
  } catch (e) {
    return false; // offline or unsure: carry on as normal
  }
}
async function joinUnlessDeleted(code) {
  if (await isHouseholdDeleted(code)) {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CREATED_KEY);
      localStorage.removeItem(SHARE_DONE_KEY);
      localStorage.setItem(NOTICE_KEY, 'deleted');
    } catch (e) { /* nothing more to do */ }
    location.replace(location.pathname);
    return;
  }
  await joinHousehold(code);
}
function showSetupNotice() {
  try {
    if (localStorage.getItem(NOTICE_KEY) === 'deleted') {
      document.getElementById('setup-notice').hidden = false;
      localStorage.removeItem(NOTICE_KEY);
    }
  } catch (e) { /* no notice */ }
}
// --- No connection ---
// New entries are kept and sent when the connection returns, but only while the app stays open, so the screen says so.
const offlineNote = document.getElementById('offline-note');
function drawOfflineNote() { offlineNote.hidden = navigator.onLine !== false; }
window.addEventListener('online', drawOfflineNote);
window.addEventListener('offline', drawOfflineNote);
drawOfflineNote();

// --- Connection check ---
// Runs each step the diary depends on, with a time limit, and lists the result with the recent log, for a screenshot.
const checkModal = document.getElementById('check-modal');
const checkOut = document.getElementById('check-out');
function indexedDbAnswers(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('no answer'), ms);
    try {
      const req = (window.realIndexedDB || window.indexedDB).open('little-sips-check');
      req.onsuccess = () => { clearTimeout(timer); try { req.result.close(); } catch (e) { /* fine */ } resolve('ok'); };
      req.onerror = () => { clearTimeout(timer); resolve(`error ${req.error && req.error.name}`); };
    } catch (e) { clearTimeout(timer); resolve(`error ${e.name || e.message}`); }
  });
}
async function runConnectionCheck() {
  const lines = [];
  const show = () => { checkOut.textContent = lines.join('\n'); };
  const step = async (label, fn) => {
    lines.push(`${label}: …`); show();
    const t = Date.now();
    let result;
    try { result = await fn(); } catch (e) { result = `failed: ${e.code || e.message}`; }
    lines[lines.length - 1] = `${label}: ${result} (${((Date.now() - t) / 1000).toFixed(1)}s)`; show();
  };
  const code = getHouseholdCode();
  lines.push(`Little sips ${inNativeApp ? 'iPhone app' : 'website'}, version 174`);
  lines.push(`Online: ${navigator.onLine ? 'yes' : 'no'}  Household: ${code ? code.slice(0, 2) + '…' : 'none'}  Feeds on screen: ${latestFeeds.length}`);
  await step('Local storage', async () => { localStorage.setItem('babyfeed_check', '1'); return localStorage.getItem('babyfeed_check') === '1' ? 'ok' : 'not saved'; });
  await step(`Phone database${window.realIndexedDB ? ' (not used by the app)' : ''}`, () => indexedDbAnswers(3000));
  await step('Sign-in', async () => { const u = await signedIn(); return u ? `ok (${u.uid.slice(0, 4)}…)` : 'not signed in'; });
  await step('Server', async () => {
    const snap = await withTimeout(getDocFromServer(doc(db, 'households', code || '5Q34K2ZQ', 'profile', 'info')), 8000);
    return snap.exists() ? 'ok' : 'ok (no profile)';
  });
  let log = [];
  try { log = JSON.parse(localStorage.getItem(DIAG_KEY) || '[]'); } catch (e) { /* none */ }
  lines.push('', 'Recent:', ...log.slice(-15));
  show();
}
function openConnectionCheck() {
  checkOut.textContent = '';
  checkModal.hidden = false;
  runConnectionCheck();
}
// Not shown anywhere: five quick taps on "Free to use" in Settings open it, for when something needs looking into.
let checkTaps = 0; let checkTapTimer = 0;
document.querySelector('.free-card b').addEventListener('click', () => {
  checkTaps += 1;
  clearTimeout(checkTapTimer);
  checkTapTimer = setTimeout(() => { checkTaps = 0; }, 1500);
  if (checkTaps >= 5) { checkTaps = 0; openConnectionCheck(); }
});
document.getElementById('check-again').addEventListener('click', runConnectionCheck);
document.getElementById('check-close').addEventListener('click', () => { checkModal.hidden = true; });

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

// "Add to Home Screen" is for the website. Inside the App Store app it makes no sense, so it is not offered there.
if (!isRunningStandalone() && isIosDevice() && !window.Capacitor?.isNativePlatform?.()) {
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

btnCreateHousehold.addEventListener('click', async () => {
  const typedCode = codeFromName(welcomeName.value);
  if (typedCode) { attemptJoin(typedCode, btnCreateHousehold, 'Join with this code'); return; }
  const code = generateHouseholdCode();
  localStorage.setItem(STORAGE_KEY, code);
  setFlag(CREATED_KEY);
  const name = document.getElementById('welcome-name').value.trim();
  history.replaceState(null, '', '#feed');
  await enterApp(code);
  if (name) saveProfileFields({ firstName: name });
});

// Joining first looks the code up, so a mistyped code is caught before it is saved. A diary with a baby name or any
// feeds opens straight away; an empty or unreachable one asks first. Looking only reads, and the code is saved on this
// phone only once it is confirmed.
const joinCheck = document.getElementById('join-check');
const joinSubmit = joinForm.querySelector('button[type="submit"]');
const setupNew = document.getElementById('setup-new');
const showJoinBtn = document.getElementById('show-join');
const backToNew = document.getElementById('back-to-new');
const welcomeName = document.getElementById('welcome-name');
const welcomeCodeNote = document.getElementById('welcome-code-note');
let joinCandidate = '';

// The first screen has three states: start a new diary, enter a code, or "nothing under that code, is it right?".
function setSetupMode(mode) {
  setupNew.hidden = mode !== 'new';
  showJoinBtn.hidden = mode !== 'new';
  document.getElementById('welcome-or').hidden = mode !== 'new';
  joinForm.hidden = mode !== 'join';
  backToNew.hidden = mode !== 'join';
  joinCheck.hidden = mode !== 'check';
  setupError.hidden = true;
  if (mode === 'join') joinCodeInput.focus();
}
showJoinBtn.addEventListener('click', () => setSetupMode('join'));
backToNew.addEventListener('click', () => setSetupMode('new'));

// A code is 6 to 8 letters and digits. A whole pasted message, such as the share text, still yields the code, and
// spaces or dashes are ignored.
const CODE_PATTERN = /^[A-Z0-9]{6,8}$/i;
function extractCode(text) {
  const tokens = text.split(/[^A-Za-z0-9]+/).filter((t) => CODE_PATTERN.test(t));
  const withDigit = tokens.filter((t) => /\d/.test(t));
  const pick = withDigit.length ? withDigit[withDigit.length - 1] : tokens.filter((t) => t.length === 8).pop();
  return pick ? pick.toUpperCase() : null;
}

// People often put the code straight into the name box, so when what is typed there looks like a code, the big button
// joins it instead of starting a new diary. Codes nearly always contain a digit; a name made only of letters counts
// only when it is a single word typed in capitals.
function codeFromName(value) {
  const text = value.trim();
  const code = extractCode(text);
  if (!code) return null;
  if (/\d/.test(code)) return code;
  return !/\s/.test(text) && text === text.toUpperCase() ? code : null;
}
function updateStartButton() {
  const code = codeFromName(welcomeName.value);
  btnCreateHousehold.textContent = code ? 'Join with this code' : 'Start';
  welcomeCodeNote.hidden = !code;
  welcomeCodeNote.textContent = code ? `That looks like a code, so this will join ${code}.` : '';
}
welcomeName.addEventListener('input', updateStartButton);

function tidyCodeInput() {
  const value = joinCodeInput.value;
  const next = extractCode(value) || value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (next !== value) joinCodeInput.value = next;
}
joinCodeInput.addEventListener('input', tidyCodeInput);

async function lookUpDiary(code) {
  try {
    if (await isHouseholdDeleted(code)) return { state: 'deleted', name: '' };
    await joinHousehold(code); // registers this phone first, which the security rules need before anything can be read
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000));
    const [profile, feeds] = await Promise.race([
      Promise.all([getDoc(profileDocRef(code)), getDocs(query(feedsCollection(code), limit(1)))]),
      timeout,
    ]);
    const data = profile.exists() ? profile.data() : {};
    const name = data.firstName || data.name || '';
    return name || !feeds.empty ? { state: 'found', name } : { state: 'empty', name: '' };
  } catch (e) {
    return { state: 'unknown', name: '' };
  }
}

function openJoinedDiary(code, name) {
  setupError.hidden = true;
  joinCheck.hidden = true;
  localStorage.setItem(STORAGE_KEY, code);
  enterApp(code);
  if (name) showToast(`Joined ${name}\u2019s diary`);
}

async function attemptJoin(code, button, label) {
  setupError.hidden = true;
  button.disabled = true;
  button.textContent = 'Checking\u2026';
  const found = await lookUpDiary(code);
  button.disabled = false;
  button.textContent = label;
  if (found.state === 'found') { openJoinedDiary(code, found.name); return; }
  joinCandidate = code;
  const gone = found.state === 'deleted';
  document.getElementById('join-check-yes').hidden = gone;
  document.getElementById('join-check-title').textContent = gone ? 'This household was deleted' : found.state === 'empty' ? 'Nothing here yet' : 'Could not check this code';
  document.getElementById('join-check-text').textContent = gone
    ? `The household under ${code} was deleted, so it cannot be joined. Check the code, or start a new household.`
    : found.state === 'empty'
      ? `There are no feeds or baby name under ${code}. If someone gave you this code, check it for typos. A brand new diary is empty too.`
      : `There is no connection to look ${code} up. You can open it anyway and it will fill in once you are online, or check the code first.`;
  setSetupMode('check');
}

joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  tidyCodeInput();
  const code = joinCodeInput.value.trim().toUpperCase();
  if (code.length < 6) {
    setupError.textContent = code ? 'That looks too short. Codes are 8 letters and numbers.' : 'Enter the code you were given.';
    setupError.hidden = false;
    return;
  }
  attemptJoin(code, joinSubmit, 'Join');
});
document.getElementById('join-check-yes').addEventListener('click', () => openJoinedDiary(joinCandidate, ''));
document.getElementById('join-check-no').addEventListener('click', () => {
  joinCodeInput.value = joinCandidate;
  setSetupMode('join');
});


// --- Next feed reminders ---
// Only inside the iPhone app. Each reminder is a notification set on the phone itself, so it fires when the app is
// closed. The choice stays on this device and is never saved to the household's data. The test site (or
// ?preview-reminders) shows the same screens so they can be tried, but nothing is scheduled outside the app.
const nativeNotifications = nativePlugin('LocalNotifications');
const previewReminders = !nativeNotifications && (location.pathname.includes('my-babys-feed-staging') || new URLSearchParams(location.search).has('preview-reminders'));
// The iPhone app's web view has no "Safari" in its name. If it is that but the plugin cannot be found, the section still
// shows, with a message, so a missing plugin is visible instead of silent.
const inIosWebView = /iPhone|iPad/.test(navigator.userAgent) && !/Safari/.test(navigator.userAgent);
const remindersAvailable = !!nativeNotifications || previewReminders || inIosWebView;
const REMINDER_LEADS = [30, 15, 0]; // minutes before the feed is due
const REMINDER_ID = { 0: 1, 15: 2, 30: 3 };
const REMINDER_KEY = 'babyfeed_reminders'; // a list of the minutes chosen; the key exists once a choice has been made
const REMINDER_OLD_KEY = 'babyfeed_reminder_lead';
const REMINDER_OFFER_KEY = 'babyfeed_reminder_offer_done';
const REMINDER_LAST_KEY = 'babyfeed_reminders_last'; // what was on before the switch was turned off, so turning it on again restores it
const PREVIEW_PERMISSION_KEY = 'babyfeed_preview_notifications';
const PREVIEW_TEXT = 'Preview only: reminders arrive in the iPhone app. Nothing is scheduled from the website.';
const reminderCard = document.getElementById('reminder-card');
const reminderSwitch = document.getElementById('reminder-switch');
const reminderWhen = document.getElementById('reminder-when');
const reminderWhenValue = document.getElementById('reminder-when-value');
const reminderHint = document.getElementById('reminder-hint');
const reminderModal = document.getElementById('reminder-modal');
const reminderModalChoice = document.getElementById('reminder-modal-choice');
const reminderOfferCard = document.getElementById('reminder-offer');

function readReminders() {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    if (raw !== null) return JSON.parse(raw).filter(n => REMINDER_LEADS.includes(n));
    const old = localStorage.getItem(REMINDER_OLD_KEY); // the first iPhone builds kept one choice
    if (old !== null && old !== 'off') return [Number(old) === 10 ? 15 : Number(old)].filter(n => REMINDER_LEADS.includes(n));
  } catch (e) { /* none chosen */ }
  return [];
}
let reminders = readReminders();
let reminderScheduled = null; // null until the first sync, so notifications left from an earlier launch are always checked
function hasReminderChoice() {
  try { return localStorage.getItem(REMINDER_KEY) !== null || localStorage.getItem(REMINDER_OLD_KEY) !== null; } catch (e) { return false; }
}
function saveReminders() {
  try { localStorage.setItem(REMINDER_KEY, JSON.stringify(reminders)); } catch (e) { /* the choice just will not be remembered */ }
}
function setReminderHint(msg) {
  const text = msg || (previewReminders ? PREVIEW_TEXT : '');
  reminderHint.textContent = text;
  reminderHint.hidden = !text;
}

// When this phone leaves a household (deleted, or switched to another code), nothing from it should stay behind:
// every reminder is cancelled and a lock screen timer for a running feed is ended.
async function clearPhoneExtras() {
  try {
    if (nativeNotifications) await nativeNotifications.cancel({ notifications: REMINDER_LEADS.map(l => ({ id: REMINDER_ID[l] })) });
  } catch (e) { /* a reminder may still fire once; harmless */ }
  try {
    if (liveFeed) await liveFeed.end();
  } catch (e) { /* the timer goes stale on its own */ }
}

// Soft wording on purpose: "may" and "around", never a deadline. The body repeats nothing the title already says.
function reminderTitle(lead, dueClock) {
  const name = profileFirstName || 'your baby';
  if (lead === 0) return profileFirstName ? `Around feed time for ${profileFirstName}` : 'Around feed time';
  if (lead === 15) return `${name[0].toUpperCase()}${name.slice(1)} may want a feed around ${dueClock}`;
  return `A feed may be coming up around ${dueClock}`;
}
async function syncReminder() {
  if (!nativeNotifications) return;
  const last = latestFeeds[0];
  // Nothing to remind about while a feed is running or before there is a finished feed to count from.
  const due = reminders.length && last && last.amountMl != null
    ? last.timestamp + (last.intervalHours || 3) * 3600000
    : null;
  const items = due === null ? [] : reminders
    .map(lead => ({ lead, at: due - lead * 60000 }))
    .filter(r => r.at > Date.now());
  // Only a name that was entered is used: a household with no name must not be reminded about someone else's baby.
  const signature = items.length ? `${items.map(r => r.at).join(',')}|${profileFirstName}|${due}|${last.timestamp}` : '';
  if (signature === reminderScheduled) return;
  reminderScheduled = signature;
  try {
    await nativeNotifications.cancel({ notifications: REMINDER_LEADS.map(l => ({ id: REMINDER_ID[l] })) });
    if (items.length) {
      await nativeNotifications.schedule({
        notifications: items.map(r => ({
          id: REMINDER_ID[r.lead],
          title: reminderTitle(r.lead, formatClock(due)),
          body: `Last feed was at ${formatClock(last.timestamp)}. No rush.`,
          schedule: { at: new Date(r.at) },
        })),
      });
    }
  } catch (e) {
    console.warn('Could not set the reminders', e);
    diag(`reminders failed: ${e.message || e}`);
    reminderScheduled = null;
  }
}

function drawChoice(container, leads) {
  container.querySelectorAll('.check-row').forEach(b => {
    b.setAttribute('aria-pressed', leads.includes(Number(b.dataset.lead)) ? 'true' : 'false');
  });
}
// "30 and 15 min before", "15 min before and on time", "On time"
function reminderSummary() {
  const before = REMINDER_LEADS.filter(l => l > 0 && reminders.includes(l));
  const onTime = reminders.includes(0);
  if (before.length === 2 && onTime) return '30, 15 and on time';
  if (before.length && onTime) return `${before[0]} min and on time`;
  if (before.length) return `${before.join(' and ')} min before`;
  return onTime ? 'On time' : '';
}
function drawReminderChoice() {
  const on = reminders.length > 0;
  reminderSwitch.setAttribute('aria-checked', on ? 'true' : 'false');
  reminderWhen.hidden = !on;
  reminderWhenValue.textContent = reminderSummary();
}

async function notificationPermission() {
  if (!nativeNotifications) {
    try { return localStorage.getItem(PREVIEW_PERMISSION_KEY) || 'prompt'; } catch (e) { return 'prompt'; }
  }
  try { return (await nativeNotifications.checkPermissions()).display; } catch (e) { return 'prompt'; }
}
async function askNotificationPermission() {
  if (!nativeNotifications) {
    try { localStorage.setItem(PREVIEW_PERMISSION_KEY, 'granted'); } catch (e) { /* preview only */ }
    return true;
  }
  try { return (await nativeNotifications.requestPermissions()).display === 'granted'; } catch (e) { return false; }
}
function applyReminders(list) {
  reminders = REMINDER_LEADS.filter(l => list.includes(l));
  saveReminders();
  if (reminders.length) { try { localStorage.setItem(REMINDER_LAST_KEY, JSON.stringify(reminders)); } catch (e) { /* not remembered */ } }
  drawReminderChoice();
  reminderScheduled = null;
  syncReminder();
  renderFirstRunHints();
}
// A reminder can only be switched on once the phone has allowed notifications. The first time, a short explanation comes
// before the system's own question, so the question is not a surprise.
async function turnOnReminders(list) {
  const state = await notificationPermission();
  if (state === 'granted') { setReminderHint(''); applyReminders(list); return; }
  if (state === 'denied') {
    setReminderHint('Notifications are switched off for Little sips. Turn them on in the iPhone Settings app, then try again.');
    return;
  }
  openReminderModal(list);
}

// One sheet, two uses. "setup" is the first time: an explanation, then the system's question. "edit" is changing which
// reminders are on once they already are: just the list and Done.
let modalLeads = [];
let modalMode = 'setup';
function openReminderModal(list, mode = 'setup') {
  modalMode = mode;
  modalLeads = REMINDER_LEADS.filter(l => list.includes(l));
  drawChoice(reminderModalChoice, modalLeads);
  const setup = mode === 'setup';
  document.getElementById('reminder-modal-title').textContent = setup ? 'Remind you before the next feed?' : 'Remind me';
  document.getElementById('reminder-modal-text').hidden = !setup;
  document.getElementById('reminder-modal-cancel').hidden = !setup;
  document.getElementById('reminder-modal-go').textContent = setup ? 'Turn on' : 'Done';
  document.getElementById('reminder-modal-go').disabled = setup && !modalLeads.length;
  document.getElementById('reminder-modal-preview').hidden = !(previewReminders && setup);
  reminderModal.hidden = false;
}
reminderModalChoice.querySelectorAll('.check-row').forEach(btn => btn.addEventListener('click', () => {
  const lead = Number(btn.dataset.lead);
  modalLeads = modalLeads.includes(lead) ? modalLeads.filter(n => n !== lead) : [...modalLeads, lead];
  drawChoice(reminderModalChoice, modalLeads);
  document.getElementById('reminder-modal-go').disabled = modalMode === 'setup' && !modalLeads.length;
}));
document.getElementById('reminder-modal-go').addEventListener('click', async () => {
  if (modalMode === 'edit') {
    // Already allowed. Choosing nothing turns the reminders off.
    reminderModal.hidden = true;
    applyReminders(modalLeads);
    return;
  }
  const allowed = await askNotificationPermission();
  reminderModal.hidden = true;
  if (allowed) { setReminderHint(''); applyReminders(modalLeads); }
  else setReminderHint('Notifications are switched off for Little sips. Turn them on in the iPhone Settings app, then try again.');
});
document.getElementById('reminder-modal-cancel').addEventListener('click', () => { reminderModal.hidden = true; });

if (remindersAvailable) {
  reminderCard.hidden = false;
  setReminderHint('');
  drawReminderChoice();
  diag(`reminders: ${nativeNotifications ? 'ready' : inIosWebView ? 'plugin missing' : 'preview'}`);
  if (!nativeNotifications && inIosWebView) setReminderHint('Reminders could not start on this phone. Please use Send feedback to tell us.');
  reminderSwitch.addEventListener('click', () => {
    setReminderHint('');
    if (reminders.length) { applyReminders([]); return; }
    let again = [15];
    try { const saved = JSON.parse(localStorage.getItem(REMINDER_LAST_KEY) || '[]'); if (saved.length) again = saved; } catch (e) { /* the default */ }
    turnOnReminders(again);
  });
  reminderWhen.addEventListener('click', () => openReminderModal(reminders, 'edit'));
  // Coming back to the app is the moment to make sure the reminders still match the latest feed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { reminderScheduled = null; syncReminder(); }
  });
}

// --- Lock screen timer ---
// Only inside the iPhone app. While a feed is running the lock screen (and the Dynamic Island) show a timer counting up
// from when it started; it goes away when the feed is finished or removed. The timer counts by itself on the phone, and it
// starts only when this phone is open, so a feed started on another phone shows here once the app is opened.
const liveFeed = nativePlugin('LiveFeed');
let liveFeedKey = null; // null until the first check, so a timer left from an earlier launch is always cleared or renewed
async function syncLiveFeed() {
  if (!liveFeed) return;
  const last = latestFeeds[0];
  // A feed with no amount is a running one. One started over an hour ago is almost surely an entry whose amount was never
  // added, so it gets no timer.
  const running = !!last && last.amountMl == null && Date.now() - last.timestamp < 3600000;
  const key = running ? `${last.id}|${last.timestamp}|${profileFirstName}` : '';
  if (key === liveFeedKey) return;
  liveFeedKey = key;
  try {
    if (running) {
      const result = await liveFeed.start({ name: profileFirstName, startedAt: last.timestamp });
      // The phone can say no (Live Activities switched off for the app); the connection check shows why.
      diag(result && result.started ? 'lock screen timer: started' : `lock screen timer: not started (${(result && result.reason) || 'no answer'})`);
    } else await liveFeed.end();
  } catch (e) {
    diag(`lock screen timer: ${e.message || e}`);
    liveFeedKey = null;
  }
}

// --- Siri ---
// Only inside the iPhone app. "Hey Siri, start a feed in Little sips" opens the app and leaves a note; this picks it up
// and does what a tap would do. The app's name has to be in the phrase, which is Apple's rule for app phrases.
// Switched off for the first release. The code is kept so it can be turned back on later: see scripts/ios-files/later/siri/README.md.
const SIRI_ENABLED = false;
const siri = SIRI_ENABLED ? nativePlugin('SiriCommand') : null;
async function runSiriCommand() {
  if (!siri || !getHouseholdCode() || !feedsLoaded) return;
  let got;
  try { got = await siri.takeCommand(); } catch (e) { return; }
  if (!got || !got.command || Date.now() - got.at > 180000) return; // an old note is ignored
  diag(`siri: ${got.command}`);
  const running = !!latestFeeds.length && latestFeeds[0].amountMl == null;
  if (got.command === 'start-feed') {
    if (running) { showToast('A feed is already running'); return; }
    startFeedLockedUntil = Date.now() + 2000;
    startFeed(Date.now(), computeAutoIntervalHours(DEFAULT_ML));
  } else if (got.command === 'finish-feed') {
    if (running) openLogModal(latestFeeds[0]); else showToast('No feed is running');
  } else if (got.command === 'bottle-made') {
    startBottleTimer(0);
  }
}
if (siri) {
  setInterval(() => { if (document.visibilityState === 'visible') runSiriCommand(); }, 1500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') runSiriCommand(); });
  document.getElementById('siri-card').hidden = false;
}

// --- Units ---
function drawUnitChoice() {
  document.querySelectorAll('#unit-choice .segment').forEach(b => b.classList.toggle('active', b.dataset.unit === unit));
}
function applyUnit() {
  drawUnitChoice();
  renderSinceLastFeed();
  renderTodayTotal();
  renderHistory();
  renderTrends();
  renderProfileCounts();

}
document.querySelectorAll('#unit-choice .segment').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.unit === unit) return;
    unit = btn.dataset.unit;
    try { localStorage.setItem(UNIT_KEY, unit); } catch (e) { /* the choice just will not be remembered */ }
    applyUnit();
  });
});
drawUnitChoice();

// --- First open ---
// One welcome screen asks for the baby's name (optional), then Feeds teaches the two buttons at the moment they are
// needed: a pointer at Start feed while there are no feeds, then one at Finish feed while the very first feed runs.
// After the first finished feed, the phone that made the diary offers the share code once.
// The App Store number, once the iPhone app is published (the digits in its App Store link, apps.apple.com/app/id...).
// Setting it switches on "Rate the app", a "Get the iPhone app" link on the welcome screen, and a one-time card on
// Feeds for people using the website on an iPhone. Their diary carries over with the household code.
// Adding ?preview-app-card to the address shows the card before then, for checking how it looks.
const APP_STORE_ID = '6824503759';
// The store page does not exist until Apple has approved and released the app, so everything that points to it stays
// hidden until APP_IS_LIVE is true: the Rate button, the website's "Get the iPhone app" link and its one-time card.
// Set it to true in the first update after release (the website can be updated at once; the app needs a new version).
const APP_IS_LIVE = false;
const APP_STORE_URL = APP_STORE_ID && APP_IS_LIVE ? `https://apps.apple.com/app/id${APP_STORE_ID}` : '';
const APP_CARD_DONE_KEY = 'babyfeed_app_card_done';
const isNativeApp = !!window.Capacitor?.isNativePlatform?.();
const previewAppCard = new URLSearchParams(location.search).has('preview-app-card');
const offerIphoneApp = !isNativeApp && ((APP_STORE_URL && isIosDevice()) || previewAppCard);
const appCard = document.getElementById('app-card');
if (APP_STORE_URL) document.getElementById('app-card-go').href = APP_STORE_URL;
if (offerIphoneApp && APP_STORE_URL) {
  const link = document.getElementById('welcome-app-link');
  link.querySelector('a').href = APP_STORE_URL;
  link.hidden = false;
}
const CREATED_KEY = 'babyfeed_created_here';
const SHARE_DONE_KEY = 'babyfeed_share_card_done';
const feedTipEl = document.getElementById('feed-tip');
const shareCard = document.getElementById('share-card');
function readFlag(key) { try { return localStorage.getItem(key) === '1'; } catch (e) { return false; } }
function setFlag(key) { try { localStorage.setItem(key, '1'); } catch (e) { /* the card may show again; harmless */ } }

function renderFirstRunHints() {
  if (!feedsLoaded) { feedTipEl.hidden = true; shareCard.hidden = true; return; }
  const running = latestFeeds.length && latestFeeds[0].amountMl == null;
  let tip = '';
  if (!latestFeeds.length) tip = '<span class="n">1</span>Tap <b>Start feed</b> when the feed begins.';
  else if (latestFeeds.length === 1 && running) tip = '<span class="n">2</span>When it is done, tap <b>Finish feed</b> and add how much.';
  feedTipEl.innerHTML = tip;
  feedTipEl.hidden = !tip;
  btnStartFeedNow.classList.toggle('pulse', !!tip);
  const showShare = readFlag(CREATED_KEY) && !readFlag(SHARE_DONE_KEY) && latestFeeds.some(f => f.amountMl != null);
  shareCard.hidden = !showShare;
  if (showShare) document.getElementById('share-card-code').textContent = getHouseholdCode() || '';
  // The reminder offer waits for a finished feed, and for the share card to be dealt with first.
  const showReminderOffer = remindersAvailable && !tip && !showShare && !hasReminderChoice() && !readFlag(REMINDER_OFFER_KEY)
    && latestFeeds.some(f => f.amountMl != null);
  reminderOfferCard.hidden = !showReminderOffer;
  // The iPhone app card waits until the first-run pointers and the share card are out of the way.
  const showApp = offerIphoneApp && !tip && !showShare && (previewAppCard || !readFlag(APP_CARD_DONE_KEY));
  appCard.hidden = !showApp;
  if (showApp) document.getElementById('app-card-code').textContent = getHouseholdCode() || '';
}

document.getElementById('share-card-go').addEventListener('click', async () => {
  const code = getHouseholdCode() || '';
  setFlag(SHARE_DONE_KEY);
  renderFirstRunHints();
  const text = `Join our baby's feeds on Little sips: open littlesips.co.uk, tap "Join a household" and enter ${code}`;
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  shareCodeEl.textContent = code;
  shareModal.hidden = false;
});
document.getElementById('share-card-later').addEventListener('click', () => { setFlag(SHARE_DONE_KEY); renderFirstRunHints(); });
document.getElementById('reminder-offer-go').addEventListener('click', () => { setFlag(REMINDER_OFFER_KEY); renderFirstRunHints(); openReminderModal([15]); });
document.getElementById('reminder-offer-later').addEventListener('click', () => { setFlag(REMINDER_OFFER_KEY); renderFirstRunHints(); });
document.getElementById('app-card-later').addEventListener('click', () => { setFlag(APP_CARD_DONE_KEY); renderFirstRunHints(); });
document.getElementById('app-card-go').addEventListener('click', (e) => {
  if (!APP_STORE_URL) { e.preventDefault(); showToast('The App Store link goes here once the app is published'); return; }
  setFlag(APP_CARD_DONE_KEY);
  renderFirstRunHints();
});

// --- Backup ---
// Reads everything in the household and saves it as one file. It only reads, so it cannot change the stored data.
// Two taps on purpose: the first prepares the file, the second hands it to the phone (iPhone only allows saving or
// sharing straight after a tap).
const backupBtn = document.getElementById('backup-btn');
const backupStatus = document.getElementById('backup-status');
let backupFile = null;
function setBackupStatus(text) {
  backupStatus.textContent = text;
  backupStatus.hidden = !text;
}
async function prepareBackup(code) {
  const data = { app: "Little sips", exportedAt: new Date().toISOString(), household: code, collections: {} };
  for (const name of ['feeds', 'poos', 'milestones', 'feedback', 'profile', 'bottle']) {
    const snap = await getDocs(collection(db, 'households', code, name));
    data.collections[name] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  const day = new Date().toISOString().slice(0, 10);
  const file = new File([JSON.stringify(data)], `little-sips-backup-${day}.json`, { type: 'application/json' });
  const photos = data.collections.milestones.filter(m => m.photoDataUrl).length;
  return { file, summary: `${data.collections.feeds.length} feeds, ${data.collections.poos.length} poos, ${photos} photos` };
}
async function saveBackup() {
  const file = backupFile;
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: file.name }); } catch (e) { if (e.name !== 'AbortError') throw e; }
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
backupBtn.addEventListener('click', async () => {
  const code = getHouseholdCode();
  if (!code) return;
  backupBtn.disabled = true;
  try {
    if (!backupFile) {
      backupBtn.textContent = 'Preparing…';
      const { file, summary } = await prepareBackup(code);
      backupFile = file;
      setBackupStatus(`Ready: ${summary}.`);
      backupBtn.textContent = 'Save the backup';
    } else {
      await saveBackup();
      backupFile = null;
      setBackupStatus('');
      backupBtn.textContent = 'Download a backup';
    }
  } catch (e) {
    console.error(e);
    backupFile = null;
    backupBtn.textContent = 'Download a backup';
    setBackupStatus('Could not make the backup. Check your connection and try again.');
  } finally {
    backupBtn.disabled = false;
  }
});
renderHeaderDate();
setInterval(() => { renderHeaderDate(); renderSinceLastFeed(); renderNextFeed(); renderTodayTotal(); renderSinceLastPoo(); renderPooStats(); renderProfileAge(); renderBottleStatus(); }, 15000);

renderTrends();
applyBottleBrand();
renderTodayTotal();
renderPooStats();
renderSinceLastPoo();
renderFunFact();

const existingCode = getHouseholdCode();
if (existingCode) {
  enterApp(existingCode);
} else {
  setupScreen.hidden = false;
  showSetupNotice();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js?v=174').catch(() => {});
  });
}

// A home-screen app is usually resumed rather than reopened, so it can sit on an old version for days. Each time the
// app comes back to the front, look at the newest page on the server and reload if it has moved on.
const RUNNING_VERSION = Number(new URL(import.meta.url).searchParams.get('v')) || 0;
let lastUpdateCheck = 0;
async function checkForNewVersion() {
  if (!RUNNING_VERSION || document.hidden || Date.now() - lastUpdateCheck < 60000) return;
  lastUpdateCheck = Date.now();
  try {
    const res = await fetch(`index.html?fresh=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const found = (await res.text()).match(/app\.js\?v=(\d+)/);
    const latest = found ? Number(found[1]) : 0;
    if (latest <= RUNNING_VERSION) return;
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) reg.update().catch(() => {});
    }
    // Never reload over something half-entered, and only try once per version so a stale copy can't loop.
    const busy = document.querySelector('.modal:not([hidden])') || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (busy) { lastUpdateCheck = 0; return; }
    if (sessionStorage.getItem('babyfeed_reloaded_for') === String(latest)) return;
    sessionStorage.setItem('babyfeed_reloaded_for', String(latest));
    location.reload();
  } catch { /* offline: try again next time */ }
}
document.addEventListener('visibilitychange', checkForNewVersion);
window.addEventListener('pageshow', checkForNewVersion);
window.addEventListener('focus', checkForNewVersion);

// Pinching in is blocked so the page can't be zoomed by accident, but pinching out is left alone so the browser's
// own gesture (such as the tab overview on iPad) still works. iOS Safari ignores user-scalable=no, so this is done
// here: any gesture that would enlarge the page (scale above 1) is cancelled; one that shrinks it is not.
if (inNativeApp) {
  ['gesturechange', 'gestureend'].forEach(evt => {
    document.addEventListener(evt, (e) => { if (e.scale > 1) e.preventDefault(); });
  });
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1 && e.scale && e.scale > 1) e.preventDefault();
  }, { passive: false });
}

// A note in Settings that a paid upgrade is coming. Set to false to hide it (for example, if App Review objects to a
// "coming soon" notice in the iPhone app).

// "Rate the app" opens the App Store review page. The link is not known until the app is published, so until
// APP_STORE_ID is set (see "First open") the button only says so.
const APP_STORE_REVIEW_URL = APP_STORE_ID && APP_IS_LIVE ? `itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review` : '';
// Only where the App Store can open: the iPhone app, or the website on an iPhone.
const canRate = !!APP_STORE_REVIEW_URL && (!!window.Capacitor?.isNativePlatform?.() || isIosDevice());
document.getElementById('rate-app').hidden = !canRate;
document.getElementById('rate-line').hidden = !canRate;
document.getElementById('rate-app').addEventListener('click', () => {
  if (APP_STORE_REVIEW_URL) window.location.href = APP_STORE_REVIEW_URL;
  else showToast('Thank you. Rating opens once the app is on the App Store');
});

// The household code is the only way back in on a new phone, so offer to keep a copy. On phones this opens the share
// menu (Notes, Messages, WhatsApp, Mail, Copy and so on); elsewhere it copies the code, or falls back to an email.
async function emailCodeToSelf() {
  const code = getHouseholdCode() || '';
  const text = `Our baby's feed diary code is ${code}\n\nTo get back to our feeds on a new phone, open Little sips (or littlesips.co.uk), tap "Join a household" and enter the code.`;
  if (navigator.share) {
    try { await navigator.share({ title: "Our baby's feed diary code", text }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Code copied. Paste it into a note or message');
    return;
  } catch (e) { /* no clipboard: fall back to email */ }
  window.location.href = `mailto:?subject=${encodeURIComponent("Our baby's feed diary code")}&body=${encodeURIComponent(text)}`;
}
document.querySelectorAll('.email-code').forEach(btn => btn.addEventListener('click', emailCodeToSelf));

// While a sheet is open the page behind it must not move. overflow:hidden alone is ignored by iPhone browsers, so the
// page is pinned in place and put back at the same scroll position when the last sheet closes.
{
  let pinnedAt = null;
  const sync = () => {
    const open = !!document.querySelector('.modal:not([hidden])');
    if (open && pinnedAt === null) {
      pinnedAt = window.scrollY;
      document.body.style.cssText += `position:fixed;top:-${pinnedAt}px;left:0;right:0;width:100%;`;
    } else if (!open && pinnedAt !== null) {
      document.body.style.position = document.body.style.top = document.body.style.left = document.body.style.right = document.body.style.width = '';
      window.scrollTo(0, pinnedAt);
      pinnedAt = null;
    }
  };
  new MutationObserver(sync).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  // A swipe on the dimmed area outside the sheet does nothing.
  document.addEventListener('touchmove', (e) => { if (e.target.classList?.contains('modal')) e.preventDefault(); }, { passive: false });
}
