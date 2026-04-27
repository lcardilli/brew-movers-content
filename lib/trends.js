'use strict';

const fetch = require('node-fetch');

// ---------------------------------------------------------------------------
// BEVERAGE VERTICALS
// keyword        = broad category term  → market size + trend direction
// intentKeyword  = logistics-specific   → buyer intent (active sourcing signal)
// ---------------------------------------------------------------------------
const VERTICALS = [
  { name: 'Energy Drinks',        keyword: 'energy drinks',            intentKeyword: 'energy drink distribution' },
  { name: 'Hard Seltzer',         keyword: 'hard seltzer',             intentKeyword: 'hard seltzer distribution' },
  { name: 'Cold Brew',            keyword: 'cold brew coffee',          intentKeyword: 'cold brew distribution' },
  { name: 'Craft Beer',           keyword: 'craft beer',               intentKeyword: 'craft beer distribution' },
  { name: 'Wine',                 keyword: 'wine delivery',            intentKeyword: 'wine fulfillment service' },
  { name: 'Functional Beverages', keyword: 'functional beverages',     intentKeyword: 'functional beverage fulfillment' },
  { name: 'RTD Cocktails',        keyword: 'ready to drink cocktails', intentKeyword: 'rtd beverage 3pl' },
  { name: 'Cannabis Beverages',   keyword: 'cannabis drinks',          intentKeyword: 'cannabis beverage distribution' },
  { name: 'Sports Drinks',        keyword: 'sports drinks',            intentKeyword: 'sports drink distribution' },
  { name: 'Spirits',              keyword: 'spirits delivery',         intentKeyword: 'spirits shipping company' },
];

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function semrushDate(year, month) {
  return `${year}${String(month + 1).padStart(2, '0')}01`;
}

// Year-over-year: same month last year — avoids the rolling-average flatness
// of month-over-month comparisons on phrase_this data
function currentAndPreviousDates() {
  const now = new Date();
  const cy  = now.getFullYear();
  const cm  = now.getMonth();
  return {
    currentDate:  semrushDate(cy,      cm),
    previousDate: semrushDate(cy - 1,  cm), // same month, prior year
  };
}

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
// FETCH ONE VERTICAL — 3 SEMrush calls:
//   1. Broad keyword, current month  → market volume + trend base
//   2. Broad keyword, previous month → trend comparison
//   3. Intent keyword, current month → buyer intent signal
// ---------------------------------------------------------------------------
async function fetchVerticalTrend(apiKey, vertical, currentDate, previousDate) {
  const [current, previous, intent] = await Promise.all([
    queryVolume(apiKey, vertical.keyword,       currentDate),
    queryVolume(apiKey, vertical.keyword,       previousDate),
    queryVolume(apiKey, vertical.intentKeyword, currentDate),
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
    name:         vertical.name,
    keyword:      current.keyword,
    volume:       current.volume,
    prevVolume:   previous?.volume ?? null,
    intentVolume: intent?.volume   ?? null,
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
