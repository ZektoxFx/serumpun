'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Sheet } from '@/components/ui/Sheet';

/**
 * The report panel on the right of the dashboard. It is open while the page has `?report=<id>` (so the server renders
 * its details), and closing it goes back to the plain board.
 */
export function ReportSheet({ title, children }: { title: ReactNode; children: ReactNode }) {
  const router = useRouter();
  return (
    <Sheet open side="right" title={title} onClose={() => router.replace('/dashboard', { scroll: false })}>
      {children}
    </Sheet>
  );
}
