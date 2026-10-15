import type { TagVariant } from '@/components/ui/Tag';
import type { ReportStatus } from '@/lib/domain/reports';

/** A report's status tag colours (canvas "Reporting channel"). The status is always written on the tag too. */
export const STATUS_TAG: Record<ReportStatus, TagVariant> = {
  submitted: 'info',
  acknowledged: 'purple',
  in_progress: 'orange',
  resolved: 'green',
  confirmed: 'green',
  reopened: 'red',
};
