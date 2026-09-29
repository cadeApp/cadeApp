import { describe, expect, it } from 'vitest';
import { createServerEnv } from './env';
import { createPublicEnv } from '@/lib/env.public';

describe('Server Environment Validation', () => {
  const validServerEnv = {
    NODE_ENV: 'test',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-12345',
    DNI_HMAC_SECRET: 'super-secret-hmac-key-min-16-chars',
    CRON_SECRET: 'test-cron-secret-abcdef',
    DISCORD_ERROR_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc',
    RPC_ADAPTER: 'real',
  };

  it('debe validar correctamente un entorno con todas las variables requeridas', () => {
    const env = createServerEnv(validServerEnv);
    expect(env.NODE_ENV).toBe('test');
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('test-service-role-key-12345');
    expect(env.DNI_HMAC_SECRET).toBe('super-secret-hmac-key-min-16-chars');
    expect(env.CRON_SECRET).toBe('test-cron-secret-abcdef');
    expect(env.RPC_ADAPTER).toBe('real');
  });

  it('debe fallar con mensaje claro si falta SUPABASE_SERVICE_ROLE_KEY', () => {
    const invalidEnv = { ...validServerEnv, SUPABASE_SERVICE_ROLE_KEY: undefined };
    expect(() => createServerEnv(invalidEnv)).toThrowError(/SUPABASE_SERVICE_ROLE_KEY es obligatoria/);
  });

  it('debe fallar con mensaje claro si DNI_HMAC_SECRET tiene menos de 16 caracteres', () => {
    const invalidEnv = { ...validServerEnv, DNI_HMAC_SECRET: 'short' };
    expect(() => createServerEnv(invalidEnv)).toThrowError(/DNI_HMAC_SECRET debe tener al menos 16 caracteres/);
  });

  it('debe fallar con mensaje claro si falta CRON_SECRET', () => {
    const invalidEnv = { ...validServerEnv, CRON_SECRET: undefined };
    expect(() => createServerEnv(invalidEnv)).toThrowError(/CRON_SECRET es obligatoria/);
  });
});

describe('Public Environment Validation', () => {
  const validPublicEnv = {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key-12345',
  };

  it('debe validar correctamente un entorno público válido', () => {
    const env = createPublicEnv(validPublicEnv);
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321');
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('test-anon-key-12345');
    expect(env.NEXT_PUBLIC_ENABLE_MOCK_MAPS).toBe('false');
  });

  it('debe fallar si falta NEXT_PUBLIC_APP_URL', () => {
    const invalidEnv = { ...validPublicEnv, NEXT_PUBLIC_APP_URL: undefined };
    expect(() => createPublicEnv(invalidEnv)).toThrowError(/NEXT_PUBLIC_APP_URL es obligatoria/);
  });

  it('debe fallar si NEXT_PUBLIC_APP_URL no es una URL válida', () => {
    const invalidEnv = { ...validPublicEnv, NEXT_PUBLIC_APP_URL: 'not-a-url' };
    expect(() => createPublicEnv(invalidEnv)).toThrowError(/NEXT_PUBLIC_APP_URL debe ser una URL válida/);
  });

  it('debe fallar si falta NEXT_PUBLIC_SUPABASE_ANON_KEY', () => {
    const invalidEnv = { ...validPublicEnv, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined };
    expect(() => createPublicEnv(invalidEnv)).toThrowError(/NEXT_PUBLIC_SUPABASE_ANON_KEY es obligatoria/);
  });
});
