'use strict';

const fetch = require('node-fetch');

// ---------------------------------------------------------------------------
// BEVERAGE VERTICALS
// keyword       = broad category term  → market size
// intentKeyword = logistics-specific   → buyer intent signal
// ---------------------------------------------------------------------------
const VERTICALS = [
  { name: 'Energy Drinks',        keyword: 'energy drinks' },
  { name: 'Hard Seltzer',         keyword: 'hard seltzer' },
  { name: 'Coffee',               keyword: 'cold brew coffee' },
  { name: 'Craft Beer',           keyword: 'craft beer' },
  { name: 'Wine',                 keyword: 'wine delivery' },
  { name: 'Functional Beverages', keyword: 'functional beverages' },
  { name: 'RTD Cocktails',        keyword: 'ready to drink cocktails' },
  { name: 'Cannabis Beverages',   keyword: 'cannabis drinks' },
  { name: 'Sports Drinks',        keyword: 'sports drinks' },
  { name: 'Spirits',              keyword: 'spirits delivery' },
];

// ---------------------------------------------------------------------------
// SINGLE QUERY — current rolling average (no date param; most reliable)
// ---------------------------------------------------------------------------
async function queryVolume(apiKey, keyword) {
  const params = new URLSearchParams({
    type: 'phrase_this',
    key: apiKey,
    phrase: keyword,
    database: 'us',
    export_columns: 'Ph,Nq',
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
// FETCH CURRENT SNAPSHOT — volume + intent per vertical (no trend calc here;
// trends are calculated in api/trends.js from accumulated history)
// ---------------------------------------------------------------------------
async function fetchCurrentSnapshot(apiKey) {
  const results = await Promise.all(
    VERTICALS.map(async v => {
      const current = await queryVolume(apiKey, v.keyword);
      if (!current) return null;
      return {
        name:    v.name,
        keyword: current.keyword,
        volume:  current.volume,
      };
    })
  );
  return results.filter(Boolean);
}

module.exports = { fetchCurrentSnapshot, VERTICALS };
