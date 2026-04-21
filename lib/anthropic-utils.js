'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const fetch = require('node-fetch');

// Seed keywords covering the full beverage logistics space
const SEED_KEYWORDS = [
  'beverage logistics company',
  'energy drink distribution',
  'RTD beverage shipping',
  'wine and spirits logistics',
  'functional beverage supply chain',
  'cold chain beverage shipping',
  'alcohol distribution company',
  'beverage 3pl provider',
  'craft beverage fulfillment',
  'ready to drink cocktail distribution',
];

// RSS feeds as fallback for industry context
const RSS_FEEDS = [
  { name: 'Beverage Daily',          url: 'https://www.beveragedaily.com/rss/news' },
  { name: 'Food & Beverage Insider', url: 'https://www.foodbeverageinsider.com/rss/all' },
  { name: 'Food Logistics',          url: 'https://www.foodlogistics.com/rss/all' },
  { name: 'BevNet',                  url: 'https://www.bevnet.com/news/feed' },
];

// Query SEMrush phrase_this for a single keyword — returns { keyword, volume, competition } or null
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

// Fetch keyword data from SEMrush for all seed keywords
async function fetchKeywordData(semrushKey) {
  const results = await Promise.all(SEED_KEYWORDS.map(kw => querySemrush(semrushKey, kw)));
  return results
    .filter(Boolean)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);
}

// Fetch RSS headlines for industry context
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
  return results.flat().slice(0, 10);
}

async function generateContentIdeas(apiKey, semrushKey) {
  const client = new Anthropic({ apiKey });

  // Fetch keyword data and headlines in parallel
  const [keywords, headlines] = await Promise.all([
    semrushKey ? fetchKeywordData(semrushKey) : Promise.resolve([]),
    fetchRssHeadlines(),
  ]);

  const keywordSection = keywords.length > 0
    ? `## SEMrush Keyword Data (US search volume):\n` +
      keywords.map(k => `- "${k.keyword}" — ${k.volume.toLocaleString()} searches/mo, competition: ${k.competition.toFixed(2)}`).join('\n')
    : `## Keyword Data:\nNot available — use your knowledge of beverage logistics search trends.`;

  const headlineSection = headlines.length > 0
    ? `## Recent Industry Headlines:\n` + headlines.join('\n')
    : `## Recent Industry Headlines:\nNot available.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `You are an SEO content strategist for Brew Movers, a full-scale beverage logistics company. While they started with breweries, their primary growth is now in energy drinks, functional beverages, RTD cocktails, spirits, and wine. Content should reflect the full beverage industry — not be beer-focused.

Use the keyword data and headlines below to generate 5 SEO-driven blog content ideas.

${keywordSection}

${headlineSection}

Return a valid JSON array. Each object must have exactly these fields:
{
  "title": "specific, compelling, SEO-optimized title",
  "targetKeyword": "primary keyword phrase to rank for (use the SEMrush data where relevant)",
  "searchIntent": "informational" | "commercial" | "navigational",
  "contentAngle": "2 sentences on the unique angle and why it suits Brew Movers' positioning in the broader beverage logistics space",
  "suggestedWordCount": 1200,
  "source": "which keyword or headline inspired this idea"
}

Rules:
- Prioritise keywords with meaningful search volume from the SEMrush data
- Spread ideas across beverage categories — energy drinks, RTD, spirits, wine, functional beverages
- Titles must be specific, not generic
- suggestedWordCount must be a plain number between 800 and 3000
- Vary search intent across the 5 ideas
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
