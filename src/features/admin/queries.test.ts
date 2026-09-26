import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import * as adminSupabase from '@/server/supabase/admin';
import { getApplicantsQueue, getApplicantDetail } from './queries';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('Admin Queries (T-122 DoD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PR106-H07 y PR106-H12: Cola de postulantes (getApplicantsQueue)', () => {
    it('utiliza await createClient() (sesión autenticada) y NO createAdminClient() (PR106-H12)', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: mockLimit,
              }),
            }),
          }),
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      await getApplicantsQueue('pending');

      expect(serverSupabase.createClient).toHaveBeenCalled();
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    });

    it('primera página usa limit(pageSize + 1) y NO llama a range() (PR106-H07)', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [
          {
            profile_id: 'courier-1',
            status: 'pending',
            vehicle_type: 'moto',
            vehicle_plate: 'A123BCD',
            dni_hmac: 'abcdef123456',
            doc_level: 1,
            license_status: 'submitted',
            insurance_status: 'none',
            profiles: {
              display_name: 'Juan Perez',
              phone: '3865123456',
              created_at: '2026-09-25T10:00:00Z',
            },
            courier_documents: [
              { kind: 'dni_front', status: 'submitted' },
              { kind: 'dni_back', status: 'submitted' },
              { kind: 'selfie', status: 'submitted' },
            ],
          },
        ],
        error: null,
      });
      const mockRange = vi.fn();

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: mockLimit,
                range: mockRange,
              }),
            }),
          }),
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const result = await getApplicantsQueue('pending', { pageSize: 20 });
      expect(mockLimit).toHaveBeenCalledWith(21);
      expect(mockRange).not.toHaveBeenCalled();
      expect(result.pageSize).toBe(20);
      expect(result.hasNextPage).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.fullName).toBe('Juan Perez');
      expect(result.items[0]?.documentsSummary.hasDniFront).toBe(true);
      expect(result.items[0]?.documentsSummary.hasLicense).toBe(false);
    });

    it('con cursor válido aplica filtro .lt("profile_id", cursor) (PR106-H07)', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockLt = vi.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                lt: mockLt,
              }),
            }),
          }),
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const cursorUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      await getApplicantsQueue('pending', { cursor: cursorUuid, pageSize: 20 });

      expect(mockLt).toHaveBeenCalledWith('profile_id', cursorUuid);
      expect(mockLimit).toHaveBeenCalledWith(21);
    });

    it('calcula hasNextPage y nextCursor a partir del último item visible ante fila extra (PR106-H07)', async () => {
      // Pedimos pageSize=2 -> limit(3) -> data devuelve 3 filas -> hasNextPage=true, nextCursor='c-2'
      const mockLimit = vi.fn().mockResolvedValue({
        data: [
          {
            profile_id: 'c-1',
            status: 'pending',
            profiles: null,
            courier_documents: [],
          },
          {
            profile_id: 'c-2',
            status: 'pending',
            profiles: null,
            courier_documents: [],
          },
          {
            profile_id: 'c-3',
            status: 'pending',
            profiles: null,
            courier_documents: [],
          },
        ],
        error: null,
      });

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: mockLimit,
              }),
            }),
          }),
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const result = await getApplicantsQueue('pending', { pageSize: 2 });
      expect(mockLimit).toHaveBeenCalledWith(3);
      expect(result.hasNextPage).toBe(true);
      expect(result.nextCursor).toBe('c-2');
      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.id).toBe('c-1');
      expect(result.items[1]?.id).toBe('c-2');
    });

    it('propaga y lanza excepción ante error de DB en getApplicantsQueue (PR106-H08)', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database connection failed' },
                }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      await expect(getApplicantsQueue('pending')).rejects.toThrow('Database connection failed');
    });
  });

  describe('PR106-H12: Detalle de postulante (getApplicantDetail)', () => {
    it('utiliza await createClient() (sesión autenticada) y NO createAdminClient() (PR106-H12)', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      profile_id: 'courier-1',
                      status: 'pending',
                      vehicle_type: 'moto',
                      vehicle_plate: 'A123BCD',
                      dni_hmac: 'abcdef123456',
                      doc_level: 1,
                      license_status: 'submitted',
                      insurance_status: 'none',
                      decided_at: null,
                      decided_by: null,
                      deactivated_at: null,
                      profiles: {
                        display_name: 'Juan Perez',
                        phone: '3865123456',
                        created_at: '2026-09-25T10:00:00Z',
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'courier_documents') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      await getApplicantDetail('courier-1');

      expect(serverSupabase.createClient).toHaveBeenCalled();
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    });

    it('INVARIANTE CRÍTICO: CBU / Alias bancario extirpado y jamás expuesto en el objeto', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      profile_id: 'courier-1',
                      status: 'pending',
                      vehicle_type: 'moto',
                      vehicle_plate: 'A123BCD',
                      dni_hmac: 'abcdef123456',
                      doc_level: 1,
                      license_status: 'submitted',
                      insurance_status: 'none',
                      decided_at: null,
                      decided_by: null,
                      deactivated_at: null,
                      profiles: {
                        display_name: 'Juan Perez',
                        phone: '3865123456',
                        created_at: '2026-09-25T10:00:00Z',
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'courier_documents') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'doc-1',
                        kind: 'dni_front',
                        storage_path: 'courier-1/dni_front.webp',
                        status: 'submitted',
                        uploaded_at: '2026-09-25T10:05:00Z',
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const detail = await getApplicantDetail('courier-1');
      expect(detail).not.toBeNull();
      if (detail) {
        const keys = Object.keys(detail);
        const forbiddenFields = ['cbu', 'alias', 'bank_account', 'bank', 'cbu_alias'];
        for (const field of forbiddenFields) {
          expect(keys).not.toContain(field);
        }
        expect(detail.id).toBe('courier-1');
        expect(detail.documents).toHaveLength(1);
        expect(detail.documents[0]?.documentType).toBe('dni_front');
      }
    });

    it('retorna null si el repartidor no existe', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const detail = await getApplicantDetail('inexistente');
      expect(detail).toBeNull();
    });

    it('propaga y lanza excepción ante error de DB en getApplicantDetail (PR106-H08)', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'DB connection timeout' },
                  }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      await expect(getApplicantDetail('courier-1')).rejects.toThrow('DB connection timeout');
    });
  });
});
