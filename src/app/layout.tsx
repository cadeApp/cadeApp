import type { Metadata, Viewport } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import './globals.css';
import { publicEnv } from '@/lib/env.public';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['600', '700', '800'],
});

export const viewport: Viewport = {
  themeColor: '#09BABD',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const TITLE = 'cadeApp — Envíos rápidos en Aguilares';
const DESCRIPTION =
  'Envíos directos entre comercios y repartidores de Aguilares, Tucumán. Publicás lo que necesitás mandar, los repartidores te ofertan en vivo y vos elegís con quién.';

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'cadeApp',
  keywords: [
    'envíos',
    'repartidores',
    'delivery',
    'comercios',
    'mensajería',
    'Aguilares',
    'Tucumán',
  ],
  category: 'business',
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    siteName: 'cadeApp',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'cadeApp' }],
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/icons/icon-512.png'],
  },
  appleWebApp: {
    capable: true,
    title: 'cadeApp',
    statusBarStyle: 'default',
  },
  // Que iOS no convierta en links números ni direcciones sueltas del contenido.
  formatDetection: { telephone: false, address: false, email: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${montserrat.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
