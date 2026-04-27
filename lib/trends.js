'use strict';

const fetch = require('node-fetch');

// ---------------------------------------------------------------------------
// BEVERAGE VERTICALS — Kombucha merged into Functional; Sports Drinks added
// ---------------------------------------------------------------------------
const VERTICALS = [
  { name: 'Energy Drinks',        keyword: 'energy drinks' },
  { name: 'Hard Seltzer',         keyword: 'hard seltzer' },
  { name: 'Cold Brew',            keyword: 'cold brew coffee' },
  { name: 'Craft Beer',           keyword: 'craft beer' },
  { name: 'Wine',                 keyword: 'wine delivery' },
  { name: 'Functional Beverages', keyword: 'functional beverages' },
  { name: 'RTD Cocktails',        keyword: 'ready to drink cocktails' },
  { name: 'Cannabis Beverages',   keyword: 'cannabis drinks' },
  { name: 'Sports Drinks',        keyword: 'sports drinks' },
  { name: 'Spirits',              keyword: 'spirits delivery' },
];

// ---------------------------------------------------------------------------
// HELPERS — date strings for SEMrush date param (YYYYMM01)
// ---------------------------------------------------------------------------
function semrushDate(year, month) {
  return `${year}${String(month + 1).padStart(2, '0')}01`;
}

function currentAndPreviousDates() {
  const now  = new Date();
  const cy   = now.getFullYear();
  const cm   = now.getMonth();           // 0-indexed
  const py   = cm === 0 ? cy - 1 : cy;
  const pm   = cm === 0 ? 11 : cm - 1;
  return { currentDate: semrushDate(cy, cm), previousDate: semrushDate(py, pm) };
}

// ---------------------------------------------------------------------------
// SINGLE SEMRUSH QUERY — returns { keyword, volume } or null
// ---------------------------------------------------------------------------
async function queryVolume(apiKey, keyword, date) {
  const params = new URLSearchParams({
    type: 'phrase_this',
    key: apiKey,
    phrase: keyword,
    database: 'us',
    export_columns: 'Ph,Nq',
    date,
  });
  try {
    const res = await fetch(`https://api.semrush.com/?${params}`, { timeout: 8000 });
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null;
    const [ph, nq] = lines[1].split(';');
    const volume = parseInt(nq, 10);
    if (!ph || isNaN(volume)) return null;
    return { keyword: ph.trim(), volume };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// FETCH TREND FOR ONE VERTICAL — two Nq calls, current vs previous month
// ---------------------------------------------------------------------------
async function fetchVerticalTrend(apiKey, vertical, currentDate, previousDate) {
  const [current, previous] = await Promise.all([
    queryVolume(apiKey, vertical.keyword, currentDate),
    queryVolume(apiKey, vertical.keyword, previousDate),
  ]);

  if (!current) return null;

  let trendPct  = 0;
  let direction = 'stable';

  if (previous && previous.volume > 0) {
    trendPct = Math.round(((current.volume - previous.volume) / previous.volume) * 100);
    if (trendPct >= 5)       direction = 'rising';
    else if (trendPct <= -5) direction = 'declining';
  }

  return {
    name:       vertical.name,
    keyword:    current.keyword,
    volume:     current.volume,
    prevVolume: previous?.volume ?? null,
    trendPct,
    direction,
  };
}

// ---------------------------------------------------------------------------
// FETCH ALL VERTICALS IN PARALLEL
// ---------------------------------------------------------------------------
async function fetchVerticalTrends(apiKey) {
  const { currentDate, previousDate } = currentAndPreviousDates();
  const results = await Promise.all(
    VERTICALS.map(v => fetchVerticalTrend(apiKey, v, currentDate, previousDate))
  );
  return results.filter(Boolean);
}

module.exports = { fetchVerticalTrends, VERTICALS };
