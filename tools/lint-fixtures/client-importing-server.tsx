'use client';

// Fixture de prueba (b): Archivo "use client" importando de src/server/** (prohibido por regla 20)
// Debe fallar con cadeapp/client-no-server
import { serverEnv } from '@/server/env';

export function ClientComponentWithServer() {
  return <div>{serverEnv.NODE_ENV}</div>;
}
