'use client';

import { useCallback, useEffect, useState } from 'react';

export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof navigator !== 'undefined') {
      return !navigator.onLine;
    }
    return false;
  });

  const handleOnline = useCallback(() => {
    setIsOffline(false);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOffline(true);
  }, []);

  const retryConnection = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setIsOffline(false);
    } else {
      // Intentar una verificación de red si el navegador aún reporta offline
      fetch('/api/health', { method: 'HEAD', cache: 'no-store' })
        .then(() => setIsOffline(false))
        .catch(() => setIsOffline(true));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return {
    isOffline,
    retryConnection,
  };
}
