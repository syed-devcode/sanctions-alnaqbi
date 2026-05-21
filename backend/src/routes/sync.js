const router = require('express').Router();
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { runSync } = require('../services/syncService');

// Manual sync trigger (admin only)
router.post('/', requireAdmin, async (req, res) => {
  const { source = 'ALL' } = req.body;
  if (!['UN', 'UAE', 'ALL'].includes(source)) {
    return res.status(400).json({ error: 'source must be UN, UAE, or ALL' });
  }

  // Respond immediately; sync runs in background
  res.json({ message: `Sync started for ${source}. Check /api/sync/logs for progress.` });

  runSync(source, 'manual').catch(err => console.error('Manual sync failed:', err));
});

// Sync history (admin only)
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, source, status, records_imported, error_message, triggered_by, started_at, completed_at
       FROM sync_logs ORDER BY started_at DESC LIMIT 50`
    );
    res.json({ logs: rows });
  } catch (err) {
    console.error('Sync logs error:', err);
    res.status(500).json({ error: 'Failed to fetch sync logs' });
  }
});

module.exports = router;
