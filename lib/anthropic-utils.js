'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const fetch = require('node-fetch');

// RSS feeds covering beverage industry broadly (no API key required)
const RSS_FEEDS = [
  { name: 'Food & Beverage Insider', url: 'https://www.foodbeverageinsider.com/rss/all' },
  { name: 'Beverage Daily', url: 'https://www.beveragedaily.com/rss/news' },
  { name: 'Food Logistics', url: 'https://www.foodlogistics.com/rss/all' },
  { name: 'Craft Brewing Business', url: 'https://www.craftbrewingbusiness.com/feed/' },
  { name: 'Bevnet', url: 'https://www.bevnet.com/news/feed' },
];

// Fetch and parse RSS feed — returns up to maxItems headlines
async function fetchFeed(feed, maxItems = 4) {
  try {
    const res = await fetch(feed.url, { timeout: 5000 });
    if (!res.ok) return [];
    const xml = await res.text();

    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
      const block = match[1];
      const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                     block.match(/<title>(.*?)<\/title>/))?.[1]?.trim();
      const desc  = (block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                     block.match(/<description>(.*?)<\/description>/))?.[1]
                      ?.replace(/<[^>]+>/g, '')
                      ?.slice(0, 120)
                      ?.trim();
      if (title) items.push(desc ? `${title} — ${desc}` : title);
    }
    return items.map(i => `[${feed.name}] ${i}`);
  } catch {
    return [];
  }
}

async function generateContentIdeas(apiKey) {
  const client = new Anthropic({ apiKey });

  // Fetch headlines from all feeds in parallel
  const results = await Promise.all(RSS_FEEDS.map(f => fetchFeed(f)));
  const headlines = results.flat().slice(0, 20); // cap at 20 headlines

  const researchText = headlines.length > 0
    ? headlines.join('\n')
    : 'No recent headlines retrieved — generate ideas from current industry knowledge.';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `You are an SEO content strategist for Brew Movers, a full-scale beverage logistics company. While Brew Movers started with breweries, their primary growth is now in energy drinks, functional beverages, RTD cocktails, spirits, and wine. Content should reflect the full beverage industry — not just beer.

Use the headlines below to generate 5 SEO-driven blog content ideas as a valid JSON array.

Recent industry headlines:
${researchText}

Each object must have exactly these fields:
{
  "title": "specific, compelling, SEO-optimized title",
  "targetKeyword": "primary keyword phrase to rank for",
  "searchIntent": "informational" | "commercial" | "navigational",
  "contentAngle": "2 sentences on the unique angle and why it suits Brew Movers' positioning in the broader beverage logistics space",
  "suggestedWordCount": 1200,
  "source": "which headline or trend inspired this idea"
}

Rules:
- Spread ideas across beverage categories — energy drinks, RTD, spirits, wine, functional beverages, and general beverage logistics
- Titles must be specific (not generic)
- suggestedWordCount must be a plain number between 800 and 3000
- Vary search intent across the 5 ideas
- Return ONLY the JSON array. No markdown, no explanation.`
      }
    ]
  });

  const raw = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  const cleaned = raw.replace(/```(?:json)?\n?/g, '').trim();
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Claude did not return a valid JSON array. Raw: ' + raw.slice(0, 300));
  }

  const ideas = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(ideas) || ideas.length === 0) {
    throw new Error('Unexpected empty array from Claude.');
  }

  return ideas;
}

module.exports = { generateContentIdeas };
