import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` prints every Server Function call with its arguments, and Register and Sign in pass codes, SMS codes and
  // PINs as arguments. They must never reach a log.
  logging: { serverFunctions: false },
  // create-next-app 16.4 turns on `cacheComponents` + `partialPrefetching`; Serumpun leaves them off.
  // Every screen is signed-in and per-user, and the root layout reads the `lang` cookie, which Cache
  // Components rejects outside <Suspense> ("Next.js encountered uncached or runtime data during
  // prerendering"). It also keeps navigated-away routes mounted (<Activity>), which would leave an open
  // native <dialog> sheet locking the next page's scroll. Revisit only with a plan for both.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
