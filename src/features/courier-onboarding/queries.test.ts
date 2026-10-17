import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import { getCourierDocumentsStatus, type CourierDocumentMetadata } from './queries';
import { DOCUMENT_REJECTION_REASONS, DEFAULT_REJECTION_MESSAGE } from './copy';
import { StatusView } from './components/status-view';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('T-356 / CC-025: getCourierDocumentsStatus query y CanonicalCourierOnboardingStatusPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCourierDocumentsStatus', () => {
    function setupSupabaseMock(rows: unknown[] | null, error: { message: string } | null = null) {
      const orderMock = vi.fn().mockResolvedValue({ data: rows, error });
      const eqIsCurrentMock = vi.fn().mockReturnValue({ order: orderMock });
      const eqCourierMock = vi.fn().mockReturnValue({ eq: eqIsCurrentMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqCourierMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        from: fromMock,
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      return { fromMock, selectMock, eqCourierMock, eqIsCurrentMock, orderMock };
    }

    it('consulta kind, status, rejection_code, uploaded_at e is_current filtrando por courier_id e is_current=true ordenado desc', async () => {
      const mockRows = [
        {
          kind: 'license',
          status: 'rejected',
          rejection_code: 'expired',
          uploaded_at: '2026-10-02T10:00:00Z',
          is_current: true,
          storage_path: 'courier/user-1/license_123.jpg',
        },
        {
          kind: 'insurance',
          status: 'submitted',
          rejection_code: null,
          uploaded_at: '2026-10-02T09:00:00Z',
          is_current: true,
          storage_path: 'courier/user-1/insurance_123.jpg',
        },
      ];

      const { fromMock, selectMock, eqCourierMock, eqIsCurrentMock, orderMock } = setupSupabaseMock(mockRows);

      const result = await getCourierDocumentsStatus('user-1');

      expect(fromMock).toHaveBeenCalledWith('courier_documents');
      expect(selectMock).toHaveBeenCalledWith('kind, status, rejection_code, uploaded_at, is_current');
      expect(eqCourierMock).toHaveBeenCalledWith('courier_id', 'user-1');
      expect(eqIsCurrentMock).toHaveBeenCalledWith('is_current', true);
      expect(orderMock).toHaveBeenCalledWith('uploaded_at', { ascending: false });

      expect(result).toEqual([
        {
          kind: 'license',
          status: 'rejected',
          rejectionCode: 'expired',
          rejectionMessage: DOCUMENT_REJECTION_REASONS.expired,
        },
        {
          kind: 'insurance',
          status: 'submitted',
          rejectionCode: null,
          rejectionMessage: null,
        },
      ]);

      // No expone uploaded_at, storage_path ni campos privados
      for (const doc of result) {
        expect('uploaded_at' in doc).toBe(false);
        expect('storage_path' in doc).toBe(false);
        expect('reason' in doc).toBe(false);
      }
    });

    it('mapea codigos de rechazo conocidos a mensajes seguros del catalogo', async () => {
      const mockRows = [
        { kind: 'dni_front', status: 'rejected', rejection_code: 'illegible', uploaded_at: '2026-10-02T10:00:00Z' },
        { kind: 'dni_back', status: 'rejected', rejection_code: 'wrong_type', uploaded_at: '2026-10-02T09:00:00Z' },
        { kind: 'selfie', status: 'rejected', rejection_code: 'data_mismatch', uploaded_at: '2026-10-02T08:00:00Z' },
        { kind: 'avatar', status: 'rejected', rejection_code: 'incomplete', uploaded_at: '2026-10-02T07:00:00Z' },
        { kind: 'license', status: 'rejected', rejection_code: 'other_safe', uploaded_at: '2026-10-02T06:00:00Z' },
      ];

      setupSupabaseMock(mockRows);

      const result = await getCourierDocumentsStatus('user-1');

      expect(result[0]?.rejectionMessage).toBe('Documento borroso, ilegible o cortado.');
      expect(result[1]?.rejectionMessage).toBe('El archivo no corresponde al tipo de documento solicitado.');
      expect(result[2]?.rejectionMessage).toBe('Los datos no coinciden con la identidad declarada.');
      expect(result[3]?.rejectionMessage).toBe('Documento incompleto (falta frente o dorso).');
      expect(result[4]?.rejectionMessage).toBe('Requiere nueva carga para verificación administrativa.');
    });

    it('usa el mensaje por defecto si rejection_code es desconocido o nulo en un documento rejected', async () => {
      const mockRows = [
        { kind: 'license', status: 'rejected', rejection_code: 'unknown_code_999', uploaded_at: '2026-10-02T10:00:00Z' },
        { kind: 'insurance', status: 'rejected', rejection_code: null, uploaded_at: '2026-10-02T09:00:00Z' },
      ];

      setupSupabaseMock(mockRows);

      const result = await getCourierDocumentsStatus('user-1');

      expect(result[0]?.rejectionCode).toBe('unknown_code_999');
      expect(result[0]?.rejectionMessage).toBe(DEFAULT_REJECTION_MESSAGE);

      expect(result[1]?.rejectionCode).toBeNull();
      expect(result[1]?.rejectionMessage).toBe(DEFAULT_REJECTION_MESSAGE);
    });

    it('no proyecta rejectionCode ni rejectionMessage cuando el documento esta verificado o submitted', async () => {
      // Incluso si la fila tuviera un rejection_code residual de una versión previa
      const mockRows = [
        { kind: 'license', status: 'verified', rejection_code: 'expired', uploaded_at: '2026-10-02T10:00:00Z' },
        { kind: 'insurance', status: 'submitted', rejection_code: 'illegible', uploaded_at: '2026-10-02T09:00:00Z' },
      ];

      setupSupabaseMock(mockRows);

      const result = await getCourierDocumentsStatus('user-1');

      expect(result).toEqual([
        { kind: 'license', status: 'verified', rejectionCode: null, rejectionMessage: null },
        { kind: 'insurance', status: 'submitted', rejectionCode: null, rejectionMessage: null },
      ]);
    });

    it('deduplica por kind conservando solo el primer registro (más reciente)', async () => {
      const mockRows = [
        { kind: 'license', status: 'rejected', rejection_code: 'expired', uploaded_at: '2026-10-02T10:00:00Z' },
        { kind: 'license', status: 'verified', rejection_code: null, uploaded_at: '2026-10-01T10:00:00Z' },
      ];

      setupSupabaseMock(mockRows);

      const result = await getCourierDocumentsStatus('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        kind: 'license',
        status: 'rejected',
        rejectionCode: 'expired',
        rejectionMessage: DOCUMENT_REJECTION_REASONS.expired,
      });
    });

    it('devuelve array vacío si no hay filas persistidas', async () => {
      setupSupabaseMock([]);

      const result = await getCourierDocumentsStatus('user-empty');
      expect(result).toEqual([]);
    });

    it('propaga error descriptivo cuando la consulta a Supabase falla', async () => {
      setupSupabaseMock(null, { message: 'Database connection failed' });

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
        { kind: 'dni_front', status: 'submitted', rejection_code: null, uploaded_at: '2026-10-02T10:00:00Z', is_current: true },
        { kind: 'selfie', status: 'verified', rejection_code: null, uploaded_at: '2026-10-02T09:00:00Z', is_current: true },
      ];

      const orderMock = vi.fn().mockResolvedValue({ data: mockDocs, error: null });
      const eqIsCurrentMock = vi.fn().mockReturnValue({ order: orderMock });
      const eqCourierMock = vi.fn().mockReturnValue({ eq: eqIsCurrentMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqCourierMock });

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

      expect(selectMock).toHaveBeenCalledWith('kind, status, rejection_code, uploaded_at, is_current');
      expect(eqCourierMock).toHaveBeenCalledWith('courier_id', 'courier-42');
      expect(eqIsCurrentMock).toHaveBeenCalledWith('is_current', true);

      expect(element).toBeDefined();
      const statusViewChild = element.props.children;
      expect(statusViewChild.type).toBe(StatusView);
      expect(statusViewChild.props.documents).toEqual([
        { kind: 'dni_front', status: 'submitted', rejectionCode: null, rejectionMessage: null },
        { kind: 'selfie', status: 'verified', rejectionCode: null, rejectionMessage: null },
      ]);
    });
  });
});
