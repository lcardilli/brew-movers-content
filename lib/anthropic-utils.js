'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const fetch = require('node-fetch');

// ---------------------------------------------------------------------------
// SEED KEYWORDS — targeting beverage brand decision-makers, not logistics cos
// ---------------------------------------------------------------------------
const SEED_KEYWORDS = [
  // General
  'beverage fulfillment services',
  'outsource beverage logistics',
  'beverage distribution partner',
  // Energy drinks
  'how to distribute energy drinks',
  'energy drink fulfillment center',
  // Functional beverages
  'functional beverage fulfillment',
  'how to distribute functional drinks',
  // RTD
  'RTD cocktail distribution',
  'how to ship ready to drink beverages',
  // Wine & Spirits
  'wine fulfillment service',
  'spirits shipping company',
  'alcohol fulfillment service',
  // Cold chain
  'cold chain shipping for beverages',
  'temperature controlled drink shipping',
  // Equipment & supplies
  'beverage equipment shipping',
  'drink packaging fulfillment',
];

// ---------------------------------------------------------------------------
// EXISTING SITE CONTENT — crawled from brewmovers.com, used for gap analysis
// ---------------------------------------------------------------------------
const EXISTING_SITE_CONTENT = {
  servicePages: [
    'Direct to Consumer (Beer, Spirits, Wine)',
    'Cold Chain Shipping',
    'FTL Shipping (Dry Van, Flatbeds, Refrigerated)',
    'LTL Shipping',
    'Small Parcel Shipping',
    'Beverage Packaging',
    'Beverage & Brewery Equipment',
    'CPG Logistics',
    'Festival Logistics',
    'Trade Show Logistics',
    'Fresh Ingredients',
    'Craft Beverages (Beer, Cannabis, Cider, Coffee, Kombucha, Seltzer, Soda, Spirits, Sports & Energy Drinks, Wine, Tea)',
  ],
  locationPages: ['Denver', 'San Diego', 'Toronto', 'Virginia Beach'],
  resourcePages: [
    'Cargo Claims guide',
    'Outsource vs In-house Logistics',
    'Freight Density Calculator',
    'Logistics Glossary',
    'FAQs',
  ],
  knownGaps: [
    'No dedicated service page for Energy Drinks',
    'No dedicated service page for Functional Beverages',
    'No dedicated service page for RTD Cocktails',
    'No pillar/guide content for individual beverage verticals',
    'No case studies',
    'No landing pages targeting specific beverage brand segments',
    'Limited location pages — major metros like NYC, LA, Chicago, Houston missing',
  ],
};

// ---------------------------------------------------------------------------
// SEASONAL CONTEXT
// ---------------------------------------------------------------------------
function getSeasonalContext() {
  // Shift 60 days forward to account for approval + publishing lead time
  const publishDate = new Date();
  publishDate.setDate(publishDate.getDate() + 60);
  const month = publishDate.getMonth() + 1; // 1–12

  if (month >= 11 || month === 1)  return 'Content will publish during Q4/holiday season: focus on expedited beverage shipping, year-end inventory build-up, gift spirits and wine demand surges, and holiday fulfillment capacity planning.';
  if (month >= 8 && month <= 10)   return 'Content will publish in Fall: focus on back-to-shelf restocking, pre-holiday inventory planning for spirits and wine, and craft beverage distribution ahead of peak season.';
  if (month >= 5 && month <= 7)    return 'Content will publish in Summer: focus on RTD and cold beverage demand surges, festival and event logistics, energy drink distribution peaks, and cold chain shipping for warm months.';
  return 'Content will publish in Q1: focus on new product launch distribution strategies, post-holiday portfolio restructuring, and beverage brands planning their annual logistics partnerships.';
}

// ---------------------------------------------------------------------------
// APPROVAL LEARNING — analyse existing ideas to find patterns
// ---------------------------------------------------------------------------
function analyseApprovalPatterns(existingIdeas) {
  const approved = existingIdeas.filter(i => i.status === 'approved');
  const rejected = existingIdeas.filter(i => i.status === 'rejected');

  const topKeywords = kw => kw.map(i => i.targetKeyword).filter(Boolean);

  return {
    approvedKeywords: topKeywords(approved).slice(0, 10),
    rejectedKeywords: topKeywords(rejected).slice(0, 10),
    approvedTitles: approved.map(i => i.title).slice(0, 8),
    rejectedTitles: rejected.map(i => i.title).slice(0, 8),
    totalApproved: approved.length,
    totalRejected: rejected.length,
  };
}

// ---------------------------------------------------------------------------
// SEMRUSH — keyword overview for seed keywords
// ---------------------------------------------------------------------------
async function querySemrush(apiKey, keyword) {
  const params = new URLSearchParams({
    type: 'phrase_this',
    key: apiKey,
    phrase: keyword,
    database: 'us',
    export_columns: 'Ph,Nq,Co',
  });
  try {
    const res = await fetch(`https://api.semrush.com/?${params}`, { timeout: 8000 });
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null;
    const [ph, nq, co] = lines[1].split(';');
    const volume = parseInt(nq, 10);
    if (!ph || isNaN(volume)) return null;
    return { keyword: ph.trim(), volume, competition: parseFloat(co) || 0 };
  } catch {
    return null;
  }
}

async function fetchKeywordData(semrushKey) {
  const results = await Promise.all(SEED_KEYWORDS.map(kw => querySemrush(semrushKey, kw)));
  return results.filter(Boolean).sort((a, b) => b.volume - a.volume).slice(0, 10);
}

// ---------------------------------------------------------------------------
// RSS — industry headlines for timeliness
// ---------------------------------------------------------------------------
const RSS_FEEDS = [
  { name: 'FreightWaves',           url: 'https://www.freightwaves.com/news/feed' },
  { name: 'Supply Chain Dive',      url: 'https://www.supplychaindive.com/feeds/news/' },
  { name: 'Beverage Daily',         url: 'https://www.beveragedaily.com/rss/news' },
  { name: 'Food & Beverage Insider',url: 'https://www.foodbeverageinsider.com/rss/all' },
  { name: 'BevNet',                 url: 'https://www.bevnet.com/news/feed' },
];

async function fetchRssHeadlines() {
  async function fetchFeed(feed) {
    try {
      const res = await fetch(feed.url, { timeout: 5000 });
      if (!res.ok) return [];
      const xml = await res.text();
      const items = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && items.length < 3) {
        const block = match[1];
        const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                       block.match(/<title>(.*?)<\/title>/))?.[1]?.trim();
        if (title) items.push(`[${feed.name}] ${title}`);
      }
      return items;
    } catch {
      return [];
    }
  }
  const results = await Promise.all(RSS_FEEDS.map(fetchFeed));
  return results.flat().slice(0, 12);
}

// ---------------------------------------------------------------------------
// MAIN EXPORT
// ---------------------------------------------------------------------------
async function generateContentIdeas(apiKey, semrushKey, existingIdeas = []) {
  const client = new Anthropic({ apiKey });
  const currentYear = new Date().getFullYear();

  // Run all data fetching in parallel
  const [keywords, headlines] = await Promise.all([
    semrushKey ? fetchKeywordData(semrushKey) : Promise.resolve([]),
    fetchRssHeadlines(),
  ]);

  const patterns = analyseApprovalPatterns(existingIdeas);
  const seasonalContext = getSeasonalContext();
  const previousTitles = existingIdeas.map(i => i.title).slice(-30); // last 30

  // Build prompt sections
  const keywordSection = keywords.length > 0
    ? `## SEMrush Keyword Data (US search volume):\n` +
      keywords.map(k => `- "${k.keyword}" — ${k.volume.toLocaleString()} searches/mo, competition: ${k.competition.toFixed(2)}`).join('\n')
    : `## Keyword Data:\nNot available — use your knowledge of beverage logistics search trends.`;

  const headlineSection = headlines.length > 0
    ? `## Recent Industry Headlines (flag any with logistical implications for beverage brands):\n` + headlines.join('\n')
    : '';

  const patternSection = (patterns.totalApproved + patterns.totalRejected) > 0
    ? `## Approval Patterns (learn from these):
Approved keywords (lean into these): ${patterns.approvedKeywords.join(', ') || 'none yet'}
Rejected keywords (avoid these): ${patterns.rejectedKeywords.join(', ') || 'none yet'}
Total approved: ${patterns.totalApproved} | Total rejected: ${patterns.totalRejected}`
    : '';

  const previousSection = previousTitles.length > 0
    ? `## Previously Generated Titles (do NOT repeat or closely duplicate these):\n` +
      previousTitles.map(t => `- ${t}`).join('\n')
    : '';

  const gapSection = `## Existing Site Content & Known Gaps:
Service pages already exist for: ${EXISTING_SITE_CONTENT.servicePages.join(', ')}
Resource pages: ${EXISTING_SITE_CONTENT.resourcePages.join(', ')}
Location pages: ${EXISTING_SITE_CONTENT.locationPages.join(', ')}

Known content gaps (prioritise ideas that fill these):
${EXISTING_SITE_CONTENT.knownGaps.map(g => `- ${g}`).join('\n')}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1800,
    messages: [
      {
        role: 'user',
        content: `You are an SEO content strategist for Brew Movers, a full-scale beverage logistics company based in Charlotte, NC. They help beverage BRANDS (energy drinks, functional beverages, RTD cocktails, wine, spirits, craft beverages) solve their shipping and distribution challenges. Brew Movers is NOT a brewery — do not write content targeting other logistics companies. Target beverage brand owners, founders, and supply chain managers searching for logistics solutions.

## Seasonal Context:
${seasonalContext}

${keywordSection}

${headlineSection}

${patternSection}

${previousSection}

${gapSection}

Generate exactly 5 SEO-driven content ideas with this EXACT content type distribution — no exceptions:
- Idea 1: contentType must be "service-page"
- Idea 2: contentType must be "pillar-guide"
- Idea 3: contentType must be "blog"
- Idea 4: contentType must be "landing-page" or "location-page"
- Idea 5: contentType must be "blog"

Return a valid JSON array where each object has exactly these fields:
{
  "title": "specific, compelling, SEO-optimized title",
  "contentType": "blog" | "service-page" | "pillar-guide" | "landing-page" | "location-page",
  "targetKeyword": "primary keyword phrase to rank for",
  "searchIntent": "informational" | "commercial" | "navigational",
  "contentAngle": "2 sentences — the unique angle and why it suits Brew Movers' positioning as a beverage logistics partner",
  "suggestedWordCount": 1200,
  "source": "what inspired this — keyword data, headline, seasonal trend, or site gap",
  "urgent": false
}

Set "urgent" to true ONLY if the idea is directly triggered by a breaking industry change, regulatory update, or news headline that beverage brands need to act on immediately — these should be published ASAP and are exempt from seasonal forward-planning. All other ideas should have urgent: false.

Rules:
- Prioritise filling known site gaps (service pages for Energy Drinks, Functional Beverages, RTD; pillar guides; location pages)
- Use SEMrush volume data to validate keyword choices where available
- If a headline has logistical implications for beverage brands, turn it into a timely content idea
- Avoid repeating previous titles
- Lean into approved keyword patterns, avoid rejected ones
- suggestedWordCount must be a plain number between 800 and 3000
- The current year is ${currentYear}. If you reference a year in a title, it must be ${currentYear}. Never use a past year.
- Return ONLY the JSON array. No markdown, no explanation.`
      }
    ]
  });

  const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const cleaned = raw.replace(/```(?:json)?\n?/g, '').trim();
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Claude did not return a valid JSON array. Raw: ' + raw.slice(0, 300));

  const ideas = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(ideas) || ideas.length === 0) throw new Error('Unexpected empty array from Claude.');

  return ideas;
}

module.exports = { generateContentIdeas };
