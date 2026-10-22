import type { NextConfig } from 'next';
import { buildSecurityHeaders } from './src/security/headers';

const nextConfig: NextConfig = {
  // T-391 (SEC-05): no anunciar el framework.
  poweredByHeader: false,
  async headers() {
    return [
      {
        // T-391 (SEC-05): todas las rutas, páginas y `/api`.
        source: '/(.*)',
        headers: buildSecurityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          isDevelopment: process.env.NODE_ENV === 'development',
        }),
      },
    ];
  },
};

export default nextConfig;
