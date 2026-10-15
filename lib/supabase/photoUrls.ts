import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Links to a report's photos, by object path. A public report's photos are plain links (random names in `photos`). A
 * private report's are reached only through signed links that last an hour, which the storage policy grants to the
 * reporter and the Management Office alone; a refused one maps to null. `supabase` acts as the signed-in user.
 */
export async function photoUrls(
  supabase: SupabaseClient,
  isPrivate: boolean,
  paths: readonly (string | null)[],
): Promise<Map<string, string | null>> {
  return new Map(
    await Promise.all(
      paths
        .filter((path) => path !== null)
        .map(async (path): Promise<[string, string | null]> => {
          if (!isPrivate) return [path, supabase.storage.from('photos').getPublicUrl(path).data.publicUrl];
          const { data } = await supabase.storage.from('private-photos').createSignedUrl(path, 3600);
          return [path, data?.signedUrl ?? null];
        }),
    ),
  );
}
