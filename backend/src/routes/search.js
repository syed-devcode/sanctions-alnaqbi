const router = require('express').Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const CONFIRMED_THRESHOLD = 0.9;
const POSSIBLE_THRESHOLD  = 0.4;

function getRiskLevel(results) {
  if (!results.length) return 'clear';
  return results[0].similarity_score >= CONFIRMED_THRESHOLD ? 'confirmed_match' : 'possible_match';
}

router.get('/', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  try {
    // Demo limit check — query live counter (not JWT, which is stale after increments)
    if (req.user.role === 'demo') {
      const { rows: [demoUser] } = await pool.query(
        'SELECT demo_searches_used, demo_search_limit FROM users WHERE id = $1',
        [req.user.id]
      );
      if (!demoUser || demoUser.demo_searches_used >= demoUser.demo_search_limit) {
        return res.status(403).json({
          error: 'You have reached your demo limit. Please contact syed.faisal@alnaqbipartners.com to upgrade your account.',
          limitReached: true,
        });
      }
    }

    // Return ALL matching alias rows (no DISTINCT ON) so every alias that hits gets captured
    const { rows } = await pool.query(
      `SELECT
         se.id               AS entry_id,
         se.source,
         se.entity_type,
         se.primary_name,
         se.nationality,
         se.dob,
         se.listed_on,
         se.additional_info,
         a.alias_name        AS matched_alias,
         a.alias_type,
         word_similarity($1, a.alias_name)::float AS similarity_score
       FROM aliases a
       JOIN sanctions_entries se ON a.entry_id = se.id
       WHERE to_tsvector('simple', a.alias_name) @@ plainto_tsquery('simple', $1)
         AND word_similarity($1, a.alias_name) >= $2
       ORDER BY word_similarity($1, a.alias_name) DESC`,
      [q.trim(), POSSIBLE_THRESHOLD]
    );

    // Group by entry — collect every matching alias, keep the best similarity score
    const entryMap = new Map();
    for (const row of rows) {
      if (!entryMap.has(row.entry_id)) {
        entryMap.set(row.entry_id, {
          entry_id:        row.entry_id,
          source:          row.source,
          entity_type:     row.entity_type,
          primary_name:    row.primary_name,
          nationality:     row.nationality,
          dob:             row.dob,
          listed_on:       row.listed_on,
          additional_info: row.additional_info,
          similarity_score: row.similarity_score, // highest score (rows are DESC)
          matched_alias:   row.matched_alias,      // best-matching alias
          matched_aliases: [],
        });
      }
      entryMap.get(row.entry_id).matched_aliases.push({
        alias_name:       row.matched_alias,
        alias_type:       row.alias_type,
        similarity_score: row.similarity_score,
      });
    }

    // Sort by best similarity, cap at 50, add risk level
    let results = Array.from(entryMap.values())
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, 50)
      .map(r => ({
        ...r,
        risk_level: r.similarity_score >= CONFIRMED_THRESHOLD ? 'confirmed_match' : 'possible_match',
      }));

    // Fetch every stored alias for matched entries so the modal shows the full picture
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

    const riskLevel = getRiskLevel(results);

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

    // Increment demo counter and return remaining searches
    let remainingSearches = null;
    if (req.user.role === 'demo') {
      const { rows: [updated] } = await pool.query(
        'UPDATE users SET demo_searches_used = demo_searches_used + 1 WHERE id = $1 RETURNING demo_searches_used, demo_search_limit',
        [req.user.id]
      );
      remainingSearches = updated.demo_search_limit - updated.demo_searches_used;
    }

    res.json({ query: q.trim(), risk_level: riskLevel, count: results.length, results, remainingSearches });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
