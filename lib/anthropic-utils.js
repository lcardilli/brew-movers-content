'use strict';

const Anthropic = require('@anthropic-ai/sdk');

async function generateContentIdeas(apiKey) {
  const client = new Anthropic({ apiKey });

  // Single web search: industry trends + keyword intent in one query
  const searchMessages = [{ role: 'user', content: `Search for: (1) recent news and trends in beverage logistics, beer distribution, and cold chain shipping from the past 30 days, and (2) commonly searched keywords and questions by brewery owners, distributors, and beverage brands about logistics and shipping. Return a brief combined summary — 5 news items and 10 keywords/questions.` }];

  let searchResponse = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: searchMessages
  });

  while (searchResponse.stop_reason === 'tool_use') {
    const assistantContent = searchResponse.content;
    searchMessages.push({ role: 'assistant', content: assistantContent });
    const toolResults = assistantContent
      .filter(b => b.type === 'tool_use')
      .map(block => ({ type: 'tool_result', tool_use_id: block.id, content: '' }));
    searchMessages.push({ role: 'user', content: toolResults });
    searchResponse = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: searchMessages
    });
  }

  const research = searchResponse.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  // Synthesis — generate 5 ideas from research
  const synthesisResponse = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `You are an SEO content strategist for Brew Movers, a beverage logistics company. Using the research below, generate exactly 5 SEO-driven blog content ideas as a valid JSON array.

Research:
${research}

Each object must have:
{
  "title": "specific, compelling, SEO-optimized title",
  "targetKeyword": "primary keyword phrase",
  "searchIntent": "informational" | "commercial" | "navigational",
  "contentAngle": "2 sentences on the angle and why it suits Brew Movers",
  "suggestedWordCount": 1200,
  "source": "what inspired this idea"
}

Rules: titles must be specific, suggestedWordCount between 800–3000, vary search intent across ideas.
Return ONLY the JSON array. No markdown, no explanation.`
      }
    ]
  });

  const raw = synthesisResponse.content
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
