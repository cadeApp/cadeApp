import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createServerEnv } from '../env';
import {
  isAllowedE2EEnvironment,
  assertAllowedE2EEnvironment,
  isValidUuid,
  assertValidUuid,
  parseSupabaseProjectRef,
  isLocalSupabaseUrl,
  createStagingSeedContext,
  trackEntityForCleanup,
  seedStagingData,
  cleanupStagingData,
  KNOWN_STAGING_PROJECT_REFS,
  type StagingSeedContext,
} from './staging-seed';

describe('H02 / H08 / H10: Seed y Cleanup REAL en Staging con protección Fail-Closed', () => {
  describe('Protección fail-closed de entorno (assertAllowedE2EEnvironment)', () => {
    it('debe bloquear terminantemente cuando VERCEL_ENV es production', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          VERCEL_ENV: 'production',
          APP_ENV: 'staging',
          NEXT_PUBLIC_SUPABASE_URL: 'https://axwvmyqwhwfghyjdufny.supabase.co',
          E2E_TEST: 'true',
        });
      }).toThrow(/VERCEL_ENV es production/i);
    });

    it('debe bloquear terminantemente cuando APP_ENV es production', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          APP_ENV: 'production',
          NEXT_PUBLIC_SUPABASE_URL: 'https://axwvmyqwhwfghyjdufny.supabase.co',
          E2E_TEST: 'true',
        });
      }).toThrow(/APP_ENV es production/i);
    });

    it('debe bloquear terminantemente cuando NEXT_PUBLIC_APP_URL apunta a dominio de producción', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          NEXT_PUBLIC_APP_URL: 'https://cadeapp.com',
          NEXT_PUBLIC_SUPABASE_URL: 'https://axwvmyqwhwfghyjdufny.supabase.co',
          E2E_TEST: 'true',
        });
      }).toThrow(/dominio de producción/i);
    });

    it('debe bloquear cuando NEXT_PUBLIC_SUPABASE_URL coincide con SUPABASE_PRODUCTION_PROJECT_REF', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          SUPABASE_PRODUCTION_PROJECT_REF: 'prodproject12345678',
          NEXT_PUBLIC_SUPABASE_URL: 'https://prodproject12345678.supabase.co',
          E2E_TEST: 'true',
        });
      }).toThrow(/SUPABASE_PRODUCTION_PROJECT_REF/i);
    });

    // M8: NODE_ENV=test o flags apuntando a un Supabase que no es staging
    it('M8: debe bloquear cuando NODE_ENV=test pero la URL de Supabase es de producción o proyecto desconocido', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          NODE_ENV: 'test',
          E2E_TEST: 'true',
          NEXT_PUBLIC_SUPABASE_URL: 'https://desconocido-o-prod-ref.supabase.co',
        });
      }).toThrow(/no está positivamente identificado como staging/i);
    });

    it('M8: ALLOW_E2E_STAGING=true por sí sola NO debe autorizar un proyecto desconocido', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          ALLOW_E2E_STAGING: 'true',
          NEXT_PUBLIC_SUPABASE_URL: 'https://desconocido-o-prod-ref.supabase.co',
        });
      }).toThrow(/no está positivamente identificado como staging/i);
    });

    it('debe aplicar fail-closed cuando el entorno está completamente vacío', () => {
      expect(() => {
        assertAllowedE2EEnvironment({});
      }).toThrow(/fail-closed/i);
    });

    it('debe permitir cuando NEXT_PUBLIC_SUPABASE_URL es el proyecto staging conocido y E2E está habilitado', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_STAGING_PROJECT_REFS[0]}.supabase.co`,
          E2E_TEST: 'true',
        });
      }).not.toThrow();
    });

    it('debe permitir cuando coincide con SUPABASE_PROJECT_REF configurado en el ambiente staging', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          SUPABASE_PROJECT_REF: 'custom-staging-ref',
          NEXT_PUBLIC_SUPABASE_URL: 'https://custom-staging-ref.supabase.co',
          E2E_TEST: 'true',
        });
      }).not.toThrow();
    });

    it('debe permitir ejecución contra Supabase local en test/desarrollo', () => {
      expect(() => {
        assertAllowedE2EEnvironment({
          NODE_ENV: 'test',
          NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        });
      }).not.toThrow();
    });
  });

  describe('Validación de esquema UUID (assertValidUuid)', () => {
    it('acepta UUIDs v4 válidos', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(isValidUuid(validUuid)).toBe(true);
      expect(() => assertValidUuid(validUuid, 'testField')).not.toThrow();
    });

    // M6: usar IDs no UUID
    it('M6: rechaza terminantemente strings que no son UUID (e.g. e2e_*_req_1 o caba_norte)', () => {
      expect(isValidUuid('e2e_123_req_1')).toBe(false);
      expect(() => assertValidUuid('e2e_123_req_1', 'id')).toThrow(/debe ser un UUID válido/i);
      expect(() => assertValidUuid('caba_norte', 'pickup_zone_id')).toThrow(/debe ser un UUID válido/i);
      expect(() => assertValidUuid('invalid-short', 'merchant_id')).toThrow(/debe ser un UUID válido/i);
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

    it('rastrea entidades creadas exigiendo UUID válido sin duplicados', () => {
      const ctx = createStagingSeedContext();
      const reqId = '123e4567-e89b-12d3-a456-426614174001';
      const offId = '123e4567-e89b-12d3-a456-426614174002';
      const usrId = '123e4567-e89b-12d3-a456-426614174003';
      const zoneId = '123e4567-e89b-12d3-a456-426614174004';

      trackEntityForCleanup(ctx, 'request', reqId);
      trackEntityForCleanup(ctx, 'request', reqId);
      trackEntityForCleanup(ctx, 'offer', offId);
      trackEntityForCleanup(ctx, 'user', usrId);
      trackEntityForCleanup(ctx, 'zone', zoneId);

      expect(ctx.createdRequestIds).toEqual([reqId]);
      expect(ctx.createdOfferIds).toEqual([offId]);
      expect(ctx.createdUserIds).toEqual([usrId]);
      expect(ctx.createdZoneIds).toEqual([zoneId]);
    });
  });

  const setupStagingTestEnv = () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://axwvmyqwhwfghyjdufny.supabase.co');
      vi.stubEnv('E2E_TEST', 'true');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });
  };

  describe('Operación real de seed contra cliente Supabase (H08)', () => {
    setupStagingTestEnv();

    it('construye únicamente UUIDs válidos para id, merchant_id y zonas', async () => {
      const ctx = createStagingSeedContext();
      const capturedInserts: { delivery_requests: any[]; zones: any[] } = {
        delivery_requests: [],
        zones: [],
      };

      const mockMerchantId = '123e4567-e89b-12d3-a456-426614174010';
      const mockZoneId = '123e4567-e89b-12d3-a456-426614174020';

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'zones') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ id: mockZoneId }],
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'delivery_requests') {
            return {
              insert: vi.fn((payload: any) => {
                capturedInserts.delivery_requests.push(payload);
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: payload.id },
                      error: null,
                    }),
                  }),
                };
              }),
            };
          }
          if (table === 'profiles' || table === 'merchants') {
            return {
              upsert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
        auth: {
          admin: {
            createUser: vi.fn().mockResolvedValue({
              data: { user: { id: mockMerchantId } },
              error: null,
            }),
          },
        },
      } as any;

      await seedStagingData(ctx, { requestsCount: 1 }, mockClient);

      expect(capturedInserts.delivery_requests).toHaveLength(1);
      const row = capturedInserts.delivery_requests[0]!;

      // Verificación estricta de que todos los IDs son UUIDs v4
      expect(isValidUuid(row.id)).toBe(true);
      expect(isValidUuid(row.merchant_id)).toBe(true);
      expect(isValidUuid(row.pickup_zone_id)).toBe(true);
      expect(isValidUuid(row.dropoff_zone_id)).toBe(true);

      // No strings falsos
      expect(row.id).not.toContain('e2e_');
      expect(row.merchant_id).not.toContain('e2e_');
      expect(row.pickup_zone_id).not.toBe('caba_norte');

      expect(ctx.createdRequestIds).toContain(row.id);
    });

    // M7: Supabase responde error al insert -> seed debe rechazar/fallar y no marcar la entidad como creada
    it('M7: si Supabase responde error en la inserción, el seed debe fallar y no registrar el ID en el contexto', async () => {
      const ctx = createStagingSeedContext();
      const mockMerchantId = '123e4567-e89b-12d3-a456-426614174011';
      const mockZoneId = '123e4567-e89b-12d3-a456-426614174021';

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'zones') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ id: mockZoneId }],
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'delivery_requests') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'violates foreign key constraint' },
                  }),
                }),
              }),
            };
          }
          if (table === 'profiles' || table === 'merchants') {
            return {
              upsert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
        auth: {
          admin: {
            createUser: vi.fn().mockResolvedValue({
              data: { user: { id: mockMerchantId } },
              error: null,
            }),
          },
        },
      } as any;

      await expect(seedStagingData(ctx, { requestsCount: 1 }, mockClient)).rejects.toThrow(
        /violates foreign key constraint/i
      );

      // Garantía: el ID fallido jamás se marca como creado
      expect(ctx.createdRequestIds).toHaveLength(0);
    });
  });

  describe('Limpieza acotada de staging (cleanupStagingData)', () => {
    setupStagingTestEnv();

    it('ejecuta delete() en orden inverso y vacía los registros', async () => {
      const ctx: StagingSeedContext = {
        testRunId: 'e2e_run_123',
        createdOfferIds: ['123e4567-e89b-12d3-a456-426614174031'],
        createdRequestIds: ['123e4567-e89b-12d3-a456-426614174032'],
        createdUserIds: ['123e4567-e89b-12d3-a456-426614174033'],
        createdZoneIds: ['123e4567-e89b-12d3-a456-426614174034'],
      };

      const offersInMock = vi.fn().mockResolvedValue({ error: null });
      const requestsInMock = vi.fn().mockResolvedValue({ error: null });
      const merchantsInMock = vi.fn().mockResolvedValue({ error: null });
      const profilesInMock = vi.fn().mockResolvedValue({ error: null });
      const zonesInMock = vi.fn().mockResolvedValue({ error: null });
      const mockDeleteUser = vi.fn().mockResolvedValue({ error: null });

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'offers') return { delete: vi.fn().mockReturnValue({ in: offersInMock }) };
          if (table === 'delivery_requests') return { delete: vi.fn().mockReturnValue({ in: requestsInMock }) };
          if (table === 'merchants') return { delete: vi.fn().mockReturnValue({ in: merchantsInMock }) };
          if (table === 'profiles') return { delete: vi.fn().mockReturnValue({ in: profilesInMock }) };
          if (table === 'zones') return { delete: vi.fn().mockReturnValue({ in: zonesInMock }) };
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
      expect(offersInMock).toHaveBeenCalledWith('id', ['123e4567-e89b-12d3-a456-426614174031']);

      expect(mockClient.from).toHaveBeenCalledWith('delivery_requests');
      expect(requestsInMock).toHaveBeenCalledWith('id', ['123e4567-e89b-12d3-a456-426614174032']);

      expect(mockClient.from).toHaveBeenCalledWith('merchants');
      expect(merchantsInMock).toHaveBeenCalledWith('profile_id', ['123e4567-e89b-12d3-a456-426614174033']);

      expect(mockClient.from).toHaveBeenCalledWith('zones');
      expect(zonesInMock).toHaveBeenCalledWith('id', ['123e4567-e89b-12d3-a456-426614174034']);

      expect(mockDeleteUser).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174033');

      expect(ctx.createdOfferIds).toHaveLength(0);
      expect(ctx.createdRequestIds).toHaveLength(0);
      expect(ctx.createdUserIds).toHaveLength(0);
      expect(ctx.createdZoneIds).toHaveLength(0);
    });

    it('continúa el cleanup ante fallos parciales, conserva los IDs fallidos y reporta error agregado (H14)', async () => {
      const ctx: StagingSeedContext = {
        testRunId: 'e2e_run_123',
        createdOfferIds: ['123e4567-e89b-12d3-a456-426614174041'],
        createdRequestIds: ['123e4567-e89b-12d3-a456-426614174042'],
        createdUserIds: ['123e4567-e89b-12d3-a456-426614174043'],
        createdZoneIds: [],
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
          return {
            delete: () => ({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }),
        auth: {
          admin: {
            deleteUser: vi.fn().mockResolvedValue({ error: null }),
          },
        },
      } as any;

      await expect(cleanupStagingData(ctx, mockClient)).rejects.toThrow(
        /\[E2E Cleanup Error\] Falló la limpieza de staging: offers/i
      );
      // El ID fallido se conserva para trazabilidad y reintento
      expect(ctx.createdOfferIds).toEqual(['123e4567-e89b-12d3-a456-426614174041']);
      // Los exitosos fueron eliminados del tracking
      expect(ctx.createdRequestIds).toHaveLength(0);
      expect(ctx.createdUserIds).toHaveLength(0);
    });

    it('M11: si delete().in(...) devuelve { error } sin rechazar, cleanup no borra el tracking, intenta las demás y reporta fallo agregado', async () => {
      const ctx: StagingSeedContext = {
        testRunId: 'e2e_run_m11',
        createdOfferIds: [],
        createdRequestIds: ['123e4567-e89b-12d3-a456-426614174071'],
        createdUserIds: ['123e4567-e89b-12d3-a456-426614174072'],
        createdZoneIds: [],
      };

      const deleteUserMock = vi.fn().mockResolvedValue({ error: null });

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            return {
              delete: () => ({
                // Devuelve error de Supabase sin rechazar la promise
                in: vi.fn().mockResolvedValue({ error: { message: 'FK violation on delivery_requests' } }),
              }),
            };
          }
          return {
            delete: () => ({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }),
        auth: {
          admin: {
            deleteUser: deleteUserMock,
          },
        },
      } as any;

      // Debe lanzar error agregado que informe el fallo
      await expect(cleanupStagingData(ctx, mockClient)).rejects.toThrow(
        /\[E2E Cleanup Error\] Falló la limpieza de staging: delivery_requests/i
      );

      // El ID de delivery_requests QUE FALLÓ debe conservarse en el tracking
      expect(ctx.createdRequestIds).toContain('123e4567-e89b-12d3-a456-426614174071');

      // Las demás entidades debieron ser intentadas y eliminadas exitosamente
      expect(deleteUserMock).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174072');
      expect(ctx.createdUserIds).toHaveLength(0);
    });

    it('M13: si merchants.delete() devuelve error, profiles.delete() y auth.deleteUser() devuelven éxito, cleanup intenta las 3, falla con [E2E Cleanup Error], conserva el userId y libera IDs confirmados', async () => {
      const failedUserId = '123e4567-e89b-12d3-a456-426614174081';
      const cleanRequestId = '123e4567-e89b-12d3-a456-426614174082';
      const cleanZoneId = '123e4567-e89b-12d3-a456-426614174083';

      const ctx: StagingSeedContext = {
        testRunId: 'e2e_run_m13',
        createdOfferIds: [],
        createdRequestIds: [cleanRequestId],
        createdUserIds: [failedUserId],
        createdZoneIds: [cleanZoneId],
      };

      const merchantsInMock = vi.fn().mockResolvedValue({ error: { message: 'Merchants foreign key lock error' } });
      const profilesInMock = vi.fn().mockResolvedValue({ error: null });
      const requestsInMock = vi.fn().mockResolvedValue({ error: null });
      const zonesInMock = vi.fn().mockResolvedValue({ error: null });
      const deleteUserMock = vi.fn().mockResolvedValue({ error: null });

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'merchants') {
            return {
              delete: () => ({
                in: merchantsInMock,
              }),
            };
          }
          if (table === 'profiles') {
            return {
              delete: () => ({
                in: profilesInMock,
              }),
            };
          }
          if (table === 'delivery_requests') {
            return {
              delete: () => ({
                in: requestsInMock,
              }),
            };
          }
          if (table === 'zones') {
            return {
              delete: () => ({
                in: zonesInMock,
              }),
            };
          }
          return {
            delete: () => ({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }),
        auth: {
          admin: {
            deleteUser: deleteUserMock,
          },
        },
      } as any;

      // 1. Cleanup debe terminar con [E2E Cleanup Error]
      await expect(cleanupStagingData(ctx, mockClient)).rejects.toThrow(
        /\[E2E Cleanup Error\] Falló la limpieza de staging: merchants/i
      );

      // 2. Cleanup intenta las tres operaciones del agregado de usuario
      expect(merchantsInMock).toHaveBeenCalledWith('profile_id', [failedUserId]);
      expect(profilesInMock).toHaveBeenCalledWith('id', [failedUserId]);
      expect(deleteUserMock).toHaveBeenCalledWith(failedUserId);

      // 3. El user ID permanece en context.createdUserIds porque falló la etapa de merchants (H15 / M13)
      expect(ctx.createdUserIds).toEqual([failedUserId]);

      // 4. Otros IDs confirmadamente limpiados sí salieron del tracking
      expect(ctx.createdRequestIds).toHaveLength(0);
      expect(ctx.createdZoneIds).toHaveLength(0);
    });
  });

  describe('Ciclo de vida E2E Playwright (seed -> test -> cleanup)', () => {
    setupStagingTestEnv();

    it('demuestra que cleanup se ejecuta en finally incluso si la prueba falla', async () => {
      const ctx = createStagingSeedContext();
      const mockMerchantId = '123e4567-e89b-12d3-a456-426614174051';
      const mockZoneId = '123e4567-e89b-12d3-a456-426614174052';
      const mockReqId = '123e4567-e89b-12d3-a456-426614174053';

      const deleteReqMock = vi.fn().mockResolvedValue({ error: null });
      const deleteUserMock = vi.fn().mockResolvedValue({ error: null });

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'zones') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ id: mockZoneId }],
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'delivery_requests') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockReqId },
                    error: null,
                  }),
                }),
              }),
              delete: vi.fn().mockReturnValue({ in: deleteReqMock }),
            };
          }
          if (table === 'profiles' || table === 'merchants') {
            return {
              upsert: vi.fn().mockResolvedValue({ error: null }),
              delete: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return {
            delete: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
          };
        }),
        auth: {
          admin: {
            createUser: vi.fn().mockResolvedValue({
              data: { user: { id: mockMerchantId } },
              error: null,
            }),
            deleteUser: deleteUserMock,
          },
        },
      } as any;

      // Ejecución del patrón de fixture de Playwright (seed -> test body -> finally cleanup)
      let testBodyExecuted = false;
      let errorThrownByTest = false;

      try {
        await seedStagingData(ctx, { requestsCount: 1 }, mockClient);
        expect(ctx.createdRequestIds).toContain(mockReqId);

        testBodyExecuted = true;
        // Simular que el test falla en alguna assertion
        throw new Error('Test assertion failed');
      } catch (err: any) {
        if (err.message === 'Test assertion failed') {
          errorThrownByTest = true;
        }
      } finally {
        await cleanupStagingData(ctx, mockClient);
      }

      expect(testBodyExecuted).toBe(true);
      expect(errorThrownByTest).toBe(true);

      // Verificación de que el cleanup se ejecutó a pesar del fallo
      expect(deleteReqMock).toHaveBeenCalledWith('id', [mockReqId]);
      expect(deleteUserMock).toHaveBeenCalledWith(mockMerchantId);
      expect(ctx.createdRequestIds).toHaveLength(0);
    });

    it('M9: si el seed crea recursos (e.g. usuario) y luego falla, el ciclo try/finally invoca cleanupStagingData', async () => {
      const ctx = createStagingSeedContext();
      const mockMerchantId = '123e4567-e89b-12d3-a456-426614174061';
      const mockZoneId = '123e4567-e89b-12d3-a456-426614174062';

      const deleteUserMock = vi.fn().mockResolvedValue({ error: null });

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'zones') {
            return {
              select: () => ({ eq: () => ({ limit: vi.fn().mockResolvedValue({ data: [{ id: mockZoneId }], error: null }) }) }),
            };
          }
          if (table === 'profiles') {
            // Falla en profiles tras haber creado el usuario auth
            return {
              upsert: vi.fn().mockResolvedValue({ error: { message: 'Profiles DB error' } }),
              delete: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return {
            delete: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
          };
        }),
        auth: {
          admin: {
            createUser: vi.fn().mockResolvedValue({
              data: { user: { id: mockMerchantId } },
              error: null,
            }),
            deleteUser: deleteUserMock,
          },
        },
      } as any;

      let seedErrorCaught: any = null;
      let cleanupRan = false;

      try {
        await seedStagingData(ctx, { requestsCount: 1 }, mockClient);
      } catch (err: any) {
        seedErrorCaught = err;
      } finally {
        await cleanupStagingData(ctx, mockClient);
        cleanupRan = true;
      }

      // Debe haber fallado el seed
      expect(seedErrorCaught).not.toBeNull();
      expect(seedErrorCaught.message).toMatch(/Falló el upsert en profiles/i);

      // Cleanup DEBE haberse ejecutado y haber limpiado el usuario que el seed creó antes de fallar
      expect(cleanupRan).toBe(true);
      expect(deleteUserMock).toHaveBeenCalledWith(mockMerchantId);
      expect(ctx.createdUserIds).toHaveLength(0);
    });

    it('M12: si el upsert de merchants o profiles devuelve { error }, seedStagingData falla inmediatamente y no ignora el error', async () => {
      const ctx = createStagingSeedContext();
      const mockMerchantId = '123e4567-e89b-12d3-a456-426614174081';
      const mockZoneId = '123e4567-e89b-12d3-a456-426614174082';

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'zones') {
            return {
              select: () => ({ eq: () => ({ limit: vi.fn().mockResolvedValue({ data: [{ id: mockZoneId }], error: null }) }) }),
            };
          }
          if (table === 'profiles') {
            return { upsert: vi.fn().mockResolvedValue({ error: null }) };
          }
          if (table === 'merchants') {
            return { upsert: vi.fn().mockResolvedValue({ error: { message: 'Merchants table constraint error' } }) };
          }
          return {};
        }),
        auth: {
          admin: {
            createUser: vi.fn().mockResolvedValue({
              data: { user: { id: mockMerchantId } },
              error: null,
            }),
          },
        },
      } as any;

      await expect(seedStagingData(ctx, { requestsCount: 1 }, mockClient)).rejects.toThrow(
        /\[E2E Seed Error\] Falló el upsert en merchants: Merchants table constraint error/i
      );

      // No debe haber intentado insertar delivery_requests
      expect(ctx.createdRequestIds).toHaveLength(0);
    });

    it('M10: las variables del workflow e2e-staging.yml satisfacen serverEnvSchema; sin DNI_HMAC_SECRET o CRON_SECRET falla la carga del servidor', () => {
      const workflowPath = path.resolve(process.cwd(), '.github/workflows/e2e-staging.yml');
      const yamlContent = fs.readFileSync(workflowPath, 'utf8');

      // Verificar que el workflow incluye explícitamente DNI_HMAC_SECRET y CRON_SECRET
      expect(yamlContent).toMatch(/DNI_HMAC_SECRET:\s*\${{\s*secrets\.DNI_HMAC_SECRET\s*}}/);
      expect(yamlContent).toMatch(/CRON_SECRET:\s*\${{\s*secrets\.CRON_SECRET\s*}}/);

      // Simular el entorno cargado con los secrets del workflow (valores válidos para CI)
      const simulatedWorkflowEnv: Record<string, string> = {
        NODE_ENV: 'test',
        SUPABASE_SERVICE_ROLE_KEY: 'mock_service_role_key_for_test',
        DNI_HMAC_SECRET: 'min_16_characters_secret_key_123',
        CRON_SECRET: 'mock_cron_secret',
        NEXT_PUBLIC_APP_URL: 'https://cadeapp-staging.vercel.app',
        NEXT_PUBLIC_SUPABASE_URL: 'https://axwvmyqwhwfghyjdufny.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock_anon_key',
        E2E_TEST: 'true',
      };

      // Debe validar sin arrojar error usando la carga real de createServerEnv
      expect(() => createServerEnv(simulatedWorkflowEnv)).not.toThrow();

      // M10: Si falta DNI_HMAC_SECRET (estado anterior de e2e-staging.yml), falla
      const missingDni = { ...simulatedWorkflowEnv, DNI_HMAC_SECRET: undefined };
      expect(() => createServerEnv(missingDni)).toThrow(/DNI_HMAC_SECRET es obligatoria/i);

      // M10: Si falta CRON_SECRET (estado anterior de e2e-staging.yml), falla
      const missingCron = { ...simulatedWorkflowEnv, CRON_SECRET: undefined };
      expect(() => createServerEnv(missingCron)).toThrow(/CRON_SECRET es obligatoria/i);
    });
  });
});
