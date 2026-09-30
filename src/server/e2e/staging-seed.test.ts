import { describe, expect, it, vi } from 'vitest';
import {
  isAllowedE2EEnvironment,
  assertAllowedE2EEnvironment,
  createStagingSeedContext,
  trackEntityForCleanup,
  seedStagingData,
  cleanupStagingData,
  type StagingSeedContext,
} from './staging-seed';

describe('H02: Seed y Cleanup REAL en Staging con protección Fail-Closed', () => {
  describe('Protección fail-closed de entorno (assertAllowedE2EEnvironment)', () => {
    it('debe bloquear terminantemente cuando VERCEL_ENV es production', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          VERCEL_ENV: 'production',
          APP_ENV: 'staging',
        });
      }).toThrow(/VERCEL_ENV es production/i);
    });

    it('debe bloquear terminantemente cuando APP_ENV es production', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          APP_ENV: 'production',
          NODE_ENV: 'test',
        });
      }).toThrow(/APP_ENV es production/i);
    });

    it('debe bloquear terminantemente cuando NEXT_PUBLIC_APP_URL apunta a dominio de producción', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          APP_ENV: 'staging',
          NEXT_PUBLIC_APP_URL: 'https://cadeapp.com',
        });
      }).toThrow(/dominio de producción/i);
    });

    it('debe bloquear terminantemente cuando NEXT_PUBLIC_SUPABASE_URL apunta a proyecto prod', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          APP_ENV: 'staging',
          NEXT_PUBLIC_SUPABASE_URL: 'https://cadeapp-prod.supabase.co',
        });
      }).toThrow(/proyecto de producción/i);
    });

    it('debe aplicar fail-closed cuando el entorno es ambiguo o no tiene indicadores afirmativos', () => {
      expect(() => {
        assertAllowedE2EEnvironment({});
      }).toThrow(/fail-closed/i);
    });

    it('debe permitir ejecución cuando APP_ENV es staging', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          APP_ENV: 'staging',
          NEXT_PUBLIC_APP_URL: 'https://cadeapp-staging.vercel.app',
        });
      }).not.toThrow();
    });

    it('debe permitir ejecución cuando VERCEL_ENV es preview', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          VERCEL_ENV: 'preview',
          NEXT_PUBLIC_APP_URL: 'https://cadeapp-git-feat-staging.vercel.app',
        });
      }).not.toThrow();
    });

    it('debe permitir ejecución cuando NODE_ENV es test', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          NODE_ENV: 'test',
        });
      }).not.toThrow();
    });
  });

  describe('Contexto y rastreo de ejecución única (StagingSeedContext)', () => {
    it('crea un identificador de corrida único con prefijo e2e_', () => {
      const ctx1 = createStagingSeedContext();
      const ctx2 = createStagingSeedContext();

      expect(ctx1.testRunId).toMatch(/^e2e_\d+_[a-z0-9]+$/);
      expect(ctx2.testRunId).toMatch(/^e2e_\d+_[a-z0-9]+$/);
      expect(ctx1.testRunId).not.toBe(ctx2.testRunId);
    });

    it('rastrea entidades creadas sin duplicar IDs', () => {
      const ctx = createStagingSeedContext();
      trackEntityForCleanup(ctx, 'request', 'req_1');
      trackEntityForCleanup(ctx, 'request', 'req_1');
      trackEntityForCleanup(ctx, 'offer', 'off_1');
      trackEntityForCleanup(ctx, 'user', 'usr_1');

      expect(ctx.createdRequestIds).toEqual(['req_1']);
      expect(ctx.createdOfferIds).toEqual(['off_1']);
      expect(ctx.createdUserIds).toEqual(['usr_1']);
    });
  });

  describe('Operación real de seed contra cliente Supabase', () => {
    it('inserta requests en delivery_requests vinculados a la corrida', async () => {
      const ctx = createStagingSeedContext();
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: `${ctx.testRunId}_req_1` },
            error: null,
          }),
        }),
      });

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            return { insert: mockInsert };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as any;

      await seedStagingData(ctx, { requestsCount: 1 }, mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('delivery_requests');
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(ctx.createdRequestIds).toContain(`${ctx.testRunId}_req_1`);
    });
  });

  describe('Limpieza acotada de staging (cleanupStagingData)', () => {
    it('ejecuta delete() en orden inverso (offers -> requests -> users) y vacía los registros', async () => {
      const ctx: StagingSeedContext = {
        testRunId: 'e2e_run_123',
        createdOfferIds: ['off_1'],
        createdRequestIds: ['req_1'],
        createdUserIds: ['usr_1'],
      };

      const offersInMock = vi.fn().mockResolvedValue({ error: null });
      const requestsInMock = vi.fn().mockResolvedValue({ error: null });
      const mockOffersDelete = vi.fn().mockReturnValue({ in: offersInMock });
      const mockRequestsDelete = vi.fn().mockReturnValue({ in: requestsInMock });
      const mockDeleteUser = vi.fn().mockResolvedValue({ error: null });

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'offers') return { delete: mockOffersDelete };
          if (table === 'delivery_requests') return { delete: mockRequestsDelete };
          throw new Error(`Unexpected table ${table}`);
        }),
        auth: {
          admin: {
            deleteUser: mockDeleteUser,
          },
        },
      } as any;

      await cleanupStagingData(ctx, mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('offers');
      expect(offersInMock).toHaveBeenCalledWith('id', ['off_1']);

      expect(mockClient.from).toHaveBeenCalledWith('delivery_requests');
      expect(requestsInMock).toHaveBeenCalledWith('id', ['req_1']);

      expect(mockDeleteUser).toHaveBeenCalledWith('usr_1');

      expect(ctx.createdOfferIds).toHaveLength(0);
      expect(ctx.createdRequestIds).toHaveLength(0);
      expect(ctx.createdUserIds).toHaveLength(0);
    });

    it('tolera fallos parciales sin abortar el cleanup de los demás registros', async () => {
      const ctx: StagingSeedContext = {
        testRunId: 'e2e_run_123',
        createdOfferIds: ['off_1'],
        createdRequestIds: ['req_1'],
        createdUserIds: ['usr_1'],
      };

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'offers') {
            return {
              delete: () => ({
                in: vi.fn().mockRejectedValue(new Error('Network failure')),
              }),
            };
          }
          if (table === 'delivery_requests') {
            return {
              delete: () => ({
                in: vi.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          return {};
        }),
        auth: {
          admin: {
            deleteUser: vi.fn().mockResolvedValue({ error: null }),
          },
        },
      } as any;

      await expect(cleanupStagingData(ctx, mockClient)).resolves.not.toThrow();
      expect(ctx.createdOfferIds).toHaveLength(0);
      expect(ctx.createdRequestIds).toHaveLength(0);
      expect(ctx.createdUserIds).toHaveLength(0);
    });
  });
});
