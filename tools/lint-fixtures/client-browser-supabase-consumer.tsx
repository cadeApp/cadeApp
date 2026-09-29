'use client';

// Fixture de prueba (AG-10): Archivo "use client" consumiendo cliente Supabase browser desde @/lib/supabase/browser
// Debe pasar linting sin errores de fronteras
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';

export function ClientBrowserSupabaseConsumer() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (supabase) {
      setReady(true);
    }
  }, []);

  return <div data-testid="probe">{ready ? 'connected' : 'initializing'}</div>;
}
