const cron = require('node-cron');
const pool = require('../db');
const { parseUN } = require('../parsers/unParser');
const { parseUAE } = require('../parsers/uaeParser');

const BATCH_SIZE = 200;

async function importRecords(records, source, client) {
  let imported = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    for (const rec of batch) {
      const { rows } = await client.query(
        `INSERT INTO sanctions_entries
           (source, source_id, entity_type, primary_name, nationality, dob,
            passport_number, national_id, address, listed_on, additional_info)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (source, source_id) DO UPDATE SET
           primary_name    = EXCLUDED.primary_name,
           nationality     = EXCLUDED.nationality,
           dob             = EXCLUDED.dob,
           passport_number = EXCLUDED.passport_number,
           national_id     = EXCLUDED.national_id,
           address         = EXCLUDED.address,
           listed_on       = EXCLUDED.listed_on,
           additional_info = EXCLUDED.additional_info,
           updated_at      = now()
         RETURNING id`,
        [
          rec.source, rec.source_id, rec.entity_type, rec.primary_name,
          rec.nationality, rec.dob, rec.passport_number, rec.national_id,
          rec.address, rec.listed_on, JSON.stringify(rec.additional_info),
        ]
      );

      const entryId = rows[0].id;

      // Replace aliases for this entry
      await client.query('DELETE FROM aliases WHERE entry_id = $1', [entryId]);

      for (const alias of rec.aliases) {
        await client.query(
          'INSERT INTO aliases (entry_id, alias_name, alias_type, quality) VALUES ($1,$2,$3,$4)',
          [entryId, alias.alias_name, alias.alias_type, alias.quality]
        );
      }

      imported++;
    }
  }

  return imported;
}

async function runSync(source = 'ALL', triggeredBy = 'manual') {
  const sources = source === 'ALL' ? ['UN', 'UAE'] : [source];

  for (const src of sources) {
    const { rows } = await pool.query(
      `INSERT INTO sync_logs (source, status, triggered_by) VALUES ($1, 'started', $2) RETURNING id`,
      [src, triggeredBy]
    );
    const logId = rows[0].id;
    const client = await pool.connect();

    try {
      console.log(`[Sync] Starting ${src} import...`);
      await client.query('BEGIN');

      const records = src === 'UN' ? await parseUN() : parseUAE();
      const imported = await importRecords(records, src, client);

      await client.query('COMMIT');
      await pool.query(
        `UPDATE sync_logs SET status='completed', records_imported=$1, completed_at=now() WHERE id=$2`,
        [imported, logId]
      );
      console.log(`[Sync] ${src} complete – ${imported} records imported.`);
    } catch (err) {
      await client.query('ROLLBACK');
      await pool.query(
        `UPDATE sync_logs SET status='failed', error_message=$1, completed_at=now() WHERE id=$2`,
        [err.message, logId]
      );
      console.error(`[Sync] ${src} failed:`, err.message);
    } finally {
      client.release();
    }
  }
}

function scheduleWeeklySync() {
  // Every Sunday at 02:00 AM
  cron.schedule('0 2 * * 0', () => {
    console.log('[Cron] Weekly sync triggered');
    runSync('ALL', 'scheduled').catch(console.error);
  });
  console.log('[Cron] Weekly sync scheduled (Sundays 02:00)');
}

module.exports = { runSync, scheduleWeeklySync };
