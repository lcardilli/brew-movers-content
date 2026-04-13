'use strict';

const Anthropic = require('@anthropic-ai/sdk');

async function generateContentIdeas(apiKey) {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are an expert SEO content strategist for Brew Movers, a beverage logistics company that handles beer, wine, spirits, and other beverages for breweries, distributors, and beverage brands.

Generate exactly 5 high-quality, SEO-driven blog content ideas. Each idea must target a realistic search query that a brewery owner, beverage brand manager, or distributor would type into Google.

Return a valid JSON array. Each object must have these exact fields:
{
  "title": "compelling, SEO-optimized blog post title — specific and clickable",
  "targetKeyword": "primary keyword phrase to rank for",
  "searchIntent": "informational",
  "contentAngle": "2–3 sentences explaining the unique angle Brew Movers should take and why it serves the target reader",
  "suggestedWordCount": 1500,
  "source": "brief note on what inspired this idea (common pain point, industry trend, frequently asked question, etc.)"
}

Rules for searchIntent — use exactly one of:
- "informational" — reader wants to learn (how-to guides, explainers, trend analysis)
- "commercial" — reader is evaluating options or providers (comparisons, best-of lists)
- "navigational" — reader wants a specific resource or service (brand-adjacent, service-focused)

Additional rules:
- Titles must be specific and compelling — not "Cold Chain Tips" but "How Cold Chain Failures Cost Craft Breweries $2,000 Per Pallet — And How to Avoid Them"
- suggestedWordCount must be a plain number between 800 and 3000
- Vary the search intent across the 5 ideas

Return ONLY the valid JSON array. No markdown fences, no explanation, no other text.`
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
    throw new Error('Claude did not return a valid JSON array. Raw response: ' + raw.slice(0, 300));
  }

  const ideas = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(ideas) || ideas.length === 0) {
    throw new Error('Unexpected empty array from Claude content generation.');
  }

  return ideas;
}

module.exports = { generateContentIdeas };
