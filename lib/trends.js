'use strict';

const fetch = require('node-fetch');

// ---------------------------------------------------------------------------
// BEVERAGE VERTICALS
// keyword       = broad category term  → market size
// intentKeyword = logistics-specific   → buyer intent signal
// ---------------------------------------------------------------------------
// intentKeywords: multiple terms covering shipping, distribution, fulfillment,
// logistics — volumes are summed to give a complete picture of buyer intent
const VERTICALS = [
  { name: 'Energy Drinks',        keyword: 'energy drinks',
    intentKeywords: ['energy drink shipping', 'energy drink distribution', 'energy drink fulfillment', 'energy drink logistics'] },
  { name: 'Hard Seltzer',         keyword: 'hard seltzer',
    intentKeywords: ['hard seltzer shipping', 'hard seltzer distribution', 'seltzer fulfillment', 'hard seltzer logistics'] },
  { name: 'Coffee',               keyword: 'cold brew coffee',
    intentKeywords: ['cold brew shipping', 'cold brew distribution', 'cold brew fulfillment', 'coffee beverage logistics'] },
  { name: 'Craft Beer',           keyword: 'craft beer',
    intentKeywords: ['craft beer shipping', 'craft beer distribution', 'beer fulfillment', 'brewery logistics'] },
  { name: 'Wine',                 keyword: 'wine delivery',
    intentKeywords: ['wine shipping', 'wine distribution', 'wine fulfillment', 'wine logistics'] },
  { name: 'Functional Beverages', keyword: 'functional beverages',
    intentKeywords: ['functional beverage shipping', 'functional beverage distribution', 'functional beverage fulfillment', 'nutraceutical logistics'] },
  { name: 'RTD Cocktails',        keyword: 'ready to drink cocktails',
    intentKeywords: ['rtd cocktail shipping', 'ready to drink distribution', 'rtd fulfillment', 'canned cocktail shipping'] },
  { name: 'Cannabis Beverages',   keyword: 'cannabis drinks',
    intentKeywords: ['cannabis beverage shipping', 'cannabis beverage distribution', 'thc drink fulfillment', 'cannabis logistics'] },
  { name: 'Sports Drinks',        keyword: 'sports drinks',
    intentKeywords: ['sports drink shipping', 'sports drink distribution', 'sports drink fulfillment', 'sports beverage logistics'] },
  { name: 'Spirits',              keyword: 'spirits delivery',
    intentKeywords: ['spirits shipping', 'spirits distribution', 'liquor fulfillment', 'alcohol logistics'] },
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
      // Fetch broad keyword + all intent keywords in parallel
      const [current, ...intentResults] = await Promise.all([
        queryVolume(apiKey, v.keyword),
        ...v.intentKeywords.map(kw => queryVolume(apiKey, kw)),
      ]);
      if (!current) return null;

      // Sum all intent keyword volumes (treat missing as 0)
      const intentVolume = intentResults.reduce((sum, r) => sum + (r?.volume || 0), 0);

      return {
        name:         v.name,
        keyword:      current.keyword,
        volume:       current.volume,
        intentVolume, // always a number, never null
      };
    })
  );
  return results.filter(Boolean);
}

module.exports = { fetchCurrentSnapshot, VERTICALS };
