/* eslint-disable no-console */
// Deletes analytics rows older than the retention window. Decided in Edokko's
// ADR 0006 (analytics event and retention conventions): 24 months, not the 25
// CNIL caps the no-consent exemption at, so a missed run doesn't put the
// deployment over the legal line.
//
// Deliberately depends on nothing but DATABASE_URL and the `pg` driver, not
// the generated Prisma client — this script is the durable artifact across
// whatever triggers it (Vercel Cron today, crontab or a scheduled GitHub
// Actions workflow if this is ever hosted elsewhere). None of the four tables
// below carry a foreign key constraint at the database level (checked against
// prisma/migrations — none declare one), so deletion order doesn't matter.
import 'dotenv/config';
import chalk from 'chalk';
import { Client } from 'pg';

const RETENTION_MONTHS = 24;

const TABLES = ['event_data', 'session_data', 'website_event', 'session'];

function cutoffDate(retentionMonths) {
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - retentionMonths);
  return cutoff;
}

export async function purgeExpiredData({
  databaseUrl = process.env.DATABASE_URL,
  retentionMonths = RETENTION_MONTHS,
} = {}) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined.');
  }

  const cutoff = cutoffDate(retentionMonths);
  const client = new Client({ connectionString: databaseUrl });
  const deleted = {};

  await client.connect();

  try {
    for (const table of TABLES) {
      const result = await client.query(`delete from "${table}" where created_at < $1`, [cutoff]);
      deleted[table] = result.rowCount;
    }
  } finally {
    await client.end();
  }

  return { cutoff, retentionMonths, deleted };
}

async function main() {
  try {
    const { cutoff, retentionMonths, deleted } = await purgeExpiredData();

    console.log(chalk.blueBright(`Purging rows older than ${retentionMonths} months (before ${cutoff.toISOString()})`));
    for (const [table, count] of Object.entries(deleted)) {
      console.log(chalk.greenBright(`✓ ${table}: ${count} row(s) deleted`));
    }
  } catch (e) {
    console.log(chalk.redBright(`✗ ${e.message}`));
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
