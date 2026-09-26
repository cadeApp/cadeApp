import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as adminSupabase from '@/server/supabase/admin';
import { getApplicantsQueue, getApplicantDetail } from './queries';

vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('Admin Queries (T-122 DoD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cola de postulantes (getApplicantsQueue)', () => {
    it('retorna lista mapeada de postulantes y resume documentos correctamente', async () => {
      const mockAdminSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
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
              }),
            }),
          }),
        }),
      };
      vi.mocked(adminSupabase.createAdminClient).mockReturnValue(
        mockAdminSupabase as unknown as ReturnType<typeof adminSupabase.createAdminClient>
      );

      const queue = await getApplicantsQueue('pending');
      expect(Array.isArray(queue)).toBe(true);
      expect(queue).toHaveLength(1);
      expect(queue[0]?.fullName).toBe('Juan Perez');
      expect(queue[0]?.phone).toBe('3865123456');
      expect(queue[0]?.vehicleType).toBe('moto');
      expect(queue[0]?.documentsSummary.hasDniFront).toBe(true);
      expect(queue[0]?.documentsSummary.hasDniBack).toBe(true);
      expect(queue[0]?.documentsSummary.hasSelfie).toBe(true);
      expect(queue[0]?.documentsSummary.hasLicense).toBe(false);
    });

    it('retorna array vacío ante error en la consulta', async () => {
      const mockAdminSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      };
      vi.mocked(adminSupabase.createAdminClient).mockReturnValue(
        mockAdminSupabase as unknown as ReturnType<typeof adminSupabase.createAdminClient>
      );

      const queue = await getApplicantsQueue('pending');
      expect(queue).toEqual([]);
    });
  });

  describe('Detalle de postulante (getApplicantDetail)', () => {
    it('INVARIANTE CRÍTICO: CBU / Alias bancario extirpado y jamás expuesto en el objeto', async () => {
      const mockAdminSupabase = {
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
      vi.mocked(adminSupabase.createAdminClient).mockReturnValue(
        mockAdminSupabase as unknown as ReturnType<typeof adminSupabase.createAdminClient>
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
      const mockAdminSupabase = {
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
      vi.mocked(adminSupabase.createAdminClient).mockReturnValue(
        mockAdminSupabase as unknown as ReturnType<typeof adminSupabase.createAdminClient>
      );

      const detail = await getApplicantDetail('inexistente');
      expect(detail).toBeNull();
    });
  });
});
