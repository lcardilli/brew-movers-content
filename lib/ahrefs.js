'use strict';

const SEED_KEYWORDS = [
  'beverage logistics',
  'beer distribution',
  'cold chain logistics',
  'alcohol shipping',
  'brewery supply chain'
];

// Fallback keyword data used when Ahrefs API is unavailable
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

async function fetchKeywordIdeas(token) {
  const allKeywords = [];

  for (let i = 0; i < SEED_KEYWORDS.length; i++) {
    const keyword = SEED_KEYWORDS[i];
    try {
      const params = new URLSearchParams({
        country: 'us',
        keyword,
        select: 'keyword,volume,difficulty',
        limit: '20',
        order_by: 'volume:desc'
      });

      const response = await fetch(
        `https://api.ahrefs.com/v3/keywords-explorer/matching-terms?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const body = await response.text();
        console.warn(`Ahrefs API error for "${keyword}": ${response.status} — ${body}`);
        continue;
      }

      const data = await response.json();
      // Handle different possible response shapes across API versions
      const raw = data.keywords || data.data || data.results || data.terms || [];
      const parsed = raw
        .map(k => ({
          keyword: k.keyword || k.term || k.query || '',
          volume: Number(k.volume || k.search_volume || k.sv || 0),
          difficulty: Number(k.difficulty || k.kd || k.keyword_difficulty || 0)
        }))
        .filter(k => k.keyword);

      allKeywords.push(...parsed);
    } catch (err) {
      console.warn(`Error fetching Ahrefs keywords for "${keyword}":`, err.message);
    }

    // Respect Ahrefs rate limit between requests
    if (i < SEED_KEYWORDS.length - 1) {
      await sleep(600);
    }
  }

  if (allKeywords.length === 0) {
    console.warn('No Ahrefs data returned — using fallback keywords');
    return FALLBACK_KEYWORDS;
  }

  // Deduplicate by keyword text
  const seen = new Set();
  const unique = allKeywords.filter(k => {
    if (seen.has(k.keyword.toLowerCase())) return false;
    seen.add(k.keyword.toLowerCase());
    return true;
  });

  // Sort by volume descending, take top 20
  return unique.sort((a, b) => b.volume - a.volume).slice(0, 20);
}

module.exports = { fetchKeywordIdeas };
