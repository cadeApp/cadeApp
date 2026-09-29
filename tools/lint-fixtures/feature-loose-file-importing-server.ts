// Fixture de prueba: un archivo suelto de feature no puede importar de src/server/** (H09)
// Debe fallar con cadeapp/feature-server-boundary
import { serverEnv } from '@/server/env';

export const looseServerAccess = serverEnv.NODE_ENV;
