'use strict';

// SEMrush Keywords API — phrase_related endpoint
// Docs: https://developer.semrush.com/api/v3/analytics/keyword-reports/
// Auth: API key passed as `key` query param
// Response: semicolon-delimited CSV

const SEED_KEYWORDS = [
  'beverage logistics',
  'beer distribution',
  'cold chain logistics',
  'alcohol shipping',
  'brewery supply chain'
];

// Fallback keyword data used when the SEMrush API is unavailable
const FALLBACK_KEYWORDS = [
  { keyword: 'cold chain logistics', volume: 8100, difficulty: 55 },
  { keyword: 'beverage distribution', volume: 4400, difficulty: 40 },
  { keyword: 'alcohol shipping regulations', volume: 2900, difficulty: 33 },
  { keyword: 'beer distribution company', volume: 2400, difficulty: 38 },
  { keyword: 'brewery logistics', volume: 1900, difficulty: 30 },
  { keyword: 'beverage logistics', volume: 1600, difficulty: 35 },
  { keyword: 'cold storage transportation', volume: 1500, difficulty: 48 },
  { keyword: 'alcohol beverage supply chain', volume: 1200, difficulty: 36 },
  { keyword: 'beer supply chain management', volume: 880, difficulty: 32 },
  { keyword: 'craft beer distribution', volume: 720, difficulty: 29 },
  { keyword: 'wine distribution logistics', volume: 680, difficulty: 31 },
  { keyword: 'brewery supply chain', volume: 590, difficulty: 28 },
  { keyword: 'refrigerated freight beverages', volume: 480, difficulty: 42 },
  { keyword: 'beverage cold chain management', volume: 390, difficulty: 37 },
  { keyword: 'alcohol distribution network', volume: 320, difficulty: 44 },
  { keyword: 'beer delivery logistics', volume: 290, difficulty: 26 },
  { keyword: 'temperature controlled beverage shipping', volume: 260, difficulty: 39 },
  { keyword: 'keg distribution logistics', volume: 210, difficulty: 22 },
  { keyword: 'liquor supply chain', volume: 190, difficulty: 34 },
  { keyword: 'beverage freight broker', volume: 170, difficulty: 41 }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse SEMrush CSV response (semicolon-delimited, first row is headers).
 * Returns an array of plain objects keyed by column name.
 */
function parseSemrushCsv(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(';').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(';');
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] || '').trim(); });
    return row;
  });
}

async function fetchKeywordIdeas(apiKey) {
  if (!apiKey) {
    console.warn('SEMRUSH_API_KEY not set — using fallback keywords');
    return FALLBACK_KEYWORDS;
  }

  const allKeywords = [];

  for (let i = 0; i < SEED_KEYWORDS.length; i++) {
    const phrase = SEED_KEYWORDS[i];
    try {
      const params = new URLSearchParams({
        type: 'phrase_related',
        key: apiKey,
        phrase,
        database: 'us',
        export_columns: 'Ph,Nq,Cp,Co,Nr,Kd',
        display_limit: '20',
        display_sort: 'nq_desc'
      });

      const response = await fetch(`https://api.semrush.com/?${params}`);

      if (!response.ok) {
        console.warn(`SEMrush API HTTP error for "${phrase}": ${response.status}`);
        continue;
      }

      const text = await response.text();

      // SEMrush returns plain-text error messages (not HTTP errors) for issues like no data
      if (text.startsWith('ERROR') || text.startsWith('Nothing found')) {
        console.warn(`SEMrush no data for "${phrase}": ${text.slice(0, 80)}`);
        continue;
      }

      const rows = parseSemrushCsv(text);
      const parsed = rows
        .map(r => ({
          keyword: r['Ph'] || '',
          volume: Number(r['Nq']) || 0,
          difficulty: Number(r['Kd']) || Math.round(Number(r['Co'] || 0) * 100)
        }))
        .filter(k => k.keyword);

      allKeywords.push(...parsed);
    } catch (err) {
      console.warn(`Error fetching SEMrush keywords for "${phrase}":`, err.message);
    }

    // Respect SEMrush rate limits between requests
    if (i < SEED_KEYWORDS.length - 1) {
      await sleep(600);
    }
  }

  if (allKeywords.length === 0) {
    console.warn('No SEMrush data returned — using fallback keywords');
    return FALLBACK_KEYWORDS;
  }

  // Deduplicate by keyword text
  const seen = new Set();
  const unique = allKeywords.filter(k => {
    const key = k.keyword.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by volume descending, take top 20
  return unique.sort((a, b) => b.volume - a.volume).slice(0, 20);
}

module.exports = { fetchKeywordIdeas };
