import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import { getCourierDocumentsStatus, type CourierDocumentMetadata } from './queries';

import { StatusView } from './components/status-view';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('T-324: getCourierDocumentsStatus query y CanonicalCourierOnboardingStatusPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCourierDocumentsStatus (H03)', () => {
    it('consulta kind, status y uploaded_at ordenados descendentemente y deduplica conservando solo el más reciente por kind', async () => {
      // Mock con múltiples filas históricas:
      // license nueva = rejected, vieja = verified
      // insurance nueva = submitted, vieja = rejected
      const mockRows = [
        { kind: 'license', status: 'rejected', uploaded_at: '2026-10-02T10:00:00Z', storage_path: 'courier-docs/license-new.jpg' },
        { kind: 'insurance', status: 'submitted', uploaded_at: '2026-10-02T09:00:00Z', storage_path: 'courier-docs/insurance-new.jpg' },
        { kind: 'license', status: 'verified', uploaded_at: '2026-10-01T10:00:00Z', storage_path: 'courier-docs/license-old.jpg' },
        { kind: 'insurance', status: 'rejected', uploaded_at: '2026-10-01T09:00:00Z', storage_path: 'courier-docs/insurance-old.jpg' },
      ];

      const orderMock = vi.fn().mockResolvedValue({ data: mockRows, error: null });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn().mockReturnValue({
          select: selectMock,
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getCourierDocumentsStatus('user-1');

      // Afirmar exactamente la consulta esperada
      expect(selectMock).toHaveBeenCalledWith('kind, status, uploaded_at');
      expect(eqMock).toHaveBeenCalledWith('courier_id', 'user-1');
      expect(orderMock).toHaveBeenCalledWith('uploaded_at', { ascending: false });

      // Resultado deduplicado tomando el más reciente
      expect(result).toEqual([
        { kind: 'license', status: 'rejected' },
        { kind: 'insurance', status: 'submitted' },
      ]);

      // El resultado NO contiene uploaded_at ni storage_path
      for (const doc of result) {
        expect('uploaded_at' in doc).toBe(false);
        expect('storage_path' in doc).toBe(false);
      }
    });

    it('devuelve array vacío si no hay filas persistidas', async () => {
      const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn().mockReturnValue({
          select: selectMock,
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await getCourierDocumentsStatus('user-empty');
      expect(result).toEqual([]);
    });

    it('propaga error descriptivo cuando la consulta a Supabase falla', async () => {
      const orderMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: vi.fn().mockReturnValue({
          select: selectMock,
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      await expect(getCourierDocumentsStatus('user-err')).rejects.toThrow(
        /Error al consultar documentos del repartidor/
      );
    });
  });

  describe('CanonicalCourierOnboardingStatusPage real (H01)', () => {
    it('redirige a /login?redirectTo=/courier/onboarding/status si user es null', async () => {
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const { default: CanonicalCourierOnboardingStatusPage } = await import(
        '@/app/(courier)/courier/onboarding/status/page'
      );

      try {
        await CanonicalCourierOnboardingStatusPage();
        expect.unreachable('Debe lanzar redirect');
      } catch (err: unknown) {
        expect((err as Error).message).toBe('NEXT_REDIRECT');
        expect((err as { digest?: string }).digest).toContain(
          '/login?redirectTo=/courier/onboarding/status'
        );
      }
    });

    it('con usuario válido, ejerce getCourierDocumentsStatus contra Supabase y renderiza StatusView con los documentos persistidos', async () => {
      const mockDocs = [
        { kind: 'dni_front', status: 'submitted', uploaded_at: '2026-10-02T10:00:00Z' },
        { kind: 'selfie', status: 'verified', uploaded_at: '2026-10-02T09:00:00Z' },
      ];

      const orderMock = vi.fn().mockResolvedValue({ data: mockDocs, error: null });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'courier-42' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: selectMock,
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const { default: CanonicalCourierOnboardingStatusPage } = await import(
        '@/app/(courier)/courier/onboarding/status/page'
      );
      const element = await CanonicalCourierOnboardingStatusPage();

      expect(selectMock).toHaveBeenCalledWith('kind, status, uploaded_at');
      expect(eqMock).toHaveBeenCalledWith('courier_id', 'courier-42');

      // Verifica que el React Element devuelto contiene StatusView con los documentos persistidos
      expect(element).toBeDefined();
      const statusViewChild = element.props.children;
      expect(statusViewChild.type).toBe(StatusView);
      expect(statusViewChild.props.documents).toEqual([
        { kind: 'dni_front', status: 'submitted' },
        { kind: 'selfie', status: 'verified' },
      ]);
    });
  });
});
