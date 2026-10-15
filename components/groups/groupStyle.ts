import type { TagVariant } from '@/components/ui/Tag';
import type { GroupCategory, GroupColour, PostType } from '@/lib/domain/community';

/** A group's initials tile (canvas "Your groups"). Decorative: the name always sits next to it. */
export const GROUP_TILE: Record<GroupColour, string> = {
  red: 'bg-red text-white',
  orange: 'bg-orange text-white',
  amber: 'bg-amber text-[#001C3C]',
  ink: 'bg-ink text-on-ink',
  green: 'bg-tint-green text-green-text',
  purple: 'bg-tint-purple text-purple-text',
};

/** The background of a category's emoji on the Discover cards. */
export const GROUP_ICON_TINT: Record<GroupCategory, string> = {
  family: 'bg-tint-red',
  sports: 'bg-tint-amber',
  fitness: 'bg-tint-orange',
  hobbies: 'bg-tint-purple',
  other: 'bg-tint-blue',
};

/** The tag on a post card; a general post has none. */
export const POST_TYPE_TAG: Record<PostType, TagVariant | null> = { general: null, question: 'purple', share_lend: 'green' };
