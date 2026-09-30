'use client';

import { useCallback, useEffect, useState } from 'react';

const announceOnline = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('online'));
  }
};

export function useOfflineStatus() {
  // Arranca online en servidor y cliente: Node 22 expone `navigator` sin `onLine`, y leerlo en el render
  // hacía que el HTML del servidor saliera con «Sin conexión». El valor real se lee al montar.
  const [isOffline, setIsOffline] = useState(false);

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

    setIsOffline(navigator.onLine === false);

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
