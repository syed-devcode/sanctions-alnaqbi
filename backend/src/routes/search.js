const router = require('express').Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

// word_similarity scores: 1.0 = exact word match, 0.4 = fuzzy partial
// Confirmed = word is essentially identical (>=0.9), Possible = fuzzy hit (>=0.4)
const CONFIRMED_THRESHOLD = 0.9;
const POSSIBLE_THRESHOLD  = 0.4;

function getRiskLevel(results) {
  if (!results.length) return 'clear';
  const top = results[0].similarity_score;
  return top >= CONFIRMED_THRESHOLD ? 'confirmed_match' : 'possible_match';
}

router.get('/', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM search_sanctions($1, $2) ORDER BY similarity_score DESC LIMIT 50',
      [q.trim(), POSSIBLE_THRESHOLD]
    );

    const riskLevel = getRiskLevel(rows);

    const results = rows.map(r => ({
      ...r,
      risk_level: r.similarity_score >= CONFIRMED_THRESHOLD ? 'confirmed_match' : 'possible_match',
    }));

    // Fetch every stored alias for each matched entry so the modal can show them all
    const entryIds = results.map(r => r.entry_id);
    if (entryIds.length > 0) {
      const { rows: aliasRows } = await pool.query(
        `SELECT entry_id, alias_name, alias_type, quality
         FROM aliases
         WHERE entry_id = ANY($1::uuid[])
         ORDER BY
           CASE alias_type WHEN 'primary' THEN 0 WHEN 'alias' THEN 1 ELSE 2 END,
           alias_name`,
        [entryIds]
      );
      const byEntry = {};
      for (const a of aliasRows) {
        if (!byEntry[a.entry_id]) byEntry[a.entry_id] = [];
        byEntry[a.entry_id].push(a);
      }
      for (const r of results) {
        r.all_aliases = byEntry[r.entry_id] || [];
      }
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, user_email, search_term, results_count, risk_level, results_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user.id,
        req.user.email,
        q.trim(),
        results.length,
        riskLevel,
        JSON.stringify(results.slice(0, 5)),
      ]
    );

    res.json({ query: q.trim(), risk_level: riskLevel, count: results.length, results });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
