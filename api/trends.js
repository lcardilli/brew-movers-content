'use strict';

const { readTrends, writeTrends } = require('../lib/storage');
const { fetchVerticalTrends }     = require('../lib/trends');

// Stale if cached in a previous calendar month (refreshes on 1st of each month)
function isCacheStale(cachedAt) {
  if (!cachedAt) return true;
  const cached  = new Date(cachedAt);
  const now     = new Date();
  return cached.getMonth() !== now.getMonth() || cached.getFullYear() !== now.getFullYear();
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const semrushKey = process.env.SEMRUSH_API_KEY;
  if (!semrushKey) {
    return res.status(500).json({ error: 'SEMRUSH_API_KEY not set' });
  }

  // Always try to read cache first
  const force   = req.query.force === '1';
  const cached  = await readTrends();
  const isStale = isCacheStale(cached?.cachedAt);

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
