// Reads patterns out of the feed log. Pure functions: feeds in, plain objects out.
// A feed is { timestamp (ms), amountMl (number | undefined) }.
//
// Every metric is a series of { d: day number, v: value }. classify() compares the
// latest 7-day window with the two before it and labels the result:
//   recognised  same direction two weeks running (or steady for three weeks)
//   emerging    one clearly different week
//   early       only the last few days look different
//   steady / none
// "Clearly different" is relative to the baby's own day-to-day wobble, not a fixed number.

const HOUR = 3600000;
const MIN_NIGHTS = 7;
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 6;
const MAX_GAP_HOURS = 14; // longer than this means feeds went unlogged, not a real gap

function dayNumber(date) {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

function localTime(y, m, d, h) {
  return new Date(y, m, d, h, 0, 0, 0).getTime();
}

function mean(vals) {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function stdev(vals) {
  if (vals.length < 2) return 0;
  const m = mean(vals);
  return Math.sqrt(mean(vals.map((v) => (v - m) ** 2)));
}

function median(vals) {
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function windowStats(series, endDay, days) {
  const vals = series.filter((p) => p.d > endDay - days && p.d <= endDay).map((p) => p.v);
  return vals.length ? { mean: mean(vals), n: vals.length } : { mean: null, n: 0 };
}

export function classify(series, { minDelta, minN = 5 }) {
  const distinctDays = new Set(series.map((p) => p.d)).size;
  if (distinctDays < MIN_NIGHTS) return { status: 'none' };

  const last = Math.max(...series.map((p) => p.d));
  const w2 = windowStats(series, last, 7);
  const w1 = windowStats(series, last - 7, 7);
  const w0 = windowStats(series, last - 14, 7);
  const thr = Math.max(minDelta, 0.5 * stdev(series.map((p) => p.v)));
  const has1 = w1.n >= minN;
  const has0 = w0.n >= minN;
  const out = { status: 'steady', recent: w2.mean, before: has1 ? w1.mean : null, dir: null, thr };

  const d2 = has1 ? w2.mean - w1.mean : 0;
  const d1 = has1 && has0 ? w1.mean - w0.mean : 0;
  const big2 = has1 && Math.abs(d2) >= thr;
  const big1 = has1 && has0 && Math.abs(d1) >= thr;

  if (big2 && big1 && Math.sign(d1) === Math.sign(d2)) {
    return { ...out, status: 'recognised', dir: d2 > 0 ? 'up' : 'down', first: w0.mean };
  }
  if (big2 && !(big1 && Math.sign(d1) !== Math.sign(d2))) {
    return { ...out, status: 'emerging', dir: d2 > 0 ? 'up' : 'down' };
  }

  // Last three days against the seven before them: catches a change that has only just started.
  const lastDays = series.filter((p) => p.d > last - 3).map((p) => p.v);
  const priorDays = series.filter((p) => p.d <= last - 3 && p.d > last - 10).map((p) => p.v);
  if (lastDays.length >= 2 && priorDays.length >= minN) {
    const diff = mean(lastDays) - mean(priorDays);
    if (Math.abs(diff) >= thr) {
      return { ...out, status: 'early', dir: diff > 0 ? 'up' : 'down', recent: mean(lastDays), before: mean(priorDays) };
    }
  }

  out.steadyWeeks = has1 && has0 && Math.abs(d1) < thr && Math.abs(d2) < thr ? 3 : 0;
  return out;
}

function sortedFeeds(feeds) {
  return feeds
    .filter((f) => typeof f.timestamp === 'number')
    .map((f) => ({ ts: f.timestamp, ml: typeof f.amountMl === 'number' ? f.amountMl : null }))
    .sort((a, b) => a.ts - b.ts);
}

// One longest feed-to-feed gap per night. The night runs 10pm to 6am; a gap counts if it
// overlaps that window, and is measured in full (a 7:30pm feed to a 4:49am feed is 9h 19m).
function buildNights(feeds, now) {
  const nights = [];
  if (feeds.length < 2) return nights;
  const first = new Date(feeds[0].ts);
  const todayDay = dayNumber(new Date(now));
  for (let day = dayNumber(first) - 1; day <= todayDay; day++) {
    const base = new Date(day * 86400000);
    const y = base.getUTCFullYear(), m = base.getUTCMonth(), dd = base.getUTCDate();
    const ns = localTime(y, m, dd, NIGHT_START_HOUR);
    const ne = localTime(y, m, dd + 1, NIGHT_END_HOUR);
    if (ne > now || feeds[0].ts >= ns) continue; // unfinished night, or before logging began
    let best = null;
    for (let i = 0; i < feeds.length - 1; i++) {
      const a = feeds[i].ts, b = feeds[i + 1].ts;
      if (b <= ns || a >= ne) continue;
      const hours = (b - a) / HOUR;
      const overlap = (Math.min(b, ne) - Math.max(a, ns)) / HOUR;
      if (overlap < 1 || hours > MAX_GAP_HOURS) continue;
      if (!best || hours > best.hours) best = { d: day, v: hours, hours, start: a, end: b };
    }
    if (best) nights.push(best);
  }
  return nights;
}

function minutesSince(ts, originHour) {
  const dt = new Date(ts);
  return (((dt.getHours() - originHour) * 60 + dt.getMinutes()) % 1440 + 1440) % 1440;
}

function clockFrom(minutes, originHour) {
  const total = (minutes + originHour * 60) % 1440;
  return { hour: Math.floor(total / 60), minute: Math.round(total % 60) };
}

function buildDailyTotals(feeds, now) {
  const today = dayNumber(new Date(now));
  const byDay = new Map();
  for (const f of feeds) {
    const d = dayNumber(new Date(f.ts));
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(f);
  }
  const firstDay = feeds.length ? dayNumber(new Date(feeds[0].ts)) : 0;
  const days = [];
  for (const [d, fs] of byDay) {
    if (d >= today || d === firstDay) continue; // today is unfinished; the first day is usually partial
    if (fs.some((f) => f.ml == null)) continue;
    days.push({ d, v: fs.reduce((s, f) => s + f.ml, 0), feeds: fs.length });
  }
  return days.sort((a, b) => a.d - b.d);
}

function buildDaytimeGaps(feeds) {
  const gaps = [];
  for (let i = 0; i < feeds.length - 1; i++) {
    const a = new Date(feeds[i].ts);
    const hours = (feeds[i + 1].ts - feeds[i].ts) / HOUR;
    if (a.getHours() < 7 || a.getHours() >= 20 || hours > 6) continue;
    gaps.push({ d: dayNumber(a), v: hours });
  }
  return gaps;
}

// How often each half-hour of the day has a feed, over the last 14 finished days,
// plus the clock times that come up on most days.
function buildFeedingTimes(feeds, now) {
  const today = dayNumber(new Date(now));
  const firstDay = feeds.length ? dayNumber(new Date(feeds[0].ts)) : 0;
  const lo = Math.max(today - 14, firstDay + 1);
  const recent = feeds.filter((f) => {
    const d = dayNumber(new Date(f.ts));
    return d >= lo && d < today;
  });
  const days = today - lo;
  if (days < 7) return null;

  const bins = new Array(48).fill(0);
  for (const f of recent) {
    const dt = new Date(f.ts);
    bins[dt.getHours() * 2 + (dt.getMinutes() >= 30 ? 1 : 0)]++;
  }
  // Share of days with a feed in a 90-minute window centred on each bin.
  const share = bins.map((_, i) => {
    let c = 0;
    for (let k = -1; k <= 1; k++) c += bins[(i + k + 48) % 48];
    return Math.min(1, c / days);
  });
  const peaks = [];
  for (let i = 0; i < 48; i++) {
    if (share[i] < 0.6) continue;
    let isMax = true;
    for (let k = -2; k <= 2; k++) if (k && share[(i + k + 48) % 48] > share[i]) isMax = false;
    if (isMax) peaks.push({ minutes: i * 30 + 15, share: share[i] });
  }
  const spaced = [];
  for (const p of peaks.sort((a, b) => b.share - a.share)) {
    if (spaced.every((q) => Math.min(Math.abs(q.minutes - p.minutes), 1440 - Math.abs(q.minutes - p.minutes)) >= 90)) spaced.push(p);
  }
  const hourly = new Array(24).fill(0);
  bins.forEach((c, i) => { hourly[Math.floor(i / 2)] += c; });
  return {
    days,
    hourly: hourly.map((c) => c / days),
    anchors: spaced.sort((a, b) => a.minutes - b.minutes),
  };
}

export function analyse(rawFeeds, now = Date.now()) {
  const feeds = sortedFeeds(rawFeeds);
  const result = { feedCount: feeds.length };
  if (feeds.length < 4) return result;

  const nights = buildNights(feeds, now);
  const recentNights = nights.slice(-14);
  result.nights = recentNights;
  result.overnight = {
    ...classify(nights, { minDelta: 0.33 }),
    last: nights.length ? nights[nights.length - 1] : null,
    best: recentNights.length ? recentNights.reduce((a, b) => (b.hours > a.hours ? b : a)) : null,
    count: nights.length,
  };
  if (recentNights.length >= MIN_NIGHTS) {
    const bed = clockFrom(median(recentNights.map((n) => minutesSince(n.start, 12))), 12);
    const wake = clockFrom(median(recentNights.map((n) => minutesSince(n.end, 18))), 18);
    result.overnight.bedtimeFeed = bed;
    result.overnight.stretchEnds = wake;
  }

  const totals = buildDailyTotals(feeds, now);
  result.dailyTotals = totals.slice(-14);
  const volumeMean = totals.length ? mean(totals.map((t) => t.v)) : 0;
  result.volume = { ...classify(totals, { minDelta: volumeMean * 0.05 }), count: totals.length };

  result.daytimeGaps = classify(buildDaytimeGaps(feeds), { minDelta: 0.25, minN: 12 });
  result.times = buildFeedingTimes(feeds, now);
  return result;
}
