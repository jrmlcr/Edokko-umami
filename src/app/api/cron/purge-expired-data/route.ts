import { json, unauthorized } from '@/lib/response';
import { purgeExpiredData } from '../../../../../scripts/purge-expired-data.js';

// Vercel Cron calls this on a schedule with `Authorization: Bearer <CRON_SECRET>`
// (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs) — the
// convention Vercel itself documents for authenticating its own cron requests.
// Wired into vercel.json on 2026-07-24: `0 3 1 * *`, the 1st of each month at
// 03:00 UTC. CRON_SECRET is set by hand on the Vercel project, not by an agent.
//
// Note for anyone verifying this from outside: an unset CRON_SECRET is
// indistinguishable from a wrong one here. Both make the comparison fail and
// return 401, so a 401 proves the route is deployed and guarded, and proves
// nothing about whether the scheduled run authenticates. Only the Vercel Cron
// Jobs tab shows that.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return unauthorized();
  }

  const { cutoff, retentionMonths, deleted } = await purgeExpiredData();

  return json({ cutoff, retentionMonths, deleted });
}
