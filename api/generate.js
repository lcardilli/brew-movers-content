'use strict';

const { fetchKeywordIdeas } = require('../lib/ahrefs');
const { fetchIndustryNews, generateContentIdeas } = require('../lib/anthropic-utils');
const { readIdeas, writeIdeas } = require('../lib/storage');

module.exports = async (req, res) => {
  // Allow GET (cron) and POST (manual button)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret for GET requests coming from Vercel cron
  if (req.method === 'GET' && process.env.CRON_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const ahrefsToken = process.env.AHREFS_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY environment variable is not set.' });
  }

  try {
    console.log('[generate] Fetching Ahrefs keywords...');
    const keywords = await fetchKeywordIdeas(ahrefsToken || '');

    console.log('[generate] Researching industry news...');
    const news = await fetchIndustryNews(anthropicKey);

    console.log('[generate] Generating content ideas...');
    const rawIdeas = await generateContentIdeas(anthropicKey, keywords, news);

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

    console.log(`[generate] Done — added ${newIdeas.length} ideas.`);
    return res.status(200).json({
      success: true,
      generated: newIdeas.length,
      total: existing.length + newIdeas.length,
      ideas: newIdeas
    });
  } catch (err) {
    console.error('[generate] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
