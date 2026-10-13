'use client';

import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { t, type Lang, type MessageKey, type Vars } from './core';

// Defaults to English so a component rendered outside the provider degrades instead of crashing.
const LangContext = createContext<Lang>('en');

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

/** `const t = useT(); t('common.save')`. The function only changes when the language does. */
export function useT() {
  const lang = useContext(LangContext);
  return useCallback((key: MessageKey, vars?: Vars) => t(lang, key, vars), [lang]);
}
