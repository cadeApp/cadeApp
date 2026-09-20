import 'server-only';
import { z } from 'zod';

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ required_error: 'SUPABASE_SERVICE_ROLE_KEY es obligatoria' })
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY no puede estar vacía'),
  DNI_HMAC_SECRET: z
    .string({ required_error: 'DNI_HMAC_SECRET es obligatoria' })
    .min(16, 'DNI_HMAC_SECRET debe tener al menos 16 caracteres para seguridad criptográfica'),
  CRON_SECRET: z
    .string({ required_error: 'CRON_SECRET es obligatoria' })
    .min(1, 'CRON_SECRET no puede estar vacía'),
  DISCORD_ERROR_WEBHOOK_URL: z
    .string()
    .url('DISCORD_ERROR_WEBHOOK_URL debe ser una URL válida de Discord')
    .optional()
    .or(z.literal('')),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_SUBJECT: z.string().optional().default(''),
  RPC_ADAPTER: z.enum(['real', 'fake']).optional().default('real'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function createServerEnv(env: Record<string, string | undefined>): ServerEnv {
  const parsed = serverEnvSchema.safeParse(env);
  if (!parsed.success) {
    const errorMessages = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `❌ Error en variables de entorno de servidor (privadas):\n${errorMessages}\n\nRevisá .env.local o configurá los secretos en el entorno de despliegue.`
    );
  }
  return parsed.data;
}

let cachedServerEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = createServerEnv(process.env);
  }
  return cachedServerEnv;
}

export const serverEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: string | symbol) {
    return getServerEnv()[prop as keyof ServerEnv];
  },
  ownKeys() {
    return Reflect.ownKeys(getServerEnv());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return {
      value: getServerEnv()[prop as keyof ServerEnv],
      enumerable: true,
      configurable: true,
    };
  },
});
