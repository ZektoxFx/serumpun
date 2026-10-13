'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Switch } from '@/components/ui/Switch';

const never = () => () => {};

/** The dark mode switch. Name it with a <label htmlFor={id}>. The choice is kept by next-themes, so it survives a reload. */
export function ThemeSwitch({ id }: { id: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // The saved theme only exists in the browser. Render "off" on the server and while hydrating, then the truth, so the
  // markup matches and React does not warn.
  const mounted = useSyncExternalStore(never, () => true, () => false);
  return <Switch id={id} checked={mounted && resolvedTheme === 'dark'} onChange={(dark) => setTheme(dark ? 'dark' : 'light')} />;
}
