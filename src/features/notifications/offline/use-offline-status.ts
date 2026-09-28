'use client';

import { useCallback, useEffect, useState } from 'react';

const announceOnline = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('online'));
  }
};

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
      announceOnline();
    } else {
      // Intentar una verificación de red si el navegador aún reporta offline
      fetch('/api/health', { method: 'HEAD', cache: 'no-store' })
        .then(() => {
          announceOnline();
        })
        .catch(() => {
          setIsOffline(true);
        });
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
