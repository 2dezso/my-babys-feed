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

const TYPE_LABELS = {
  breast_left: 'Left breast',
  breast_right: 'Right breast',
  bottle: 'Bottle',
  solid: 'Solid food',
};

const setupScreen = document.getElementById('setup-screen');
const appScreen = document.getElementById('app-screen');
const joinForm = document.getElementById('join-form');
const joinCodeInput = document.getElementById('join-code');
const setupError = document.getElementById('setup-error');
const btnCreateHousehold = document.getElementById('btn-create-household');

const lastFeedTimeEl = document.getElementById('last-feed-time');
const lastFeedDetailEl = document.getElementById('last-feed-detail');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const toast = document.getElementById('toast');

const bottleModal = document.getElementById('bottle-modal');
const customMlInput = document.getElementById('custom-ml');
const bottleCancel = document.getElementById('bottle-cancel');
const bottleConfirm = document.getElementById('bottle-confirm');

const shareModal = document.getElementById('share-modal');
const btnShare = document.getElementById('btn-share');
const shareCodeEl = document.getElementById('share-code');
const shareClose = document.getElementById('share-close');

let selectedMl = null;
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
  const label = TYPE_LABELS[last.type] || last.type;
  const detail = last.type === 'bottle' && last.amountMl
    ? `${label} · ${last.amountMl}ml · ${formatClock(last.timestamp)}`
    : `${label} · ${formatClock(last.timestamp)}`;
  lastFeedDetailEl.textContent = detail;
}

function renderHistory() {
  historyList.innerHTML = '';
  historyEmpty.hidden = latestFeeds.length !== 0;
  for (const feed of latestFeeds) {
    const li = document.createElement('li');
    const label = TYPE_LABELS[feed.type] || feed.type;
    const amount = feed.type === 'bottle' && feed.amountMl ? ` · ${feed.amountMl}ml` : '';
    li.innerHTML = `
      <div class="history-main">
        <span class="history-type">${label}${amount}</span>
        <span class="history-time">${formatClock(feed.timestamp)} · ${timeAgo(feed.timestamp)}</span>
      </div>
      <button class="history-delete" title="Delete">✕</button>
    `;
    li.querySelector('.history-delete').addEventListener('click', () => deleteFeed(feed.id));
    historyList.appendChild(li);
  }
}

async function logFeed(type, extra = {}) {
  const code = getHouseholdCode();
  if (!code) return;
  try {
    await addDoc(feedsCollection(code), {
      type,
      timestamp: Date.now(),
      ...extra,
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

document.querySelectorAll('.log-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    if (type === 'bottle') {
      selectedMl = null;
      customMlInput.value = '';
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      bottleModal.hidden = false;
    } else {
      logFeed(type);
    }
  });
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    selectedMl = Number(chip.dataset.ml);
    customMlInput.value = '';
  });
});

customMlInput.addEventListener('input', () => {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  selectedMl = customMlInput.value ? Number(customMlInput.value) : null;
});

bottleCancel.addEventListener('click', () => { bottleModal.hidden = true; });

bottleConfirm.addEventListener('click', () => {
  bottleModal.hidden = true;
  logFeed('bottle', selectedMl ? { amountMl: selectedMl } : {});
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

setInterval(renderLastFeed, 30000);

const existingCode = getHouseholdCode();
if (existingCode) {
  enterApp(existingCode);
} else {
  setupScreen.hidden = false;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js?v=1').catch(() => {});
  });
}
