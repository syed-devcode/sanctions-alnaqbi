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

// Per-source status: last sync datetime, total records, records added (admin only)
router.get('/status', requireAdmin, async (req, res) => {
  try {
    const { rows: counts } = await pool.query(
      `SELECT source, COUNT(*) AS total_records
       FROM sanctions_entries
       GROUP BY source`
    );

    const { rows: lastSyncs } = await pool.query(
      `SELECT DISTINCT ON (source) source, status, records_imported, error_message, completed_at
       FROM sync_logs
       WHERE source IN ('UN', 'UAE')
       ORDER BY source, started_at DESC`
    );

    const result = { UN: null, UAE: null };

    for (const row of lastSyncs) {
      result[row.source] = {
        last_sync_at: row.completed_at,
        last_sync_status: row.status,
        last_records_imported: row.records_imported,
        last_error: row.error_message,
        total_records: 0,
      };
    }

    for (const row of counts) {
      if (!result[row.source]) result[row.source] = { total_records: 0 };
      result[row.source].total_records = parseInt(row.total_records, 10);
    }

    res.json({ status: result });
  } catch (err) {
    console.error('Sync status error:', err);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
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
