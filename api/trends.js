'use strict';

const { readTrends, writeTrends } = require('../lib/storage');
const { fetchVerticalTrends }     = require('../lib/trends');

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const semrushKey = process.env.SEMRUSH_API_KEY;
  if (!semrushKey) {
    return res.status(500).json({ error: 'SEMRUSH_API_KEY not set' });
  }

  // Always try to read cache first
  const force  = req.query.force === '1';
  const cached = await readTrends();
  const age    = cached?.cachedAt ? Date.now() - new Date(cached.cachedAt).getTime() : Infinity;
  const isStale = age >= TWO_WEEKS_MS;

  if (!force && !isStale && cached) {
    return res.status(200).json(cached);
  }

  // Cache is stale or missing — refresh from SEMrush
  try {
    console.log('[trends] Refreshing vertical trend data from SEMrush...');
    const verticals = await fetchVerticalTrends(semrushKey);
    const data = { verticals, cachedAt: new Date().toISOString() };
    await writeTrends(data);
    console.log(`[trends] Done — ${verticals.length} verticals cached.`);
    return res.status(200).json(data);
  } catch (err) {
    console.error('[trends] Refresh failed:', err.message);
    // Fall back to stale cache rather than failing
    if (cached) return res.status(200).json({ ...cached, stale: true });
    return res.status(500).json({ error: err.message });
  }
};
