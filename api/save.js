'use strict';

const { readIdeas, writeIdeas } = require('../lib/storage');

const VALID_STATUSES = ['approved', 'rejected'];
const VALID_REVIEWERS = ['AG', 'BA'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, status, reviewer } = req.body || {};

  if (!id || !status || !reviewer) {
    return res.status(400).json({ error: 'Missing required fields: id, status, reviewer' });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  if (!VALID_REVIEWERS.includes(reviewer)) {
    return res.status(400).json({ error: `reviewer must be one of: ${VALID_REVIEWERS.join(', ')}` });
  }

  try {
    const ideas = await readIdeas();
    const idx = ideas.findIndex(i => i.id === id);

    if (idx === -1) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    ideas[idx] = {
      ...ideas[idx],
      status,
      reviewer,
      updatedAt: new Date().toISOString()
    };

    await writeIdeas(ideas);

    return res.status(200).json({ success: true, idea: ideas[idx] });
  } catch (err) {
    console.error('[save] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
