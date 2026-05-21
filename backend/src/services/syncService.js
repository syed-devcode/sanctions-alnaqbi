const https = require('https');
const http = require('http');
const cron = require('node-cron');
const pool = require('../db');
const { parseUN } = require('../parsers/unParser');
const { parseUAE } = require('../parsers/uaeParser');

const UN_URL  = 'https://scsanctions.un.org/resources/xml/en/consolidated.xml';
const UAE_URL = 'https://data.opensanctions.org/datasets/latest/ae_local_terrorists/targets.nested.json';

const BATCH_SIZE = 200;

function fetchFromUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;
    const req = client.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects === 0) return reject(new Error('Too many redirects'));
        return resolve(fetchFromUrl(res.headers.location, maxRedirects - 1));
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out fetching ${url}`));
    });
  });
}

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
      const url = src === 'UN' ? UN_URL : UAE_URL;
      console.log(`[Sync] Fetching ${src} data from ${url}`);
      const content = await fetchFromUrl(url);

      console.log(`[Sync] Parsing ${src} data...`);
      const records = src === 'UN' ? await parseUN(content) : parseUAE(content);
      console.log(`[Sync] Parsed ${records.length} records. Importing...`);

      await client.query('BEGIN');

      // Full replace: delete all existing records for this source (aliases cascade)
      await client.query('DELETE FROM sanctions_entries WHERE source = $1', [src]);

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
  // Every Sunday at midnight
  cron.schedule('0 0 * * 0', () => {
    console.log('[Cron] Weekly sync triggered');
    runSync('ALL', 'scheduled').catch(console.error);
  });
  console.log('[Cron] Weekly sync scheduled (Sundays 00:00)');
}

module.exports = { runSync, scheduleWeeklySync };
