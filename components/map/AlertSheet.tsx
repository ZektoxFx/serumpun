'use client';

import Link from 'next/link';
import { useActionState, type ReactNode } from 'react';
import { voteAlert, type MapActionResult } from '@/app/(app)/map/actions';
import { publicPhotoUrl } from '@/components/app/PhotoInput';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Tag, type TagVariant } from '@/components/ui/Tag';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { ALERT_ICON, escalationHref, isFresh, type PublicAlert, type Severity } from '@/lib/domain/alerts';
import { distanceMeters, formatDistance, type LatLng } from '@/lib/domain/geo';
import { nearestPlace } from '@/lib/domain/places';
import { clockTime } from '@/lib/domain/time';
import { useLang, useT } from '@/lib/i18n';

/** Severity is never colour alone: it is always written on the tag too. */
export const SEVERITY_TAG: Record<Severity, TagVariant> = { high: 'red', medium: 'orange', low: 'amber' };

// The pressed vote gets a ring, on top of `aria-pressed` and the "You said…" line under the buttons.
const pressed = 'aria-pressed:ring-2 aria-pressed:ring-ink aria-pressed:ring-offset-2 aria-pressed:ring-offset-surface';

/** One alert: what and where, how fresh, the neighbours' votes, and the way to the Management Office. */
export function AlertSheet({
  alert,
  onClose,
  me,
  now,
  canVote,
  onVoted,
}: {
  alert: PublicAlert | null;
  onClose: () => void;
  me: LatLng | null;
  now: Date;
  /** Verified residents vote; pending ones read the reason instead. */
  canVote: boolean;
  onVoted: () => Promise<void>;
}) {
  const t = useT();
  return (
    <Sheet
      open={alert !== null}
      onClose={onClose}
      title={
        alert && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span aria-hidden="true">{ALERT_ICON[alert.type]}</span>
            {t(`alert.type.${alert.type}`)}
            <Tag variant={SEVERITY_TAG[alert.severity]}>{t(`severity.${alert.severity}`)}</Tag>
          </span>
        )
      }
    >
      {alert && <AlertDetails alert={alert} onClose={onClose} me={me} now={now} canVote={canVote} onVoted={onVoted} />}
    </Sheet>
  );
}

function Box({ label, value, valueClass = '', children }: { label: string; value: ReactNode; valueClass?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-soft p-3">
      <dt className="text-xs font-bold text-muted-2">{label}</dt>
      <dd className={`text-base font-extrabold ${valueClass}`}>{value}</dd>
      {children}
    </div>
  );
}

function AlertDetails({
  alert,
  onClose,
  me,
  now,
  canVote,
  onVoted,
}: {
  alert: PublicAlert;
  onClose: () => void;
  me: LatLng | null;
  now: Date;
  canVote: boolean;
  onVoted: () => Promise<void>;
}) {
  const t = useT();
  const lang = useLang();
  // `action={vote}` is fine here: nothing in this form (a hidden id and two named buttons) is lost when React resets it.
  const [result, vote, pending] = useActionState(async (_: MapActionResult, formData: FormData): Promise<MapActionResult> => {
    try {
      const done = await voteAlert(formData);
      if (done?.ok) await onVoted(); // the new counts and "last confirmed" show before the buttons wake up
      return done;
    } catch {
      return { ok: false, error: 'common.error' }; // the request itself failed (offline): say so, the map stays up
    }
  }, null);

  const place = nearestPlace(alert);
  const where = [
    place && t('map.alert.near', { place: t(place.label) }),
    me && t('map.alert.fromYou', { distance: formatDistance(distanceMeters(me, alert)) }),
  ]
    .filter(Boolean)
    .join(' · ');
  const escalate = escalationHref(alert);
  // vote_alert would refuse these, so say why up front instead.
  const blocked = alert.is_mine ? t('map.alert.yours') : canVote ? null : t('common.pendingCantAct');
  const sub = 'text-xs text-muted-2';

  return (
    <div className="grid gap-4 pb-2">
      {(alert.is_official || where) && (
        <div className="flex flex-wrap items-center gap-2">
          {alert.is_official && (
            <Tag variant="info">
              <span aria-hidden="true">📢</span> {t('map.alert.official')}
            </Tag>
          )}
          {where && <p className="text-sm text-muted-2">{where}</p>}
        </div>
      )}

      {alert.note && <p className="break-words text-base">{alert.note}</p>}

      {alert.photo_path && (
        // eslint-disable-next-line @next/next/no-img-element -- already shrunk to 1280 px before upload; the optimiser would only add a hop
        <img
          src={publicPhotoUrl(alert.photo_path)}
          alt={t('map.alert.photo', { type: t(`alert.type.${alert.type}`) })}
          className="max-h-64 w-full rounded-xl border border-line object-cover"
        />
      )}

      <dl className="grid grid-cols-2 gap-2">
        <Box label={t('map.alert.firstReported')} value={clockTime(new Date(alert.created_at), now, lang)}>
          <dd className={sub}>
            {t(alert.is_official ? 'map.alert.byOffice' : alert.is_mine ? 'map.alert.byYou' : 'map.alert.byNeighbour')}
          </dd>
        </Box>
        {alert.is_official ? (
          <Box label={t('map.alert.stays')} value={t('map.alert.staysValue')}>
            <dd className={sub}>{t('map.alert.staysHint')}</dd>
          </Box>
        ) : (
          <Box
            label={t('map.alert.lastConfirmed')}
            value={alert.confirm_count > 0 ? <TimeAgo date={alert.last_confirmed_at} /> : t('map.alert.notYet')}
            valueClass={isFresh(alert, now) ? 'text-green-text' : ''}
          >
            <dd className={sub}>
              {alert.confirm_count === 0
                ? t('map.alert.noOne')
                : alert.confirm_count === 1
                  ? t('map.alert.confirmedOne')
                  : t('map.alert.confirmedMany', { n: alert.confirm_count })}
            </dd>
            {alert.gone_count > 0 && <dd className={sub}>{t('map.alert.goneVotes', { n: alert.gone_count })}</dd>}
          </Box>
        )}
      </dl>

      {/* The Management Office's own pins take no votes (vote_alert refuses them) and are not sent back to it. */}
      {!alert.is_official && (
        <form action={vote} className="grid gap-2">
          <input type="hidden" name="id" value={alert.id} />
          <div className="grid grid-cols-2 gap-2">
            <Button
              name="vote"
              value="still_there"
              variant="ink"
              aria-pressed={alert.my_vote === 'still_there'}
              disabled={pending || blocked !== null}
              className={pressed}
            >
              <span aria-hidden="true">👍</span> {t('map.alert.stillThere')}
            </Button>
            <Button
              name="vote"
              value="gone"
              variant="outline"
              aria-pressed={alert.my_vote === 'gone'}
              disabled={pending || blocked !== null}
              className={pressed}
            >
              <span aria-hidden="true">✓</span> {t('map.alert.gone')}
            </Button>
          </div>
          {blocked ? (
            <p className="text-sm text-muted-2">{blocked}</p>
          ) : (
            alert.my_vote && <p className="text-sm text-muted-2">{t(`map.alert.yourVote.${alert.my_vote}`)}</p>
          )}
          {result && !result.ok && (
            <p role="alert" className="text-sm font-bold text-red-text">
              {t(result.error)}
            </p>
          )}
        </form>
      )}

      {escalate && (
        // The sheet stays open across a navigation unless the link closes it.
        <Link
          href={escalate}
          onClick={onClose}
          className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-tint-orange px-3 py-2 text-sm font-bold text-orange-text"
        >
          {t('map.alert.escalate')}
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
