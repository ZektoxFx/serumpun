import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { I18nProvider, t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { default: 'Serumpun', template: '%s · Serumpun' },
    description: t(await getLang(), 'landing.tagline'),
  };
}

// Browser chrome follows the phone's setting; the in-app switch only changes the page itself.
export const viewport: Viewport = {
  // Edge to edge on notched phones; the fixed bars pad themselves with env(safe-area-inset-bottom).
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F7F9' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1220' },
  ],
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const lang = await getLang();
  return (
    // next-themes writes data-theme on <html> before hydration, so React must not flag the mismatch.
    <html lang={lang} className={jakarta.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
          <I18nProvider lang={lang}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
