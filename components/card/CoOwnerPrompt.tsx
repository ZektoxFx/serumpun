'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { buttonClasses } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';

const KEY = 'serumpun.coOwnerLater';
const LATER_MS = 3 * 24 * 60 * 60 * 1000;

// This page's copy of the saved date (an ISO time, or null for none), so "Later" hides the prompt even where storage is
// blocked (private mode, cleared site data): it then comes back when the page is opened again.
let later: string | null | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function savedLater() {
  if (later === undefined) {
    try {
      later = localStorage.getItem(KEY);
    } catch {
      later = null;
    }
  }
  return later;
}

/** What Later saves: 3 days from `now`. */
export const laterUntil = (now: number) => new Date(now + LATER_MS).toISOString();

/** Whether the saved time is still ahead. Nothing saved, a time that cannot be read, or one that has passed asks again. */
export const isPutOff = (saved: string | null, now: number) => Date.parse(saved ?? '') > now;

function remindLater() {
  later = laterUntil(Date.now());
  try {
    localStorage.setItem(KEY, later);
  } catch {
    // Not remembered after this page; see `later`.
  }
  listeners.forEach((listener) => listener());
}

/**
 * "Add a Co-owner?" for an Owner whose card has none (Me decides who gets it). Later hides it for 3 days on this phone;
 * one phone per person makes the browser the person's. It renders nothing until it has read what was saved, so a reload
 * never flashes a prompt that was put off.
 */
export function CoOwnerPrompt() {
  const t = useT();
  const [now] = useState(() => Date.now());
  const until = useSyncExternalStore(subscribe, savedLater, () => undefined);
  if (until === undefined || isPutOff(until, now)) return null;
  return (
    <section aria-labelledby="co-owner-prompt" className="grid gap-2 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <h2 id="co-owner-prompt" className="text-base font-extrabold">
        {t('coOwner.title')}
      </h2>
      <p className="text-sm text-muted-2">{t('coOwner.body')}</p>
      <Link href="/me/household?invite=co_owner" className={buttonClasses('primary')}>
        {t('coOwner.add')}
      </Link>
      <button type="button" onClick={remindLater} className="min-h-11 rounded-xl text-sm font-bold text-muted-2 hover:bg-soft">
        {t('coOwner.later')}
      </button>
    </section>
  );
}
