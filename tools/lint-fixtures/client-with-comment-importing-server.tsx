// Encabezado de comentario previo a la directiva
'use client';

// Fixture: Archivo "use client" con comentario inicial importando de src/server/** (Hallazgo 2)
import { serverEnv } from '@/server/env';

export function ClientComponentWithComment() {
  return <div>{serverEnv.NODE_ENV}</div>;
}
