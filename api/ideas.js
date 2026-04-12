'use strict';

const { readIdeas } = require('../lib/storage');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ideas = await readIdeas();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(ideas);
  } catch (err) {
    console.error('[ideas] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
