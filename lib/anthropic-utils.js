'use strict';

const Anthropic = require('@anthropic-ai/sdk');

// Shared helper — runs a web-search-enabled Claude conversation and returns the final text.
async function runWebSearch(client, prompt) {
  const messages = [{ role: 'user', content: prompt }];

  let response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages
  });

  // Handle tool-use round-trips (web_search may require explicit loops)
  while (response.stop_reason === 'tool_use') {
    const assistantContent = response.content;
    messages.push({ role: 'assistant', content: assistantContent });

    const toolResults = assistantContent
      .filter(b => b.type === 'tool_use')
      .map(block => ({
        type: 'tool_result',
        tool_use_id: block.id,
        content: `Search executed for: "${block.input?.query || 'beverage logistics'}"`
      }));

    messages.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages
    });
  }

  return response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');
}

// Search 1 — current industry news and trends (past 7 days)
async function fetchIndustryNews(apiKey) {
  const client = new Anthropic({ apiKey });
  const result = await runWebSearch(
    client,
    `Search for the latest news and trends in the beverage logistics industry from the past 7 days. Focus on:
1. Beer and alcohol distribution news
2. Cold chain logistics innovations and challenges
3. Beverage supply chain disruptions or improvements
4. Brewery logistics technology updates
5. Alcohol shipping regulations and compliance changes

Provide a concise summary of the 5–7 most relevant news items or trends, including the source name and approximate date for each.`
  );
  return result || 'No news data retrieved.';
}

// Search 2 — commonly searched questions and keywords in the space
async function fetchKeywordResearch(apiKey) {
  const client = new Anthropic({ apiKey });
  const result = await runWebSearch(
    client,
    `Search for the most commonly asked questions and searched keywords in the beverage logistics industry. I need to understand:
1. What are people typing into Google about beer distribution, beverage shipping, and cold chain logistics?
2. What are the top informational, commercial, and navigational search queries in this space?
3. What problems are brewery owners, distributors, and beverage companies searching for answers to?
4. What long-tail keyword phrases exist around alcohol logistics, cold chain management, and beverage supply chain?

Provide a structured list of the 15–20 most relevant keywords and questions, grouped by search intent (informational, commercial, navigational), with a brief note on why each matters.`
  );
  return result || 'No keyword research data retrieved.';
}

// Synthesis — combine both research sources into 10 content ideas
async function generateContentIdeas(apiKey, news, keywordResearch) {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `You are an expert SEO content strategist for Brew Movers, a beverage logistics company that handles beer, wine, spirits, and other beverages. Generate 10 high-quality, SEO-driven blog content ideas based on the two research sources below.

## Current Industry News & Trends (Past 7 Days):
${news}

## Commonly Searched Keywords & Questions in the Space:
${keywordResearch}

Generate exactly 3 content ideas as a valid JSON array. Each object must have these exact fields:
{
  "title": "compelling, SEO-optimized blog post title — specific and clickable",
  "targetKeyword": "primary keyword phrase to rank for",
  "searchIntent": "informational",
  "contentAngle": "2–3 sentences explaining why this is timely now and what unique angle Brew Movers should take",
  "suggestedWordCount": 1500,
  "source": "Short description of the news item or keyword research that inspired this idea"
}

Rules for searchIntent — use exactly one of these three values:
- "informational" — reader wants to learn (how-to guides, explainers, trend analysis)
- "commercial" — reader is evaluating options or providers (comparisons, best-of lists)
- "navigational" — reader wants a specific resource or service (brand-adjacent, service-focused)

Additional rules:
- Pick the 3 highest-impact ideas — prioritise timeliness, search relevance, and Brew Movers' positioning
- Titles must be specific and compelling — not "Cold Chain Tips" but "How Cold Chain Failures Cost Craft Breweries \$2,000 Per Pallet — And How to Avoid Them"
- suggestedWordCount must be a plain number between 800 and 3000

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

module.exports = { fetchIndustryNews, fetchKeywordResearch, generateContentIdeas };
