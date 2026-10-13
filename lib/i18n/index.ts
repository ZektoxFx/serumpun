// Safe to import from server and client code. `getLang` is NOT here: it reads request cookies, so it
// lives in ./server and must be imported from '@/lib/i18n/server' by server code only.
export * from './core';
export { I18nProvider, useT } from './provider';
