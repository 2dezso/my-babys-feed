import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  query, orderBy, limit, onSnapshot, enableIndexedDbPersistence,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
try { enableIndexedDbPersistence(db); } catch (e) { /* multiple tabs open, fine */ }

const STORAGE_KEY = 'babyfeed_household_code';
const INTERVAL_KEY = 'babyfeed_default_interval_hours';
const DEFAULT_INTERVAL_HOURS = 3;

const setupScreen = document.getElementById('setup-screen');
const appScreen = document.getElementById('app-screen');
const joinForm = document.getElementById('join-form');
const joinCodeInput = document.getElementById('join-code');
const setupError = document.getElementById('setup-error');
const btnCreateHousehold = document.getElementById('btn-create-household');

const lastFeedTimeEl = document.getElementById('last-feed-time');
const lastFeedDetailEl = document.getElementById('last-feed-detail');
const nextFeedTimeEl = document.getElementById('next-feed-time');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const toast = document.getElementById('toast');

const btnLogFeed = document.getElementById('btn-log-feed');
const logModal = document.getElementById('log-modal');
const whenChips = document.getElementById('when-chips');
const customTimeInput = document.getElementById('custom-time');
const amountChips = document.getElementById('amount-chips');
const customMlInput = document.getElementById('custom-ml');
const intervalChips = document.getElementById('interval-chips');
const logCancel = document.getElementById('log-cancel');
const logConfirm = document.getElementById('log-confirm');

const shareModal = document.getElementById('share-modal');
const btnShare = document.getElementById('btn-share');
const shareCodeEl = document.getElementById('share-code');
const shareClose = document.getElementById('share-close');

let selectedMinsAgo = 0;
let selectedMl = null;
let selectedIntervalHours = DEFAULT_INTERVAL_HOURS;
let latestFeeds = [];

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

function getHouseholdCode() {
  return localStorage.getItem(STORAGE_KEY);
}

function getDefaultIntervalHours() {
  const stored = Number(localStorage.getItem(INTERVAL_KEY));
  return stored > 0 ? stored : DEFAULT_INTERVAL_HOURS;
}

function enterApp(code) {
  setupScreen.hidden = true;
  appScreen.hidden = false;
  listenToFeeds(code);
}

function listenToFeeds(code) {
  const q = query(feedsCollection(code), orderBy('timestamp', 'desc'), limit(50));
  onSnapshot(q, (snapshot) => {
    latestFeeds = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderLastFeed();
    renderNextFeed();
    renderHistory();
  }, (err) => {
    console.error(err);
    showToast('Sync error — check connection');
  });
}

function renderLastFeed() {
  if (latestFeeds.length === 0) {
    lastFeedTimeEl.textContent = '—';
    lastFeedDetailEl.textContent = 'No feeds yet';
    return;
  }
  const last = latestFeeds[0];
  lastFeedTimeEl.textContent = timeAgo(last.timestamp);
  const amount = last.amountMl ? `${last.amountMl}ml · ` : '';
  lastFeedDetailEl.textContent = `${amount}${formatClock(last.timestamp)}`;
}

function renderNextFeed() {
  if (latestFeeds.length === 0) {
    nextFeedTimeEl.textContent = '—';
    return;
  }
  const last = latestFeeds[0];
  const intervalHours = last.intervalHours || DEFAULT_INTERVAL_HOURS;
  const nextTs = last.timestamp + intervalHours * 60 * 60 * 1000;
  const diffMs = nextTs - Date.now();
  const clock = formatClock(nextTs);
  if (diffMs <= 0) {
    const overdueMins = Math.floor(-diffMs / 60000);
    nextFeedTimeEl.textContent = overdueMins < 1 ? `${clock} · due now` : `${clock} · overdue ${overdueMins}m`;
  } else {
    const mins = Math.round(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    const inText = hours > 0 ? `in ${hours}h ${remMins}m` : `in ${remMins}m`;
    nextFeedTimeEl.textContent = `${clock} · ${inText}`;
  }
}

function renderHistory() {
  historyList.innerHTML = '';
  historyEmpty.hidden = latestFeeds.length !== 0;
  for (const feed of latestFeeds) {
    const li = document.createElement('li');
    const amount = feed.amountMl ? `${feed.amountMl}ml` : 'Bottle';
    li.innerHTML = `
      <div class="history-main">
        <span class="history-type">${amount}</span>
        <span class="history-time">${formatClock(feed.timestamp)} · ${timeAgo(feed.timestamp)}</span>
      </div>
      <button class="history-delete" title="Delete">✕</button>
    `;
    li.querySelector('.history-delete').addEventListener('click', () => deleteFeed(feed.id));
    historyList.appendChild(li);
  }
}

async function logFeed(timestamp, amountMl, intervalHours) {
  const code = getHouseholdCode();
  if (!code) return;
  try {
    await addDoc(feedsCollection(code), {
      type: 'bottle',
      timestamp,
      intervalHours,
      ...(amountMl ? { amountMl } : {}),
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

function selectChip(container, selector, value) {
  container.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  const target = container.querySelector(selector(value));
  if (target) target.classList.add('selected');
}

function openLogModal() {
  selectedMinsAgo = 0;
  selectedMl = null;
  selectedIntervalHours = getDefaultIntervalHours();

  customTimeInput.value = '';
  customMlInput.value = '';

  selectChip(whenChips, (v) => `[data-mins-ago="${v}"]`, 0);
  amountChips.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  selectChip(intervalChips, (v) => `[data-hours="${v}"]`, selectedIntervalHours);

  logModal.hidden = false;
}

btnLogFeed.addEventListener('click', openLogModal);

whenChips.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    selectedMinsAgo = Number(chip.dataset.minsAgo);
    customTimeInput.value = '';
    selectChip(whenChips, (v) => `[data-mins-ago="${v}"]`, selectedMinsAgo);
  });
});

customTimeInput.addEventListener('input', () => {
  whenChips.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
});

amountChips.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    amountChips.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    selectedMl = Number(chip.dataset.ml);
    customMlInput.value = '';
  });
});

customMlInput.addEventListener('input', () => {
  amountChips.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  selectedMl = customMlInput.value ? Number(customMlInput.value) : null;
});

intervalChips.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    selectedIntervalHours = Number(chip.dataset.hours);
    selectChip(intervalChips, (v) => `[data-hours="${v}"]`, selectedIntervalHours);
  });
});

logCancel.addEventListener('click', () => { logModal.hidden = true; });

logConfirm.addEventListener('click', () => {
  let timestamp;
  if (customTimeInput.value) {
    const [h, m] = customTimeInput.value.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    timestamp = d.getTime();
  } else {
    timestamp = Date.now() - selectedMinsAgo * 60000;
  }

  localStorage.setItem(INTERVAL_KEY, String(selectedIntervalHours));
  logModal.hidden = true;
  logFeed(timestamp, selectedMl, selectedIntervalHours);
});

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

setInterval(() => { renderLastFeed(); renderNextFeed(); }, 30000);

const existingCode = getHouseholdCode();
if (existingCode) {
  enterApp(existingCode);
} else {
  setupScreen.hidden = false;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js?v=2').catch(() => {});
  });
}
