import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'cadeApp — Envíos directos en Aguilares',
    short_name: 'cadeApp',
    description: 'Conectamos comercios con repartidores locales en tiempo real.',
    start_url: '/login',
    id: '/',
    display: 'standalone',
    background_color: '#12182C',
    theme_color: '#09BABD',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
