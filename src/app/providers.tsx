'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionProvider, Toaster } from '@/ui';
import {
  isIosSafariNonStandalone,
  loadIosInstallGuideSheet,
  loadOfflineBanner,
  loadOfflineFloatingCard,
} from '@/features/notifications';

const OfflineBanner = dynamic(loadOfflineBanner);
const OfflineFloatingCard = dynamic(loadOfflineFloatingCard);
const LazyIosInstallGuideSheet = dynamic(loadIosInstallGuideSheet, {
  ssr: false,
});

const IOS_DISMISS_KEY = 'cadeapp_ios_install_guide_dismissed';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
        },
      })
  );

  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Registrar el Service Worker en producción o ambiente de navegador
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {
          // Best effort; no romper la ejecución si el SW no registra en local/entorno restringido
        });
    }

    // Verificar si corresponde desplegar la guía de instalación para iOS Safari (T01)
    if (isIosSafariNonStandalone()) {
      const dismissed = localStorage.getItem(IOS_DISMISS_KEY);
      if (!dismissed) {
        setShowIosGuide(true);
      }
    }
  }, []);

  const handleCloseIosGuide = (open: boolean) => {
    setShowIosGuide(open);
    if (!open && typeof window !== 'undefined') {
      try {
        localStorage.setItem(IOS_DISMISS_KEY, Date.now().toString());
      } catch {
        // Ignorar excepciones de localStorage en modo incógnito/restringido
      }
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <MotionProvider reducedMotion="user">
        <OfflineBanner />
        {children}
        <OfflineFloatingCard />
        {showIosGuide && (
          <LazyIosInstallGuideSheet open={showIosGuide} onOpenChange={handleCloseIosGuide} />
        )}
        <Toaster />
      </MotionProvider>
    </QueryClientProvider>
  );
}
