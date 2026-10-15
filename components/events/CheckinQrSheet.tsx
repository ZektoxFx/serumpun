'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useT } from '@/lib/i18n';

/**
 * "Show check-in QR" for the organiser and the Management Office: a full-screen sheet to hold up at the venue. The QR
 * itself (`children`) is drawn on the server, so the check-in code never reaches anyone else's browser.
 */
export function CheckinQrSheet({ children }: { children: ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ink" size="lg" aria-haspopup="dialog" onClick={() => setOpen(true)} className="w-full">
        <span aria-hidden="true">📱</span> {t('event.qr.show')}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} side="full" title={t('event.qr.title')}>
        {children}
      </Sheet>
    </>
  );
}
