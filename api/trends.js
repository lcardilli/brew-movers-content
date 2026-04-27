'use strict';

const { readTrends, writeTrends }   = require('../lib/storage');
const { fetchCurrentSnapshot }      = require('../lib/trends');

// ---------------------------------------------------------------------------
// CACHE STALENESS — stale if cached in a prior calendar month
// ---------------------------------------------------------------------------
function isCacheStale(cachedAt) {
  if (!cachedAt) return true;
  const cached = new Date(cachedAt);
  const now    = new Date();
  return cached.getMonth()    !== now.getMonth() ||
         cached.getFullYear() !== now.getFullYear();
}

// ---------------------------------------------------------------------------
// TREND CALCULATION — from two snapshot entries
// Returns trendPct (number | null) and direction
// ---------------------------------------------------------------------------
function calcTrend(currentVol, prevVol) {
  if (prevVol == null || prevVol === 0) return { trendPct: null, direction: 'stable' };
  const pct = Math.round(((currentVol - prevVol) / prevVol) * 100);
  return {
    trendPct:  pct,
    direction: pct >= 5 ? 'rising' : pct <= -5 ? 'declining' : 'stable',
  };
}

// ---------------------------------------------------------------------------
// HANDLER
// ---------------------------------------------------------------------------
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const semrushKey = process.env.SEMRUSH_API_KEY;
  if (!semrushKey) {
    return res.status(500).json({ error: 'SEMRUSH_API_KEY not set' });
  }

  const force  = req.query.force === '1';
  const stored = await readTrends();                  // { history: [...], cachedAt }
  const history = stored?.history || [];
  const isStale = isCacheStale(stored?.cachedAt);

  // ── Serve from cache if fresh ────────────────────────────────────────────
  if (!force && !isStale && stored) {
    return res.status(200).json(buildResponse(stored));
  }

  // ── Refresh ──────────────────────────────────────────────────────────────
  try {
    console.log('[trends] Fetching current snapshot from SEMrush...');
    const snapshot = await fetchCurrentSnapshot(semrushKey);
    const today    = new Date().toISOString().split('T')[0];        // YYYY-MM-DD
    const monthKey = today.slice(0, 7);                             // YYYY-MM

    // Only append if we haven't recorded this calendar month yet
    const alreadyRecorded = history.some(h => h.date.startsWith(monthKey));
    const updatedHistory  = alreadyRecorded
      ? history.map(h => h.date.startsWith(monthKey) ? { date: today, verticals: snapshot } : h)
      : [...history, { date: today, verticals: snapshot }].slice(-13); // keep 13 months max

    const newStored = { history: updatedHistory, cachedAt: today };
    await writeTrends(newStored);

    console.log(`[trends] Done. History depth: ${updatedHistory.length} month(s).`);
    return res.status(200).json(buildResponse(newStored));
  } catch (err) {
    console.error('[trends] Refresh failed:', err.message);
    if (stored) return res.status(200).json({ ...buildResponse(stored), stale: true });
    return res.status(500).json({ error: err.message });
  }
};

// ---------------------------------------------------------------------------
// BUILD RESPONSE — enrich latest snapshot with trend data from history
// ---------------------------------------------------------------------------
function buildResponse(stored) {
  const history = stored?.history || [];
  if (history.length === 0) return { verticals: [], cachedAt: stored?.cachedAt || null };

  const latest   = history[history.length - 1];
  const previous = history.length >= 2 ? history[history.length - 2] : null;

  const verticals = latest.verticals.map(v => {
    const prevV  = previous?.verticals.find(p => p.name === v.name);
    const { trendPct, direction } = calcTrend(v.volume, prevV?.volume ?? null);
    return {
      ...v,
      prevVolume:   prevV?.volume   ?? null,
      prevDate:     previous?.date  ?? null,
      trendPct,
      direction,
    };
  });

  return {
    verticals,
    cachedAt:      stored.cachedAt,
    historyMonths: history.length,
  };
}
