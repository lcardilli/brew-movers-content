'use strict';

const fetch = require('node-fetch');

// ---------------------------------------------------------------------------
// BEVERAGE VERTICALS — one representative logistics keyword per vertical
// ---------------------------------------------------------------------------
// Broad category keywords — high enough volume to produce meaningful trend data
const VERTICALS = [
  { name: 'Craft Beer',           keyword: 'craft beer' },
  { name: 'Functional Beverages', keyword: 'functional beverages' },
  { name: 'RTD Cocktails',        keyword: 'ready to drink cocktails' },
  { name: 'Energy Drinks',        keyword: 'energy drinks' },
  { name: 'Hard Seltzer',         keyword: 'hard seltzer' },
  { name: 'Wine',                 keyword: 'wine delivery' },
  { name: 'Spirits',              keyword: 'spirits delivery' },
  { name: 'Kombucha',             keyword: 'kombucha' },
  { name: 'Cannabis Beverages',   keyword: 'cannabis drinks' },
  { name: 'Cold Brew',            keyword: 'cold brew coffee' },
];

// ---------------------------------------------------------------------------
// FETCH TREND FOR ONE VERTICAL
// SEMrush Tr column = 12 monthly volumes oldest→newest, comma-separated
// ---------------------------------------------------------------------------
async function fetchVerticalTrend(apiKey, vertical) {
  const params = new URLSearchParams({
    type: 'phrase_this',
    key: apiKey,
    phrase: vertical.keyword,
    database: 'us',
    export_columns: 'Ph,Nq,Co,Tr',
  });

  try {
    const res = await fetch(`https://api.semrush.com/?${params}`, { timeout: 8000 });
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null;

    const [ph, nq, , tr] = lines[1].split(';');
    const volume = parseInt(nq, 10);
    if (!ph || isNaN(volume)) return null;

    const monthlyVolumes = tr
      ? tr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
      : [];

    let trendPct  = 0;
    let direction = 'stable';

    // Compare current month (last value) vs previous month (second-to-last)
    if (monthlyVolumes.length >= 2) {
      const current  = monthlyVolumes[monthlyVolumes.length - 1];
      const previous = monthlyVolumes[monthlyVolumes.length - 2];

      if (previous > 0) {
        trendPct = Math.round(((current - previous) / previous) * 100);
      }

      if (trendPct >= 5)       direction = 'rising';
      else if (trendPct <= -5) direction = 'declining';
    }

    return {
      name: vertical.name,
      keyword: ph.trim(),
      volume,
      trendPct,
      direction,
      monthlyVolumes,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// FETCH ALL VERTICALS IN PARALLEL
// ---------------------------------------------------------------------------
async function fetchVerticalTrends(apiKey) {
  const results = await Promise.all(VERTICALS.map(v => fetchVerticalTrend(apiKey, v)));
  return results.filter(Boolean);
}

module.exports = { fetchVerticalTrends, VERTICALS };
