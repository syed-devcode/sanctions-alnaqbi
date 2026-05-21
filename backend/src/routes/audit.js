const router = require('express').Router();
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Staff: own logs only. Admin: all logs.
router.get('/', requireAuth, async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  const isAdmin = req.user.role === 'admin';

  try {
    const whereClause = isAdmin ? '' : 'WHERE user_id = $3';
    const params = isAdmin
      ? [parseInt(limit), offset]
      : [parseInt(limit), offset, req.user.id];

    const { rows } = await pool.query(
      `SELECT id, user_email, search_term, results_count, risk_level, searched_at
       FROM audit_logs
       ${whereClause}
       ORDER BY searched_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    const countParams = isAdmin ? [] : [req.user.id];
    const countWhere = isAdmin ? '' : 'WHERE user_id = $1';
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM audit_logs ${countWhere}`,
      countParams
    );

    res.json({ logs: rows, total: parseInt(countRows[0].count), page: parseInt(page) });
  } catch (err) {
    console.error('Audit log error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
