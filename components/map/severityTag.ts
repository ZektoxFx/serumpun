import type { TagVariant } from '@/components/ui/Tag';
import type { Severity } from '@/lib/domain/alerts';

/** Severity tag colours. Severity is never colour alone: it is always written on the tag too. */
export const SEVERITY_TAG: Record<Severity, TagVariant> = { high: 'red', medium: 'orange', low: 'amber' };
