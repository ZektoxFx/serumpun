import type { MetadataRoute } from 'next';
import { t } from '@/lib/i18n/core';

/** Installable (spec §3): "Add to Home screen" opens Serumpun on Home, full screen, in the brand colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Serumpun',
    short_name: 'Serumpun',
    description: t('en', 'landing.tagline'),
    start_url: '/home',
    display: 'standalone',
    background_color: '#F6F7F9',
    theme_color: '#D51A21',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
