'use client';

import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/ui';
import { useOfflineStatus } from './use-offline-status';

export interface OfflineBannerProps {
  className?: string;
}

export function OfflineBanner({ className = '' }: OfflineBannerProps) {
  const { isOffline } = useOfflineStatus();

  if (!isOffline) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-50 flex w-full items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-xs font-medium text-amber-950 dark:text-amber-200 sm:text-sm ${className}`}
    >
      <WifiOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <span>Sin conexión. Mostramos lo último que cargó</span>
    </aside>
  );
}

export interface OfflineFloatingCardProps {
  onRetry?: () => void;
  className?: string;
}

export function OfflineFloatingCard({ onRetry, className = '' }: OfflineFloatingCardProps) {
  const { isOffline, retryConnection } = useOfflineStatus();

  if (!isOffline) {
    return null;
  }

  const handleRetry = onRetry ?? retryConnection;

  return (
    <div
      role="region"
      aria-label="Aviso de reconexión"
      className={`fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-md rounded-xl border border-border bg-card/95 p-3.5 shadow-modal backdrop-blur-sm sm:bottom-6 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
          <RefreshCw className="h-4 w-4 shrink-0 text-brand-teal animate-spin-slow" aria-hidden="true" />
          <span>Cuando vuelva la conexión, actualizamos solo</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 shrink-0 px-3 text-xs font-medium"
          onClick={handleRetry}
        >
          Reintentar
        </Button>
      </div>
    </div>
  );
}
