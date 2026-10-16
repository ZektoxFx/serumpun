import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  // Functions beside the Supabase database (ap-southeast-1) and Malaysian users; the default iad1 adds a trans-Pacific hop per query.
  regions: ['sin1'],
  // Return-day reminders at 00:00 UTC, which is 8 am in Malaysia. Vercel sends the CRON_SECRET of the project's env.
  crons: [{ path: '/api/cron/reminders', schedule: '0 0 * * *' }],
};
