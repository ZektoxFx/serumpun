import type { TagVariant } from '@/components/ui/Tag';
import type { ListingKind } from '@/lib/domain/community';

/** The kind's tag (canvas): purple "Lend · Free", green "Give away", amber "Swap". */
export const KIND_TAG: Record<ListingKind, TagVariant> = { lend: 'purple', give: 'green', swap: 'amber' };

const TINTS = ['bg-tint-purple', 'bg-tint-red', 'bg-tint-blue', 'bg-tint-green', 'bg-tint-orange', 'bg-tint-amber'];

/** The tint behind a listing's emoji: the same for the same listing, varied across the grid (canvas). */
export function tintFor(id: string): string {
  const hash = Array.from(id).reduce((h, ch) => (h * 31 + (ch.codePointAt(0) ?? 0)) | 0, 0);
  return TINTS[(hash >>> 0) % TINTS.length];
}
