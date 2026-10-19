'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { presentTap, type Device } from '@/lib/card/device';
import { useT } from '@/lib/i18n';

// Half the minute a reader allows a note: a QR that is scanned at the very end of its life is still fresh.
const REDRAW_MS = 30_000;

/**
 * The card as a QR code, for a reader that looks instead of listening. Each drawing is a new signed note that names no
 * reader (any reader takes it), so a screenshot goes stale and the code is drawn again every 30 seconds. Dark on white
 * in both themes, as components/ui/QR.tsx does, so phone cameras read it.
 */
export function CardQr({ device }: { device: Pick<Device, 'keys' | 'pass'> }) {
  const t = useT();
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const draw = async () => {
      try {
        const next = await QRCode.toString(await presentTap(device, { place: null, facility: null }, Date.now()), { type: 'svg', margin: 1 });
        if (!live) return;
        setSvg(next);
        setFailed(false);
      } catch {
        if (!live) return;
        setSvg(null); // a code left from before would only be refused as stale
        setFailed(true);
      }
    };
    void draw();
    const timer = setInterval(() => void draw(), REDRAW_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [device]);

  return (
    <div className="grid justify-items-center gap-2">
      <div
        role="img"
        aria-label={t('card.qr.label')}
        className="aspect-square w-full max-w-72 rounded-xl bg-white p-2 [&>svg]:size-full"
        dangerouslySetInnerHTML={{ __html: svg ?? '' }}
      />
      {failed ? (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t('common.error')}
        </p>
      ) : (
        <p className="text-center text-sm text-muted-2">{t('card.qr.hint')}</p>
      )}
    </div>
  );
}
