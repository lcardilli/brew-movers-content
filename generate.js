'use strict';

require('dotenv').config();

const { fetchIndustryNews, fetchKeywordResearch, generateContentIdeas } = require('./lib/anthropic-utils');
const { readIdeas, writeIdeas } = require('./lib/storage');

async function main() {
  console.log('=== Brew Movers Content Idea Generator ===\n');

  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    throw new Error('Missing ANTHROPIC_API_KEY in .env');
  }

  // Step 1: Search for current industry news
  console.log('1/3 Searching for current beverage logistics news...');
  const news = await fetchIndustryNews(anthropicKey);
  console.log('    News research complete\n');

  // Step 2: Search for commonly searched keywords and questions
  console.log('2/3 Searching for keyword trends and questions in the space...');
  const keywordResearch = await fetchKeywordResearch(anthropicKey);
  console.log('    Keyword research complete\n');

  // Step 3: Generate 10 SEO-driven content ideas
  console.log('3/3 Generating content ideas with Claude...');
  const rawIdeas = await generateContentIdeas(anthropicKey, news, keywordResearch);
  console.log(`    Generated ${rawIdeas.length} ideas\n`);

  // Load existing ideas and append new ones with metadata
  const existing = await readIdeas();
  const today = new Date().toISOString().split('T')[0];

  const newIdeas = rawIdeas.map(idea => ({
    id: crypto.randomUUID(),
    title: idea.title,
    targetKeyword: idea.targetKeyword,
    searchIntent: idea.searchIntent || 'informational',
    contentAngle: idea.contentAngle,
    suggestedWordCount: Number(idea.suggestedWordCount) || 1200,
    source: idea.source,
    generatedDate: today,
    status: 'pending',
    reviewer: null
  }));

  await writeIdeas([...existing, ...newIdeas]);

  console.log(`Done! Added ${newIdeas.length} ideas. Total in ideas.json: ${existing.length + newIdeas.length}`);
  console.log('\nNew ideas:');
  newIdeas.forEach((idea, i) => {
    console.log(`  ${i + 1}. ${idea.title}`);
    console.log(`     Keyword: ${idea.targetKeyword} | Intent: ${idea.searchIntent} | Words: ${idea.suggestedWordCount}`);
  });
}

main().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
