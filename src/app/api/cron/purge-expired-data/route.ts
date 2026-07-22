import { json, unauthorized } from '@/lib/response';
import { purgeExpiredData } from '../../../../../scripts/purge-expired-data.js';

// Vercel Cron calls this on a schedule with `Authorization: Bearer <CRON_SECRET>`
// (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs) — the
// convention Vercel itself documents for authenticating its own cron requests.
// Not wired into vercel.json yet: the schedule and CRON_SECRET are set up
// deliberately by hand after reviewing this route, not by an agent.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return unauthorized();
  }

  const { cutoff, retentionMonths, deleted } = await purgeExpiredData();

  return json({ cutoff, retentionMonths, deleted });
}
