import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  // Functions beside the Supabase database (ap-southeast-1) and Malaysian users; the default iad1 adds a trans-Pacific hop per query.
  regions: ['sin1'],
};
