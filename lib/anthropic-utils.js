'use strict';

const Anthropic = require('@anthropic-ai/sdk');

async function fetchIndustryNews(apiKey) {
  const client = new Anthropic({ apiKey });

  const messages = [
    {
      role: 'user',
      content: `Search for the latest news and trends in the beverage logistics industry from the past 7 days. Focus on:
1. Beer and alcohol distribution news
2. Cold chain logistics innovations and challenges
3. Beverage supply chain disruptions or improvements
4. Brewery logistics technology updates
5. Alcohol shipping regulations and compliance changes

Provide a concise summary of the 5–7 most relevant news items or trends, including the source name and approximate date for each.`
    }
  ];

  let response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages
  });

  // Handle tool use loop (web_search may require explicit round-trips)
  while (response.stop_reason === 'tool_use') {
    const assistantContent = response.content;
    messages.push({ role: 'assistant', content: assistantContent });

    const toolUseBlocks = assistantContent.filter(b => b.type === 'tool_use');
    const toolResults = toolUseBlocks.map(block => ({
      type: 'tool_result',
      tool_use_id: block.id,
      content: `Search completed for query: "${block.input?.query || 'beverage logistics news'}"`
    }));

    messages.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages
    });
  }

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  return text || 'No news data retrieved — content ideas will be based on keyword trends.';
}

async function generateContentIdeas(apiKey, keywords, news) {
  const client = new Anthropic({ apiKey });

  const keywordsText =
    keywords.length > 0
      ? keywords
          .map(
            k =>
              `- "${k.keyword}" (volume: ${Number(k.volume).toLocaleString()}/mo, difficulty: ${k.difficulty}/100)`
          )
          .join('\n')
      : '(No keyword data — use industry-relevant estimated volumes)';

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `You are an expert SEO content strategist for Brew Movers, a beverage logistics company that handles beer, wine, spirits, and other beverages. Your goal is to generate 10 high-quality, SEO-driven blog content ideas combining keyword research and current industry news.

## Ahrefs Keyword Data (Top 20 by Search Volume):
${keywordsText}

## Current Industry News & Trends (Past 7 Days):
${news}

Generate exactly 10 content ideas as a valid JSON array. Each object must have these exact fields:
{
  "title": "compelling, SEO-optimized blog post title — specific and clickable",
  "targetKeyword": "primary keyword to rank for (from Ahrefs data where possible)",
  "searchVolume": 1200,
  "contentAngle": "2–3 sentences explaining why this is timely now and what unique angle Brew Movers should take",
  "suggestedWordCount": 1500,
  "source": "Short description of the Ahrefs keyword or news item that inspired this idea"
}

Rules:
- Mix formats: how-to guides, trend analysis, comparison posts, industry insights, case studies
- Titles must be specific and compelling (e.g., not just "Cold Chain Tips" but "How Cold Chain Failures Cost Craft Breweries $2,000 Per Pallet — And How to Avoid Them")
- searchVolume must be a plain number (integer), not a string
- suggestedWordCount must be a number between 800 and 3000
- At least 5 ideas should use keywords from the Ahrefs data
- At least 3 ideas should tie into the current news items

Return ONLY the valid JSON array. No markdown fences, no explanation, no other text.`
      }
    ]
  });

  const raw = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  // Strip any accidental markdown code fences
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

module.exports = { fetchIndustryNews, generateContentIdeas };
