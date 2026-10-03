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
  seedOffersForFirstRequest,
  getRequestInspectionData,
  findRequestIdByNotesMarker,
  cleanupStagingData,
  base32Decode,
  generateTotp,
  seedAdminUser,
  elevateAdminToAal2,
  seedDeliveryRequestInState,
  getPlatformSettingNumber,
  setMerchantSubscriptionStatus,
  KNOWN_STAGING_PROJECT_REFS,
  type StagingSeedContext,
  type AdminClientType,
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

    it('no reutiliza una zona transitoria creada por otra corrida E2E', async () => {
      const ctx = createStagingSeedContext();
      const merchantId = '123e4567-e89b-12d3-a456-426614174090';
      const foreignTransientZoneId = '123e4567-e89b-12d3-a456-426614174091';
      const ownZoneId = '123e4567-e89b-12d3-a456-426614174092';

      const zonesInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: ownZoneId }, error: null }),
        }),
      });

      const requestInsert = vi.fn((payload: { id: string }) => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: payload.id }, error: null }),
        }),
      }));

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'zones') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ id: foreignTransientZoneId, name: 'E2E Zona corrida-ajena' }],
                    error: null,
                  }),
                }),
              }),
              insert: zonesInsert,
            };
          }
          if (table === 'delivery_requests') {
            return { insert: requestInsert };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      } as unknown as AdminClientType;

      await seedStagingData(ctx, { requestsCount: 1, merchantId }, mockClient);

      expect(zonesInsert).toHaveBeenCalledTimes(1);
      expect(ctx.createdZoneIds).toEqual([ownZoneId]);
      expect(ctx.createdRequestIds).toHaveLength(1);
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

  describe('T-303: Ampliación de arnés E2E para usuarios reales, contactos, ofertas y cleanup relacional', () => {
    setupStagingTestEnv();

    it('creación de merchant + 2 couriers y retorno de credenciales solo en memoria', async () => {
      const ctx = createStagingSeedContext();
      const mockMerchantId = '123e4567-e89b-12d3-a456-426614175001';
      const mockCourier0Id = '123e4567-e89b-12d3-a456-426614175002';
      const mockCourier1Id = '123e4567-e89b-12d3-a456-426614175003';
      const mockZoneId = '123e4567-e89b-12d3-a456-426614175004';

      const createdAuthUsers: Array<{ email: string; password: string; user_metadata?: Record<string, unknown> }> = [];
      const profileUpserts: Array<Record<string, unknown>> = [];
      const courierUpserts: Array<Record<string, unknown>> = [];
      const merchantUpserts: Array<Record<string, unknown>> = [];

      let userCounter = 0;
      const userIds = [mockMerchantId, mockCourier0Id, mockCourier1Id];

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'zones') {
            return {
              select: () => ({
                eq: () => ({
                  limit: vi.fn().mockResolvedValue({ data: [{ id: mockZoneId }], error: null }),
                }),
              }),
            };
          }
          if (table === 'profiles') {
            return {
              upsert: vi.fn(async (payload: Record<string, unknown>) => {
                profileUpserts.push(payload);
                return { error: null };
              }),
            };
          }
          if (table === 'merchants') {
            return {
              upsert: vi.fn(async (payload: Record<string, unknown>) => {
                merchantUpserts.push(payload);
                return { error: null };
              }),
            };
          }
          if (table === 'couriers') {
            return {
              upsert: vi.fn(async (payload: Record<string, unknown>) => {
                courierUpserts.push(payload);
                return { error: null };
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
        auth: {
          admin: {
            createUser: vi.fn(async (payload: { email: string; password: string; user_metadata?: Record<string, unknown> }) => {
              createdAuthUsers.push(payload);
              const uid = userIds[userCounter++] ?? crypto.randomUUID();
              return { data: { user: { id: uid } }, error: null };
            }),
          },
        },
      } as unknown as AdminClientType;

      await seedStagingData(ctx, { withMerchant: true, couriersCount: 2 }, mockClient);

      // Verificación de credenciales en memoria para merchant
      expect(ctx.merchantUser).toBeDefined();
      expect(ctx.merchantUser?.id).toBe(mockMerchantId);
      expect(ctx.merchantUser?.email).toContain('merchant');
      expect(ctx.merchantUser?.password).toMatch(/^P@ssword_/);
      expect(ctx.merchantUser?.role).toBe('merchant');

      // Verificación de credenciales en memoria para 2 couriers
      expect(ctx.courierUsers).toBeDefined();
      expect(ctx.courierUsers).toHaveLength(2);
      const couriers = ctx.courierUsers ?? [];
      const [courier0, courier1] = couriers;
      expect(courier0?.id).toBe(mockCourier0Id);
      expect(courier0?.password).toMatch(/^P@ssword_/);
      expect(courier0?.role).toBe('courier');

      expect(courier1?.id).toBe(mockCourier1Id);
      expect(courier1?.password).toMatch(/^P@ssword_/);
      expect(courier1?.role).toBe('courier');

      // Perfiles creados con consent_status = 'active'
      expect(profileUpserts).toHaveLength(3);
      for (const p of profileUpserts) {
        expect(p.consent_status).toBe('active');
      }

      // Couriers creados con aptitud de oferta: ambos approved y available
      expect(courierUpserts).toHaveLength(2);
      const [courierUp0, courierUp1] = courierUpserts;
      // Courier 0: doc_level 2 (license_status y insurance_status verified)
      expect(courierUp0?.profile_id).toBe(mockCourier0Id);
      expect(courierUp0?.status).toBe('approved');
      expect(courierUp0?.available).toBe(true);
      expect(courierUp0?.license_status).toBe('verified');
      expect(courierUp0?.insurance_status).toBe('verified');

      // Courier 1: doc_level 0 (license_status y insurance_status none)
      expect(courierUp1?.profile_id).toBe(mockCourier1Id);
      expect(courierUp1?.status).toBe('approved');
      expect(courierUp1?.available).toBe(true);
      expect(courierUp1?.license_status).toBe('none');
      expect(courierUp1?.insurance_status).toBe('none');

      // Tracking de los 3 usuarios para cleanup
      expect(ctx.createdUserIds).toEqual([mockMerchantId, mockCourier0Id, mockCourier1Id]);
    });

    it('creación/tracking de request/contact/offers', async () => {
      const ctx = createStagingSeedContext();
      const mockMerchantId = '123e4567-e89b-12d3-a456-426614175011';
      const mockCourier0Id = '123e4567-e89b-12d3-a456-426614175012';
      const mockCourier1Id = '123e4567-e89b-12d3-a456-426614175013';
      const mockZoneId = '123e4567-e89b-12d3-a456-426614175014';
      const mockReqId = '123e4567-e89b-12d3-a456-426614175015';

      const contactInserts: Array<Record<string, unknown>> = [];
      const offerInserts: Array<Record<string, unknown>> = [];

      let userCounter = 0;
      const userIds = [mockMerchantId, mockCourier0Id, mockCourier1Id];

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'zones') {
            return {
              select: () => ({
                eq: () => ({
                  limit: vi.fn().mockResolvedValue({ data: [{ id: mockZoneId }], error: null }),
                }),
              }),
            };
          }
          if (table === 'profiles' || table === 'merchants' || table === 'couriers') {
            return { upsert: vi.fn().mockResolvedValue({ error: null }) };
          }
          if (table === 'delivery_requests') {
            return {
              insert: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: { id: mockReqId }, error: null }),
                })),
              })),
            };
          }
          if (table === 'delivery_request_contacts') {
            return {
              insert: vi.fn(async (payload: Record<string, unknown>) => {
                contactInserts.push(payload);
                return { error: null };
              }),
            };
          }
          if (table === 'offers') {
            return {
              insert: vi.fn(async (payload: Record<string, unknown>) => {
                offerInserts.push(payload);
                return { error: null };
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
        auth: {
          admin: {
            createUser: vi.fn(async () => {
              const uid = userIds[userCounter++] ?? crypto.randomUUID();
              return { data: { user: { id: uid } }, error: null };
            }),
          },
        },
      } as unknown as AdminClientType;

      await seedStagingData(
        ctx,
        {
          requestsCount: 1,
          couriersCount: 2,
          withContacts: true,
          recipientPhone: '+5493865123456',
          recipientName: 'Juan Pérez Test',
          createOffersForFirstRequest: true,
        },
        mockClient
      );

      // Verificación de tracking de request
      expect(ctx.createdRequestIds).toContain(mockReqId);

      // Verificación de inserción y tracking de contacto
      expect(contactInserts).toHaveLength(1);
      const [contact0] = contactInserts;
      expect(contact0?.request_id).toBe(mockReqId);
      expect(contact0?.recipient_phone).toBe('+5493865123456');
      expect(contact0?.recipient_name).toBe('Juan Pérez Test');
      expect(contact0?.recipient_consent_declared).toBe(true);
      expect(ctx.createdContactRequestIds).toContain(mockReqId);

      // Verificación de inserción y tracking de 2 ofertas reales
      expect(offerInserts).toHaveLength(2);
      const [offer0, offer1] = offerInserts;
      expect(offer0?.request_id).toBe(mockReqId);
      expect(offer0?.courier_id).toBe(mockCourier0Id);
      expect(offer0?.amount_ars).toBe(2000);

      expect(offer1?.request_id).toBe(mockReqId);
      expect(offer1?.courier_id).toBe(mockCourier1Id);
      expect(offer1?.amount_ars).toBe(1500);

      expect(ctx.createdOfferIds).toHaveLength(2);
      const [offId0, offId1] = ctx.createdOfferIds;
      expect(isValidUuid(offId0)).toBe(true);
      expect(isValidUuid(offId1)).toBe(true);
    });

    it('cleanup de todos esos tipos en orden relacional inverso', async () => {
      const orderOfOperations: string[] = [];

      const ctx: StagingSeedContext = {
        testRunId: 'e2e_run_order_test',
        createdOfferIds: ['123e4567-e89b-12d3-a456-426614175021'],
        createdContactRequestIds: ['123e4567-e89b-12d3-a456-426614175022'],
        createdRequestIds: ['123e4567-e89b-12d3-a456-426614175022'],
        createdUserIds: ['123e4567-e89b-12d3-a456-426614175023', '123e4567-e89b-12d3-a456-426614175024'],
        createdZoneIds: ['123e4567-e89b-12d3-a456-426614175025'],
        courierUsers: [],
      };

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'delivery_requests') {
            return {
              update: vi.fn(() => {
                orderOfOperations.push('delivery_requests.update_accepted_offer');
                return { in: vi.fn().mockResolvedValue({ error: null }) };
              }),
              delete: vi.fn(() => {
                orderOfOperations.push('delivery_requests.delete');
                return { in: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'offers') {
            return {
              delete: vi.fn(() => {
                orderOfOperations.push('offers.delete');
                return { in: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'delivery_request_contacts') {
            return {
              delete: vi.fn(() => {
                orderOfOperations.push('delivery_request_contacts.delete');
                return { in: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'couriers') {
            return {
              delete: vi.fn(() => {
                orderOfOperations.push('couriers.delete');
                return { in: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'merchants') {
            return {
              delete: vi.fn(() => {
                orderOfOperations.push('merchants.delete');
                return { in: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'profiles') {
            return {
              delete: vi.fn(() => {
                orderOfOperations.push('profiles.delete');
                return { in: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'zones') {
            return {
              delete: vi.fn(() => {
                orderOfOperations.push('zones.delete');
                return { in: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
        auth: {
          admin: {
            deleteUser: vi.fn(async () => {
              orderOfOperations.push('auth.users.deleteUser');
              return { error: null };
            }),
          },
        },
      } as unknown as AdminClientType;

      await cleanupStagingData(ctx, mockClient);

      // Verificación estricta del orden relacional inverso:
      // 0. desvincular accepted_offer_id en delivery_requests
      // 1. offers
      // 2. delivery_request_contacts
      // 3. delivery_requests
      // 4. couriers -> merchants -> profiles
      // 5. zones
      // 6. auth users
      expect(orderOfOperations).toEqual([
        'delivery_requests.update_accepted_offer',
        'offers.delete',
        'delivery_request_contacts.delete',
        'delivery_requests.delete',
        'couriers.delete',
        'merchants.delete',
        'profiles.delete',
        'zones.delete',
        'auth.users.deleteUser',
        'auth.users.deleteUser',
      ]);

      // Todo el tracking quedó vaciado
      expect(ctx.createdOfferIds).toHaveLength(0);
      expect(ctx.createdContactRequestIds).toHaveLength(0);
      expect(ctx.createdRequestIds).toHaveLength(0);
      expect(ctx.createdUserIds).toHaveLength(0);
      expect(ctx.createdZoneIds).toHaveLength(0);
    });

    it('error de una etapa conserva el ID fallido y no impide intentar el resto', async () => {
      const failedOfferId = '123e4567-e89b-12d3-a456-426614175031';
      const cleanContactReqId = '123e4567-e89b-12d3-a456-426614175032';
      const cleanRequestId = '123e4567-e89b-12d3-a456-426614175032';
      const cleanUserId = '123e4567-e89b-12d3-a456-426614175033';

      const ctx: StagingSeedContext = {
        testRunId: 'e2e_run_partial_failure',
        createdOfferIds: [failedOfferId],
        createdContactRequestIds: [cleanContactReqId],
        createdRequestIds: [cleanRequestId],
        createdUserIds: [cleanUserId],
        createdZoneIds: [],
        courierUsers: [],
      };

      const attemptedStages: string[] = [];

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'offers') {
            return {
              delete: vi.fn(() => {
                attemptedStages.push('offers');
                // Falla con error
                return { in: vi.fn().mockResolvedValue({ error: { message: 'Offers delete timeout' } }) };
              }),
            };
          }
          if (table === 'delivery_request_contacts') {
            return {
              delete: vi.fn(() => {
                attemptedStages.push('delivery_request_contacts');
                return { in: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'delivery_requests') {
            return {
              update: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ error: null }) })),
              delete: vi.fn(() => {
                attemptedStages.push('delivery_requests');
                return { in: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'couriers' || table === 'merchants' || table === 'profiles') {
            return {
              delete: vi.fn(() => {
                attemptedStages.push(table);
                return { in: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
        auth: {
          admin: {
            deleteUser: vi.fn(async () => {
              attemptedStages.push('auth.users');
              return { error: null };
            }),
          },
        },
      } as unknown as AdminClientType;

      // Debe lanzar [E2E Cleanup Error] agregado
      await expect(cleanupStagingData(ctx, mockClient)).rejects.toThrow(
        /\[E2E Cleanup Error\] Falló la limpieza de staging: offers/i
      );

      // El fallo en offers no impidió intentar las etapas posteriores
      expect(attemptedStages).toContain('offers');
      expect(attemptedStages).toContain('delivery_request_contacts');
      expect(attemptedStages).toContain('delivery_requests');
      expect(attemptedStages).toContain('auth.users');

      // El ID fallido de offers se conserva en el tracking para reintento
      expect(ctx.createdOfferIds).toEqual([failedOfferId]);

      // Los exitosos fueron eliminados del tracking
      expect(ctx.createdContactRequestIds).toHaveLength(0);
      expect(ctx.createdRequestIds).toHaveLength(0);
      expect(ctx.createdUserIds).toHaveLength(0);
    });

    it('guard fail-closed sigue bloqueando prod/proyecto desconocido', () => {
      // Bloqueo incondicional de producción conocida
      expect(() => {
        assertAllowedE2EEnvironment({
          VERCEL_ENV: 'production',
          NEXT_PUBLIC_SUPABASE_URL: 'https://axwvmyqwhwfghyjdufny.supabase.co',
        });
      }).toThrow(/VERCEL_ENV es production/i);

      expect(() => {
        assertAllowedE2EEnvironment({
          APP_ENV: 'production',
          NEXT_PUBLIC_SUPABASE_URL: 'https://axwvmyqwhwfghyjdufny.supabase.co',
        });
      }).toThrow(/APP_ENV es production/i);

      expect(() => {
        assertAllowedE2EEnvironment({
          NEXT_PUBLIC_APP_URL: 'https://cadeapp.com',
          NEXT_PUBLIC_SUPABASE_URL: 'https://axwvmyqwhwfghyjdufny.supabase.co',
        });
      }).toThrow(/dominio de producción/i);

      // Bloqueo de proyecto no verificado / desconocido
      expect(() => {
        assertAllowedE2EEnvironment({
          NODE_ENV: 'test',
          E2E_TEST: 'true',
          NEXT_PUBLIC_SUPABASE_URL: 'https://proyecto-desconocido-123.supabase.co',
        });
      }).toThrow(/no está positivamente identificado como staging/i);
    });

    describe('seedOffersForFirstRequest', () => {
      it('crea 2 ofertas reales para la primera solicitud y las registra en el contexto', async () => {
        const ctx = createStagingSeedContext();
        const mockReqId = '123e4567-e89b-12d3-a456-426614176001';
        const mockCourier0Id = '123e4567-e89b-12d3-a456-426614176002';
        const mockCourier1Id = '123e4567-e89b-12d3-a456-426614176003';

        ctx.createdRequestIds.push(mockReqId);
        ctx.courierUsers = [
          {
            id: mockCourier0Id,
            email: 'courier0@test.com',
            password: 'pwd',
            role: 'courier',
          },
          {
            id: mockCourier1Id,
            email: 'courier1@test.com',
            password: 'pwd',
            role: 'courier',
          },
        ];

        const insertedOffers: Array<Record<string, unknown>> = [];

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'offers') {
              return {
                insert: vi.fn(async (payload: Record<string, unknown>) => {
                  insertedOffers.push(payload);
                  return { error: null };
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        await seedOffersForFirstRequest(ctx, mockClient);

        expect(insertedOffers).toHaveLength(2);
        const [off0, off1] = insertedOffers;
        expect(off0?.request_id).toBe(mockReqId);
        expect(off0?.courier_id).toBe(mockCourier0Id);
        expect(off0?.amount_ars).toBe(2000);
        expect(off0?.status).toBe('pending');

        expect(off1?.request_id).toBe(mockReqId);
        expect(off1?.courier_id).toBe(mockCourier1Id);
        expect(off1?.amount_ars).toBe(1500);
        expect(off1?.status).toBe('pending');

        expect(ctx.createdOfferIds).toHaveLength(2);
        const [id0, id1] = ctx.createdOfferIds;
        expect(isValidUuid(id0)).toBe(true);
        expect(isValidUuid(id1)).toBe(true);
      });

      it('falla si no hay solicitudes o couriers suficientes', async () => {
        const ctxEmpty = createStagingSeedContext();
        await expect(seedOffersForFirstRequest(ctxEmpty)).rejects.toThrow(
          /No hay solicitudes creadas/i
        );

        ctxEmpty.createdRequestIds.push('123e4567-e89b-12d3-a456-426614176001');
        await expect(seedOffersForFirstRequest(ctxEmpty)).rejects.toThrow(
          /Se requieren al menos 2 repartidores/i
        );
      });
    });

    describe('getRequestInspectionData', () => {
      it('consulta el estado final acotado a los IDs del contexto', async () => {
        const ctx = createStagingSeedContext();
        const mockReqId = '123e4567-e89b-12d3-a456-426614176010';
        const mockOfferId = '123e4567-e89b-12d3-a456-426614176011';
        ctx.createdRequestIds.push(mockReqId);

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'delivery_requests') {
              return {
                select: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: mockReqId,
                        status: 'matched',
                        accepted_offer_id: mockOfferId,
                      },
                      error: null,
                    }),
                  })),
                })),
              };
            }
            if (table === 'offers') {
              return {
                select: vi.fn(() => ({
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: mockOfferId,
                        status: 'accepted',
                        courier_id: '123e4567-e89b-12d3-a456-426614176012',
                        amount_ars: 2000,
                      },
                    ],
                    error: null,
                  }),
                })),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        const result = await getRequestInspectionData(ctx, mockReqId, mockClient);
        expect(result.requestId).toBe(mockReqId);
        expect(result.requestStatus).toBe('matched');
        expect(result.acceptedOfferId).toBe(mockOfferId);
        expect(result.offers).toHaveLength(1);
        const [firstOffer] = result.offers;
        expect(firstOffer?.id).toBe(mockOfferId);
        expect(firstOffer?.status).toBe('accepted');
      });

      it('rechaza consultas de solicitudes no pertenecientes a la corrida (fail-closed)', async () => {
        const ctx = createStagingSeedContext();
        const foreignReqId = '123e4567-e89b-12d3-a456-426614176099';

        await expect(getRequestInspectionData(ctx, foreignReqId)).rejects.toThrow(
          /no pertenece a la corrida/i
        );
      });
    });

    describe('PR160-R02: Cleanup con descubrimiento dinámico de entidades creadas por UI', () => {
      it('descubre y borra en orden relacional una solicitud y oferta creadas por la UI que no estaban en el seed inicial', async () => {
        const seededReqId = '123e4567-e89b-12d3-a456-426614177001';
        const uiReqId = '123e4567-e89b-12d3-a456-426614177002';
        const seededOfferId = '123e4567-e89b-12d3-a456-426614177003';
        const uiOfferId = '123e4567-e89b-12d3-a456-426614177004';
        const mockMerchantId = '123e4567-e89b-12d3-a456-426614177005';

        const ctx: StagingSeedContext = {
          testRunId: 'e2e_run_ui_discovery',
          createdRequestIds: [seededReqId],
          createdOfferIds: [seededOfferId],
          createdUserIds: [mockMerchantId],
          createdZoneIds: [],
          createdContactRequestIds: [seededReqId],
          merchantUser: {
            id: mockMerchantId,
            email: 'merch@test.com',
            password: 'pwd',
            role: 'merchant',
          },
          courierUsers: [],
        };

        const deletedEntities: Record<string, string[]> = {};
        const unlinkedRequestIds: string[] = [];
        const orderOfOps: string[] = [];

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'delivery_requests') {
              return {
                select: vi.fn(() => ({
                  eq: vi.fn().mockResolvedValue({
                    // Descubre ambas requests (la del seed y la creada por UI)
                    data: [{ id: seededReqId }, { id: uiReqId }],
                    error: null,
                  }),
                })),
                update: vi.fn(() => {
                  orderOfOps.push('delivery_requests.unlink');
                  return {
                    in: vi.fn(async (_col: string, ids: string[]) => {
                      for (const id of ids) unlinkedRequestIds.push(id);
                      return { error: null };
                    }),
                  };
                }),
                delete: vi.fn(() => {
                  orderOfOps.push('delivery_requests.delete');
                  return {
                    in: vi.fn(async (_col: string, ids: string[]) => {
                      deletedEntities.delivery_requests = ids;
                      return { error: null };
                    }),
                  };
                }),
              };
            }
            if (table === 'offers') {
              return {
                select: vi.fn(() => ({
                  in: vi.fn().mockResolvedValue({
                    // Descubre ambas ofertas
                    data: [{ id: seededOfferId }, { id: uiOfferId }],
                    error: null,
                  }),
                })),
                delete: vi.fn(() => {
                  orderOfOps.push('offers.delete');
                  return {
                    in: vi.fn(async (_col: string, ids: string[]) => {
                      deletedEntities.offers = ids;
                      return { error: null };
                    }),
                  };
                }),
              };
            }
            if (table === 'delivery_request_contacts') {
              return {
                select: vi.fn(() => ({
                  in: vi.fn().mockResolvedValue({
                    data: [{ request_id: seededReqId }, { request_id: uiReqId }],
                    error: null,
                  }),
                })),
                delete: vi.fn(() => {
                  orderOfOps.push('delivery_request_contacts.delete');
                  return {
                    in: vi.fn(async (_col: string, ids: string[]) => {
                      deletedEntities.delivery_request_contacts = ids;
                      return { error: null };
                    }),
                  };
                }),
              };
            }
            if (table === 'couriers' || table === 'merchants' || table === 'profiles') {
              return {
                delete: vi.fn(() => {
                  orderOfOps.push(`${table}.delete`);
                  return {
                    in: vi.fn(async (_col: string, ids: string[]) => {
                      deletedEntities[table] = ids;
                      return { error: null };
                    }),
                  };
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
          auth: {
            admin: {
              deleteUser: vi.fn(async (userId: string) => {
                orderOfOps.push('auth.users.deleteUser');
                deletedEntities['auth.users'] = [userId];
                return { error: null };
              }),
            },
          },
        } as unknown as AdminClientType;

        await cleanupStagingData(ctx, mockClient);

        // Verifica que la solicitud de UI fue descubierta y desvinculada
        expect(unlinkedRequestIds).toContain(seededReqId);
        expect(unlinkedRequestIds).toContain(uiReqId);

        // Verifica que ambas ofertas fueron eliminadas
        expect(deletedEntities.offers).toEqual(expect.arrayContaining([seededOfferId, uiOfferId]));

        // Verifica que ambos contactos fueron eliminados
        expect(deletedEntities.delivery_request_contacts).toEqual(expect.arrayContaining([seededReqId, uiReqId]));

        // Verifica que ambas requests fueron eliminadas ANTES del merchant/profile/auth
        expect(deletedEntities.delivery_requests).toEqual(expect.arrayContaining([seededReqId, uiReqId]));
        expect(orderOfOps.indexOf('delivery_requests.delete')).toBeLessThan(orderOfOps.indexOf('merchants.delete'));
        expect(orderOfOps.indexOf('merchants.delete')).toBeLessThan(orderOfOps.indexOf('auth.users.deleteUser'));

        // Todo el tracking queda limpio
        expect(ctx.createdRequestIds).toHaveLength(0);
        expect(ctx.createdOfferIds).toHaveLength(0);
        expect(ctx.createdUserIds).toHaveLength(0);
      });

      it('error en discovery o delete preserva los IDs fallidos y reporta error agregado', async () => {
        const seededReqId = '123e4567-e89b-12d3-a456-426614177011';
        const mockMerchantId = '123e4567-e89b-12d3-a456-426614177012';

        const ctx: StagingSeedContext = {
          testRunId: 'e2e_run_discovery_error',
          createdRequestIds: [seededReqId],
          createdOfferIds: [],
          createdUserIds: [mockMerchantId],
          createdZoneIds: [],
          merchantUser: {
            id: mockMerchantId,
            email: 'm@test.com',
            password: 'pwd',
            role: 'merchant',
          },
        };

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'delivery_requests') {
              return {
                select: vi.fn(() => ({
                  eq: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database discovery timeout' },
                  }),
                })),
                update: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ error: null }) })),
                delete: vi.fn(() => ({
                  in: vi.fn().mockResolvedValue({ error: { message: 'FK delete failure' } }),
                })),
              };
            }
            if (table === 'offers' || table === 'delivery_request_contacts') {
              return {
                select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) })),
                delete: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ error: null }) })),
              };
            }
            if (table === 'merchants' || table === 'profiles') {
              return {
                delete: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ error: null }) })),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
          auth: {
            admin: {
              deleteUser: vi.fn().mockResolvedValue({ error: null }),
            },
          },
        } as unknown as AdminClientType;

        await expect(cleanupStagingData(ctx, mockClient)).rejects.toThrow(
          /\[E2E Cleanup Error\] Falló la limpieza de staging: discovery\.delivery_requests.*FK delete failure/i
        );

        // El ID de request que falló en el delete se conserva en el tracking
        expect(ctx.createdRequestIds).toContain(seededReqId);
      });

      it('error en unlink de accepted_offer_id es incluido en el error agregado', async () => {
        const seededReqId = '123e4567-e89b-12d3-a456-426614177021';
        const ctx: StagingSeedContext = {
          testRunId: 'e2e_run_unlink_error',
          createdRequestIds: [seededReqId],
          createdOfferIds: [],
          createdUserIds: [],
          createdZoneIds: [],
        };

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'delivery_requests') {
              return {
                update: vi.fn(() => ({
                  in: vi.fn().mockResolvedValue({ error: { message: 'Unlink constraint lock' } }),
                })),
                delete: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ error: null }) })),
              };
            }
            if (table === 'offers' || table === 'delivery_request_contacts') {
              return {
                select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) })),
                delete: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ error: null }) })),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        await expect(cleanupStagingData(ctx, mockClient)).rejects.toThrow(
          /\[E2E Cleanup Error\] Falló la limpieza de staging: delivery_requests\.unlink_accepted_offer.*Unlink constraint lock/i
        );
      });
    });

    describe('findRequestIdByNotesMarker (PR160-H08)', () => {
      const mockMerchantId = '123e4567-e89b-12d3-a456-426614174001';
      const mockRequestId = '123e4567-e89b-12d3-a456-426614174002';

      it('falla cerrado si falta context.merchantUser', async () => {
        const ctx = createStagingSeedContext();
        await expect(findRequestIdByNotesMarker(ctx, 'marker-123')).rejects.toThrow(
          /Se requiere context\.merchantUser/i
        );
      });

      it('exactamente 1 resultado → devuelve y trackea el ID', async () => {
        const ctx = createStagingSeedContext();
        ctx.merchantUser = {
          id: mockMerchantId,
          email: 'merchant@test.local',
          password: 'pass',
          role: 'merchant',
        };

        const mockClient = {
          from: vi.fn((table: string) => {
            expect(table).toBe('delivery_requests');
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn((field1: string, val1: string) => {
                  expect(field1).toBe('merchant_id');
                  expect(val1).toBe(mockMerchantId);
                  return {
                    eq: vi.fn((field2: string, val2: string) => {
                      expect(field2).toBe('notes');
                      expect(val2).toBe('marker-exact-456');
                      return Promise.resolve({
                        data: [{ id: mockRequestId }],
                        error: null,
                      });
                    }),
                  };
                }),
              }),
            };
          }),
        } as unknown as AdminClientType;

        const foundId = await findRequestIdByNotesMarker(ctx, 'marker-exact-456', mockClient);
        expect(foundId).toBe(mockRequestId);
        expect(ctx.createdRequestIds).toContain(mockRequestId);
      });

      it('0 resultados → falla cerrado con error explícito', async () => {
        const ctx = createStagingSeedContext();
        ctx.merchantUser = {
          id: mockMerchantId,
          email: 'merchant@test.local',
          password: 'pass',
          role: 'merchant',
        };

        const mockClient = {
          from: vi.fn(() => ({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          })),
        } as unknown as AdminClientType;

        await expect(
          findRequestIdByNotesMarker(ctx, 'marker-inexistente', mockClient)
        ).rejects.toThrow(/No se encontró ninguna solicitud para el marcador de notas/i);
      });

      it('más de 1 resultado → falla cerrado', async () => {
        const ctx = createStagingSeedContext();
        ctx.merchantUser = {
          id: mockMerchantId,
          email: 'merchant@test.local',
          password: 'pass',
          role: 'merchant',
        };

        const mockClient = {
          from: vi.fn(() => ({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    { id: '123e4567-e89b-12d3-a456-426614174002' },
                    { id: '123e4567-e89b-12d3-a456-426614174003' },
                  ],
                  error: null,
                }),
              }),
            }),
          })),
        } as unknown as AdminClientType;

        await expect(
          findRequestIdByNotesMarker(ctx, 'marker-duplicado', mockClient)
        ).rejects.toThrow(/Se encontraron múltiples solicitudes \(2\)/i);
      });

      it('error retornado por Supabase → falla cerrado', async () => {
        const ctx = createStagingSeedContext();
        ctx.merchantUser = {
          id: mockMerchantId,
          email: 'merchant@test.local',
          password: 'pass',
          role: 'merchant',
        };

        const mockClient = {
          from: vi.fn(() => ({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database connection terminated' },
                }),
              }),
            }),
          })),
        } as unknown as AdminClientType;

        await expect(
          findRequestIdByNotesMarker(ctx, 'marker-db-error', mockClient)
        ).rejects.toThrow(/Error al consultar delivery_requests por notas: Database connection terminated/i);
      });
    });

    describe('PR160-R03: Limpieza de rate_limits y audit_log', () => {
      const mockUserId = '123e4567-e89b-12d3-a456-426614175001';
      const mockRequestId = '123e4567-e89b-12d3-a456-426614175002';

      it('se eliminan rate limits usando filtro subject con los user IDs de la corrida', async () => {
        const ctx = createStagingSeedContext();
        ctx.createdUserIds = [mockUserId];
        ctx.createdRequestIds = [mockRequestId];

        const rateLimitDeletedSubjects: string[][] = [];
        const auditDeletedActors: string[][] = [];
        const auditDeletedTargets: { type?: string; ids?: string[] } = {};

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'rate_limits') {
              return {
                delete: vi.fn().mockReturnValue({
                  in: vi.fn((col: string, values: string[]) => {
                    expect(col).toBe('subject');
                    rateLimitDeletedSubjects.push(values);
                    return Promise.resolve({ error: null });
                  }),
                }),
              };
            }
            if (table === 'audit_log') {
              return {
                delete: vi.fn().mockReturnValue({
                  in: vi.fn((col: string, values: string[]) => {
                    expect(col).toBe('actor_id');
                    auditDeletedActors.push(values);
                    return Promise.resolve({ error: null });
                  }),
                  eq: vi.fn((col: string, val: string) => {
                    expect(col).toBe('target_type');
                    auditDeletedTargets.type = val;
                    return {
                      in: vi.fn((targetCol: string, targetValues: string[]) => {
                        expect(targetCol).toBe('target_id');
                        auditDeletedTargets.ids = targetValues;
                        return Promise.resolve({ error: null });
                      }),
                    };
                  }),
                }),
              };
            }
            if (table === 'delivery_requests' || table === 'offers' || table === 'delivery_request_contacts') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }),
                  in: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
                update: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ error: null }),
                }),
                delete: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ error: null }),
                }),
              };
            }
            if (table === 'couriers' || table === 'merchants' || table === 'profiles' || table === 'zones') {
              return {
                delete: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ error: null }),
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
          auth: {
            admin: {
              deleteUser: vi.fn().mockResolvedValue({ error: null }),
            },
          },
        } as unknown as AdminClientType;

        await cleanupStagingData(ctx, mockClient);

        // Verifica que se llamó delete en rate_limits solo con los user IDs de la corrida
        expect(rateLimitDeletedSubjects).toHaveLength(1);
        expect(rateLimitDeletedSubjects[0]).toEqual([mockUserId]);

        // Verifica que se llamó delete en audit_log por actor_id solo con los user IDs de la corrida
        expect(auditDeletedActors).toHaveLength(1);
        expect(auditDeletedActors[0]).toEqual([mockUserId]);

        // Verifica que se llamó delete en audit_log por target_type 'delivery_request' y target_id de la corrida
        expect(auditDeletedTargets.type).toBe('delivery_request');
        expect(auditDeletedTargets.ids).toEqual([mockRequestId]);
      });

      it('los filtros usados en rate_limits y audit_log no abarcan user/request IDs ajenos', async () => {
        const ctx = createStagingSeedContext();
        const ownUserId = '123e4567-e89b-12d3-a456-426614175010';
        const ownRequestId = '123e4567-e89b-12d3-a456-426614175020';
        const alienUserId = '999e4567-e89b-12d3-a456-426614175099';
        const alienRequestId = '888e4567-e89b-12d3-a456-426614175088';

        ctx.createdUserIds = [ownUserId];
        ctx.createdRequestIds = [ownRequestId];

        let checkedRateLimitFilter = false;
        let checkedAuditActorFilter = false;
        let checkedAuditTargetFilter = false;

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'rate_limits') {
              return {
                delete: vi.fn().mockReturnValue({
                  in: vi.fn((_col: string, values: string[]) => {
                    expect(values).toContain(ownUserId);
                    expect(values).not.toContain(alienUserId);
                    checkedRateLimitFilter = true;
                    return Promise.resolve({ error: null });
                  }),
                }),
              };
            }
            if (table === 'audit_log') {
              return {
                delete: vi.fn().mockReturnValue({
                  in: vi.fn((_col: string, values: string[]) => {
                    expect(values).toContain(ownUserId);
                    expect(values).not.toContain(alienUserId);
                    checkedAuditActorFilter = true;
                    return Promise.resolve({ error: null });
                  }),
                  eq: vi.fn((_col: string, _val: string) => ({
                    in: vi.fn((_targetCol: string, targetValues: string[]) => {
                      expect(targetValues).toContain(ownRequestId);
                      expect(targetValues).not.toContain(alienRequestId);
                      checkedAuditTargetFilter = true;
                      return Promise.resolve({ error: null });
                    }),
                  })),
                }),
              };
            }
            if (table === 'delivery_requests' || table === 'offers' || table === 'delivery_request_contacts') {
              return {
                select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }),
                update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
                delete: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
              };
            }
            if (table === 'couriers' || table === 'merchants' || table === 'profiles' || table === 'zones') {
              return {
                delete: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
          auth: {
            admin: {
              deleteUser: vi.fn().mockResolvedValue({ error: null }),
            },
          },
        } as unknown as AdminClientType;

        await cleanupStagingData(ctx, mockClient);

        expect(checkedRateLimitFilter).toBe(true);
        expect(checkedAuditActorFilter).toBe(true);
        expect(checkedAuditTargetFilter).toBe(true);
      });

      it('error en rate_limits queda registrado en el error agregado y el resto del cleanup continúa', async () => {
        const ctx = createStagingSeedContext();
        ctx.createdUserIds = [mockUserId];

        let profileDeleted = false;
        let authUserDeleted = false;

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'rate_limits') {
              return {
                delete: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ error: { message: 'Rate limits table lock' } }),
                }),
              };
            }
            if (table === 'audit_log') {
              return {
                delete: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ error: null }),
                  eq: vi.fn().mockReturnValue({
                    in: vi.fn().mockResolvedValue({ error: null }),
                  }),
                }),
              };
            }
            if (table === 'delivery_requests' || table === 'offers' || table === 'delivery_request_contacts') {
              return {
                select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }),
                update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
                delete: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
              };
            }
            if (table === 'couriers' || table === 'merchants') {
              return {
                delete: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
              };
            }
            if (table === 'profiles') {
              return {
                delete: vi.fn().mockImplementation(() => {
                  profileDeleted = true;
                  return { in: vi.fn().mockResolvedValue({ error: null }) };
                }),
              };
            }
            if (table === 'zones') {
              return {
                delete: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
          auth: {
            admin: {
              deleteUser: vi.fn().mockImplementation(() => {
                authUserDeleted = true;
                return Promise.resolve({ error: null });
              }),
            },
          },
        } as unknown as AdminClientType;

        await expect(cleanupStagingData(ctx, mockClient)).rejects.toThrow(
          /\[E2E Cleanup Error\] Falló la limpieza de staging: rate_limits.*Rate limits table lock/i
        );

        // El resto del cleanup debe haber continuado a pesar del fallo en rate_limits
        expect(profileDeleted).toBe(true);
        expect(authUserDeleted).toBe(true);
      });

      it('error en audit_log queda registrado en el error agregado y el resto del cleanup continúa', async () => {
        const ctx = createStagingSeedContext();
        ctx.createdUserIds = [mockUserId];

        let profileDeleted = false;
        let authUserDeleted = false;

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'rate_limits') {
              return {
                delete: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ error: null }),
                }),
              };
            }
            if (table === 'audit_log') {
              return {
                delete: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ error: { message: 'Audit log read-only mode' } }),
                  eq: vi.fn().mockReturnValue({
                    in: vi.fn().mockResolvedValue({ error: null }),
                  }),
                }),
              };
            }
            if (table === 'delivery_requests' || table === 'offers' || table === 'delivery_request_contacts') {
              return {
                select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }),
                update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
                delete: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
              };
            }
            if (table === 'couriers' || table === 'merchants') {
              return {
                delete: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
              };
            }
            if (table === 'profiles') {
              return {
                delete: vi.fn().mockImplementation(() => {
                  profileDeleted = true;
                  return { in: vi.fn().mockResolvedValue({ error: null }) };
                }),
              };
            }
            if (table === 'zones') {
              return {
                delete: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
          auth: {
            admin: {
              deleteUser: vi.fn().mockImplementation(() => {
                authUserDeleted = true;
                return Promise.resolve({ error: null });
              }),
            },
          },
        } as unknown as AdminClientType;

        await expect(cleanupStagingData(ctx, mockClient)).rejects.toThrow(
          /\[E2E Cleanup Error\] Falló la limpieza de staging: audit_log\.actor.*Audit log read-only mode/i
        );

        // El resto del cleanup debe haber continuado a pesar del fallo en audit_log
        expect(profileDeleted).toBe(true);
        expect(authUserDeleted).toBe(true);
      });
    });
  });

  describe('T-304: Extensiones de seed, autenticación, MFA y estados para E2E real', () => {
    const validEnv = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://axwvmyqwhwfghyjdufny.supabase.co',
      E2E_TEST: 'true',
    };

    describe('base32Decode y generateTotp (RFC 6238)', () => {
      it('decodifica correctamente base32 y maneja caracteres inválidos', () => {
        const decoded = base32Decode('JBSWY3DPEHPK3PXP');
        expect(decoded.toString('latin1')).toBe('Hello!\xde\xad\xbe\xef');

        expect(() => base32Decode('INVALID_CHAR_89!')).toThrow(/Carácter base32 inválido/i);
      });

      it('genera código TOTP de 6 dígitos numéricos determinístico', () => {
        const fixedTimeMs = 1700000000000;
        const code1 = generateTotp('JBSWY3DPEHPK3PXP', fixedTimeMs);
        const code2 = generateTotp('JBSWY3DPEHPK3PXP', fixedTimeMs);

        expect(code1).toMatch(/^\d{6}$/);
        expect(code1).toBe(code2);
      });
    });

    describe('trackEntityForCleanup para incidentes', () => {
      it('registra incidentes con UUIDs válidos y rechaza inválidos', () => {
        const ctx = createStagingSeedContext();
        const validIncidentId = '11111111-2222-3333-4444-555555555555';

        trackEntityForCleanup(ctx, 'incident', validIncidentId);
        expect(ctx.createdIncidentIds).toContain(validIncidentId);

        expect(() => trackEntityForCleanup(ctx, 'incident', 'invalid-id')).toThrow(
          /UUID válido/i
        );
      });
    });

    describe('Limpieza de incidents (H11)', () => {
      it('consulta incidents para request_ids creados y agrega los IDs descubiertos a createdIncidentIds', async () => {
        const ctx = createStagingSeedContext();
        const reqId = '11111111-1111-4111-8111-111111111111';
        const incId = '22222222-2222-4222-8222-222222222222';
        ctx.createdRequestIds = [reqId];

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'incidents') {
              return {
                select: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: [{ id: incId }],
                    error: null,
                  }),
                }),
                delete: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ error: null }),
                }),
              };
            }
            if (table === 'delivery_requests') {
              return {
                delete: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ error: null }),
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        await cleanupStagingData(ctx, mockClient, validEnv);
        expect(mockClient.from).toHaveBeenCalledWith('incidents');
      });

      it('ejecuta delete() sobre incidents antes de delivery_requests', async () => {
        const ctx = createStagingSeedContext();
        const reqId = '11111111-1111-4111-8111-111111111111';
        const incId = '22222222-2222-4222-8222-222222222222';
        ctx.createdRequestIds = [reqId];
        ctx.createdIncidentIds = [incId];

        const callOrder: string[] = [];

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'incidents') {
              return {
                select: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
                delete: vi.fn().mockReturnValue({
                  in: vi.fn().mockImplementation(() => {
                    callOrder.push('incidents.delete');
                    return Promise.resolve({ error: null });
                  }),
                }),
              };
            }
            if (table === 'delivery_requests') {
              return {
                delete: vi.fn().mockReturnValue({
                  in: vi.fn().mockImplementation(() => {
                    callOrder.push('delivery_requests.delete');
                    return Promise.resolve({ error: null });
                  }),
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        await cleanupStagingData(ctx, mockClient, validEnv);
        expect(callOrder).toEqual(['incidents.delete', 'delivery_requests.delete']);
        expect(ctx.createdIncidentIds).toHaveLength(0);
        expect(ctx.createdRequestIds).toHaveLength(0);
      });

      it('si el delete de incidents falla, conserva los IDs en createdIncidentIds y reporta cleanupErrors', async () => {
        const ctx = createStagingSeedContext();
        const incId = '22222222-2222-4222-8222-222222222222';
        ctx.createdIncidentIds = [incId];

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'incidents') {
              return {
                delete: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ error: { message: 'FK violation or DB error' } }),
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        await expect(cleanupStagingData(ctx, mockClient, validEnv)).rejects.toThrow(
          /\[E2E Cleanup Error\] Falló la limpieza de staging: incidents.*FK violation or DB error/i
        );
        expect(ctx.createdIncidentIds).toContain(incId);
      });

      it('no intenta delete() sobre incidents si no hay ninguno registrado ni descubierto', async () => {
        const ctx = createStagingSeedContext();
        let incidentsDeleteCalled = false;

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'incidents') {
              return {
                delete: vi.fn().mockImplementation(() => {
                  incidentsDeleteCalled = true;
                  return { in: vi.fn().mockResolvedValue({ error: null }) };
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        await cleanupStagingData(ctx, mockClient, validEnv);
        expect(incidentsDeleteCalled).toBe(false);
      });
    });

    describe('seedAdminUser (H12)', () => {
      it('crea usuario administrador en auth y profiles con bootstrap legítimo y tracking', async () => {
        const ctx = createStagingSeedContext();
        const mockAdminId = '99999999-8888-7777-6666-555555555555';

        const createUserMock = vi.fn().mockResolvedValue({
          data: { user: { id: mockAdminId } },
          error: null,
        });
        const updateUserByIdMock = vi.fn().mockResolvedValue({
          data: { user: { id: mockAdminId } },
          error: null,
        });

        const merchantsDeleteEqMock = vi.fn().mockResolvedValue({ error: null });
        const profilesUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

        let profilesUpdatePayload: unknown = null;

        const mockClient = {
          auth: {
            admin: {
              createUser: createUserMock,
              updateUserById: updateUserByIdMock,
            },
          },
          from: vi.fn((table: string) => {
            if (table === 'merchants') {
              return {
                delete: vi.fn().mockReturnValue({
                  eq: merchantsDeleteEqMock,
                }),
              };
            }
            if (table === 'profiles') {
              return {
                update: vi.fn((payload) => {
                  profilesUpdatePayload = payload;
                  return {
                    eq: profilesUpdateEqMock,
                  };
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        const creds = await seedAdminUser(ctx, mockClient, validEnv);

        // 1. auth.admin.createUser recibe role: 'merchant' (no 'admin' para evitar INVALID_SIGNUP_ROLE)
        expect(createUserMock).toHaveBeenCalledWith(
          expect.objectContaining({
            user_metadata: expect.objectContaining({ role: 'merchant' }),
          })
        );

        // 2. se ejecuta delete sobre merchants con eq('profile_id', adminUserId)
        expect(merchantsDeleteEqMock).toHaveBeenCalledWith('profile_id', mockAdminId);

        // 3. se ejecuta update sobre profiles con role: 'admin'
        expect(profilesUpdatePayload).toEqual(
          expect.objectContaining({
            role: 'admin',
            consent_status: 'active',
          })
        );
        expect(profilesUpdateEqMock).toHaveBeenCalledWith('id', mockAdminId);

        // 4. se ejecuta updateUserById con role: 'admin'
        expect(updateUserByIdMock).toHaveBeenCalledWith(
          mockAdminId,
          expect.objectContaining({
            user_metadata: expect.objectContaining({ role: 'admin' }),
          })
        );

        // Credenciales y tracking
        expect(creds.id).toBe(mockAdminId);
        expect(creds.role).toBe('admin');
        expect(creds.email).toContain('admin@cadeapp-staging.test');
        expect(ctx.createdUserIds).toContain(mockAdminId);
        expect(ctx.adminUser).toEqual(creds);
      });

      it('si el update de profiles falla, se lanza error y el usuario ya está en createdUserIds', async () => {
        const ctx = createStagingSeedContext();
        const mockAdminId = '99999999-8888-7777-6666-555555555555';

        const mockClient = {
          auth: {
            admin: {
              createUser: vi.fn().mockResolvedValue({
                data: { user: { id: mockAdminId } },
                error: null,
              }),
            },
          },
          from: vi.fn((table: string) => {
            if (table === 'merchants') {
              return {
                delete: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                }),
              };
            }
            if (table === 'profiles') {
              return {
                update: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: { message: 'Database lock or constraint error' } }),
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        await expect(seedAdminUser(ctx, mockClient, validEnv)).rejects.toThrow(
          /\[E2E Seed Error\] Falló la promoción del profile a admin: Database lock or constraint error/i
        );

        // El usuario ya quedó registrado para cleanup a pesar del fallo
        expect(ctx.createdUserIds).toContain(mockAdminId);
      });
    });

    describe('seedDeliveryRequestInState', () => {
      it('crea solicitud en estado draft con precondiciones y tracking', async () => {
        const ctx = createStagingSeedContext();
        const merchantId = '11111111-1111-4111-8111-111111111111';
        ctx.merchantUser = {
          id: merchantId,
          email: 'merchant@test.local',
          password: 'pass',
          role: 'merchant',
        };

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'zones') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        { id: '22222222-2222-4222-8222-222222222222' },
                        { id: '33333333-3333-4333-8333-333333333333' },
                      ],
                      error: null,
                    }),
                  }),
                }),
              };
            }
            if (table === 'delivery_requests') {
              return {
                insert: vi.fn().mockResolvedValue({ error: null }),
              };
            }
            if (table === 'delivery_request_contacts') {
              return {
                insert: vi.fn().mockResolvedValue({ error: null }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        const result = await seedDeliveryRequestInState(
          ctx,
          { status: 'draft', withContacts: true },
          mockClient,
          validEnv
        );

        expect(result.requestId).toBeDefined();
        expect(ctx.createdRequestIds).toContain(result.requestId);
        expect(ctx.createdContactRequestIds).toContain(result.requestId);
      });

      it('crea solicitud en estado matched con oferta aceptada e incidentes opcionales', async () => {
        const ctx = createStagingSeedContext();
        const merchantId = '11111111-1111-4111-8111-111111111111';
        const courierId = '44444444-4444-4444-8444-444444444444';
        ctx.merchantUser = {
          id: merchantId,
          email: 'merchant@test.local',
          password: 'pass',
          role: 'merchant',
        };
        ctx.courierUsers = [
          { id: courierId, email: 'courier@test.local', password: 'pass', role: 'courier' },
        ];

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'zones') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [{ id: '22222222-2222-4222-8222-222222222222' }],
                      error: null,
                    }),
                  }),
                }),
              };
            }
            if (table === 'offers') {
              return {
                insert: vi.fn().mockResolvedValue({ error: null }),
              };
            }
            if (table === 'delivery_requests') {
              return {
                insert: vi.fn().mockResolvedValue({ error: null }),
                update: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                }),
              };
            }
            if (table === 'incidents') {
              return {
                insert: vi.fn().mockResolvedValue({ error: null }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        const result = await seedDeliveryRequestInState(
          ctx,
          {
            status: 'matched',
            assignedCourierId: courierId,
            withIncident: {
              kind: 'other',
              description: 'Incidente de prueba',
              reporterId: merchantId,
            },
          },
          mockClient,
          validEnv
        );

        expect(result.requestId).toBeDefined();
        expect(result.acceptedOfferId).toBeDefined();
        expect(result.incidentId).toBeDefined();
        expect(ctx.createdRequestIds).toContain(result.requestId);
        expect(ctx.createdOfferIds).toContain(result.acceptedOfferId);
        expect(ctx.createdIncidentIds).toContain(result.incidentId);
      });

      it('cumple con el orden relacional de FK (H06): delivery_requests con accepted_offer_id null, luego offers, luego update de accepted_offer_id', async () => {
        const ctx = createStagingSeedContext();
        const merchantId = '11111111-1111-4111-8111-111111111111';
        const courierId = '44444444-4444-4444-8444-444444444444';
        ctx.merchantUser = {
          id: merchantId,
          email: 'merchant@test.local',
          password: 'pass',
          role: 'merchant',
        };
        ctx.courierUsers = [
          { id: courierId, email: 'courier@test.local', password: 'pass', role: 'courier' },
        ];

        const calls: Array<{ op: string; payload?: unknown }> = [];

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'zones') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [{ id: '22222222-2222-4222-8222-222222222222' }],
                      error: null,
                    }),
                  }),
                }),
              };
            }
            if (table === 'delivery_requests') {
              return {
                insert: vi.fn((payload) => {
                  calls.push({ op: 'delivery_requests.insert', payload });
                  return Promise.resolve({ error: null });
                }),
                update: vi.fn((payload) => {
                  calls.push({ op: 'delivery_requests.update', payload });
                  return {
                    eq: vi.fn().mockResolvedValue({ error: null }),
                  };
                }),
              };
            }
            if (table === 'offers') {
              return {
                insert: vi.fn((payload) => {
                  calls.push({ op: 'offers.insert', payload });
                  return Promise.resolve({ error: null });
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        const result = await seedDeliveryRequestInState(
          ctx,
          { status: 'matched', assignedCourierId: courierId },
          mockClient,
          validEnv
        );

        expect(result.requestId).toBeDefined();
        expect(result.acceptedOfferId).toBeDefined();

        // Verificar el orden exacto de llamadas:
        // 1. delivery_requests.insert (con accepted_offer_id: null para respetar FK)
        // 2. offers.insert (con request_id: requestId)
        // 3. delivery_requests.update (con accepted_offer_id: acceptedOfferId)
        expect(calls.map((c) => c.op)).toEqual([
          'delivery_requests.insert',
          'offers.insert',
          'delivery_requests.update',
        ]);

        const reqInsert = calls[0]?.payload as Record<string, unknown>;
        expect(reqInsert.id).toBe(result.requestId);
        expect(reqInsert.accepted_offer_id).toBeNull();

        const offInsert = calls[1]?.payload as Record<string, unknown>;
        expect(offInsert.id).toBe(result.acceptedOfferId);
        expect(offInsert.request_id).toBe(result.requestId);
        expect(offInsert.status).toBe('accepted');

        const reqUpdate = calls[2]?.payload as Record<string, unknown>;
        expect(reqUpdate.accepted_offer_id).toBe(result.acceptedOfferId);
      });
    });

    describe('getPlatformSettingNumber fail-closed (H13)', () => {
      it('1. lectura exitosa de un número entero', async () => {
        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'platform_settings') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { value: 45 },
                      error: null,
                    }),
                  }),
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        const val = await getPlatformSettingNumber('request_ttl_minutes', mockClient, validEnv);
        expect(val).toBe(45);
      });

      it('2. lectura exitosa de un número en string numérico (ej: "45")', async () => {
        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'platform_settings') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { value: '45' },
                      error: null,
                    }),
                  }),
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        const val = await getPlatformSettingNumber('request_ttl_minutes', mockClient, validEnv);
        expect(val).toBe(45);
      });

      it('3. error si la fila no existe', async () => {
        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'platform_settings') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: null,
                      error: null,
                    }),
                  }),
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        await expect(getPlatformSettingNumber('missing_key', mockClient, validEnv)).rejects.toThrow(
          /\[E2E Inspection Error\] No se pudo leer la configuración 'missing_key': fila no encontrada/i
        );
      });

      it('4. error si la consulta devuelve error de PostgREST', async () => {
        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'platform_settings') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'connection refused' },
                    }),
                  }),
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        await expect(getPlatformSettingNumber('request_ttl_minutes', mockClient, validEnv)).rejects.toThrow(
          /\[E2E Inspection Error\] No se pudo leer la configuración 'request_ttl_minutes': connection refused/i
        );
      });

      it('5. error si el valor es null, NaN, string no numérico o no finito', async () => {
        const createClientWithValue = (val: unknown) =>
          ({
            from: vi.fn((table: string) => {
              if (table === 'platform_settings') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: { value: val },
                        error: null,
                      }),
                    }),
                  }),
                };
              }
              throw new Error(`Unexpected table: ${table}`);
            }),
          }) as unknown as AdminClientType;

        await expect(getPlatformSettingNumber('key1', createClientWithValue(null), validEnv)).rejects.toThrow(
          /\[E2E Inspection Error\] No se pudo leer la configuración 'key1': el valor es nulo o indefinido/i
        );

        await expect(getPlatformSettingNumber('key2', createClientWithValue(undefined), validEnv)).rejects.toThrow(
          /\[E2E Inspection Error\] No se pudo leer la configuración 'key2': el valor es nulo o indefinido/i
        );

        await expect(
          getPlatformSettingNumber('key3', createClientWithValue('not-a-number'), validEnv)
        ).rejects.toThrow(
          /\[E2E Inspection Error\] No se pudo leer la configuración 'key3': el valor 'not-a-number' no es un número finito/i
        );

        await expect(
          getPlatformSettingNumber('key4', createClientWithValue(Infinity), validEnv)
        ).rejects.toThrow(
          /\[E2E Inspection Error\] No se pudo leer la configuración 'key4': el valor 'Infinity' no es un número finito/i
        );
      });
    });

    describe('setMerchantSubscriptionStatus (H09)', () => {

      it('actualiza el subscription_status en merchants', async () => {
        const merchantId = '11111111-1111-4111-8111-111111111111';
        let updatedPayload: unknown = null;
        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'merchants') {
              return {
                update: vi.fn((payload) => {
                  updatedPayload = payload;
                  return {
                    eq: vi.fn().mockResolvedValue({ error: null }),
                  };
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        await setMerchantSubscriptionStatus(merchantId, 'expired', mockClient, validEnv);
        expect(updatedPayload).toEqual({ subscription_status: 'expired' });
      });
    });

    describe('getRequestInspectionData extendido', () => {
      it('retorna campos extendidos de solicitud, ofertas, incidentes y cancellationReasons', async () => {
        const ctx = createStagingSeedContext();
        const requestId = '77777777-7777-4777-8777-777777777777';
        ctx.createdRequestIds = [requestId];

        const mockClient = {
          from: vi.fn((table: string) => {
            if (table === 'delivery_requests') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: requestId,
                        status: 'in_transit',
                        accepted_offer_id: '88888888-8888-4888-8888-888888888888',
                        published_at: '2026-10-01T20:00:00Z',
                        expires_at: '2026-10-01T20:45:00Z',
                        matched_at: '2026-10-01T20:10:00Z',
                        picked_up_at: '2026-10-01T20:20:00Z',
                        delivered_at: null,
                        cancelled_at: null,
                        cancel_reason: null,
                      },
                      error: null,
                    }),
                  }),
                }),
              };
            }
            if (table === 'offers') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: '88888888-8888-4888-8888-888888888888',
                        status: 'accepted',
                        courier_id: 'courier-1',
                        amount_ars: 2000,
                      },
                    ],
                    error: null,
                  }),
                }),
              };
            }
            if (table === 'incidents') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'inc-1',
                        status: 'open',
                        kind: 'safety',
                        reporter_id: 'courier-1',
                      },
                    ],
                    error: null,
                  }),
                }),
              };
            }
            if (table === 'request_cancellation_reasons') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'cr-1',
                        request_id: requestId,
                        offer_id: '88888888-8888-4888-8888-888888888888',
                        actor_id: 'actor-1',
                        action: 'courier_cancel_match',
                        reason: 'Problema mecánico con la moto',
                      },
                    ],
                    error: null,
                  }),
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        } as unknown as AdminClientType;

        const inspection = await getRequestInspectionData(ctx, requestId, mockClient, validEnv);

        expect(inspection.requestId).toBe(requestId);
        expect(inspection.requestStatus).toBe('in_transit');
        expect(inspection.pickedUpAt).toBe('2026-10-01T20:20:00Z');
        expect(inspection.offers).toHaveLength(1);
        expect(inspection.offers[0]?.status).toBe('accepted');
        expect(inspection.incidents).toHaveLength(1);
        expect(inspection.incidents?.[0]?.kind).toBe('safety');
        expect(inspection.cancellationReasons).toHaveLength(1);
        expect(inspection.cancellationReasons?.[0]?.action).toBe('courier_cancel_match');
        expect(inspection.cancellationReasons?.[0]?.reason).toBe('Problema mecánico con la moto');
      });
    });
  });
});
