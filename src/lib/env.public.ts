import { z } from 'zod';

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .string({ required_error: 'NEXT_PUBLIC_APP_URL es obligatoria' })
    .url('NEXT_PUBLIC_APP_URL debe ser una URL válida (ej: http://localhost:3000)'),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ required_error: 'NEXT_PUBLIC_SUPABASE_URL es obligatoria' })
    .url('NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida (ej: http://127.0.0.1:54321)'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({ required_error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY es obligatoria' })
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY no puede estar vacía'),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: z.string().optional().default(''),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional().default(''),
  NEXT_PUBLIC_ENABLE_MOCK_MAPS: z.enum(['true', 'false']).optional().default('false'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional().default(''),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function createPublicEnv(env: Record<string, string | undefined>): PublicEnv {
  const parsed = publicEnvSchema.safeParse(env);
  if (!parsed.success) {
    const errorMessages = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `❌ Error en variables de entorno públicas (cliente):\n${errorMessages}\n\nRevisá .env.local o configurá las variables en el entorno de despliegue.`
    );
  }
  return parsed.data;
}

let cachedPublicEnv: PublicEnv | null = null;

export function getPublicEnv(): PublicEnv {
  if (!cachedPublicEnv) {
    // IMPORTANTE: cada acceso debe ser una expresión literal `process.env.NEXT_PUBLIC_*`
    // para que el DefinePlugin de Next.js lo sustituya textualmente en el bundle de cliente.
    // NO reemplazar por un bucle ni por destructuring: rompe el inlineado en navegador.
    cachedPublicEnv = createPublicEnv({
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      NEXT_PUBLIC_ENABLE_MOCK_MAPS: process.env.NEXT_PUBLIC_ENABLE_MOCK_MAPS,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    });
  }
  return cachedPublicEnv;
}

export const publicEnv = new Proxy({} as PublicEnv, {
  get(_target, prop: string | symbol) {
    return getPublicEnv()[prop as keyof PublicEnv];
  },
  ownKeys() {
    return Reflect.ownKeys(getPublicEnv());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return {
      value: getPublicEnv()[prop as keyof PublicEnv],
      enumerable: true,
      configurable: true,
    };
  },
});
