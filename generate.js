'use strict';

require('dotenv').config();

const { fetchKeywordIdeas } = require('./lib/semrush');
const { fetchIndustryNews, generateContentIdeas } = require('./lib/anthropic-utils');
const { readIdeas, writeIdeas } = require('./lib/storage');

async function main() {
  console.log('=== Brew Movers Content Idea Generator ===\n');

  const semrushKey = process.env.SEMRUSH_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    throw new Error('Missing ANTHROPIC_API_KEY in .env');
  }
  if (!semrushKey) {
    console.warn('SEMRUSH_API_KEY not set — will use fallback keyword data\n');
  }

  // Step 1: Fetch keyword ideas from SEMrush
  console.log('1/3 Fetching keyword ideas from SEMrush...');
  const keywords = await fetchKeywordIdeas(semrushKey || '');
  console.log(`    Found ${keywords.length} keywords (top: "${keywords[0]?.keyword}")\n`);

  // Step 2: Research current industry news via Claude web search
  console.log('2/3 Researching current beverage logistics news...');
  const news = await fetchIndustryNews(anthropicKey);
  console.log('    News research complete\n');

  // Step 3: Generate 10 SEO-driven content ideas
  console.log('3/3 Generating content ideas with Claude...');
  const rawIdeas = await generateContentIdeas(anthropicKey, keywords, news);
  console.log(`    Generated ${rawIdeas.length} ideas\n`);

  // Load existing ideas and append new ones with metadata
  const existing = await readIdeas();
  const today = new Date().toISOString().split('T')[0];

  const newIdeas = rawIdeas.map(idea => ({
    id: crypto.randomUUID(),
    title: idea.title,
    targetKeyword: idea.targetKeyword,
    searchVolume: Number(idea.searchVolume) || 0,
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
    console.log(`     Keyword: ${idea.targetKeyword} | Volume: ${idea.searchVolume.toLocaleString()}/mo | Words: ${idea.suggestedWordCount}`);
  });
}

main().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
