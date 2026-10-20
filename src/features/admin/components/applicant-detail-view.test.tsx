// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApplicantDetailView } from './applicant-detail-view';
import { ApplicantsQueue } from './applicants-queue';
import {
  viewCourierDocumentAction,
  decideCourierAction,
  suspendCourierAction,
  reinstateCourierAction,
  verifyCourierDocumentAction,
} from '../actions';
import type { ApplicantDetail, ApplicantListItem } from '../types';

const refresh = vi.fn();
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../actions', () => ({
  viewCourierDocumentAction: vi.fn(),
  decideCourierAction: vi.fn(),
  suspendCourierAction: vi.fn(),
  reinstateCourierAction: vi.fn(),
  verifyCourierDocumentAction: vi.fn(),
}));

const mockApplicant: ApplicantDetail = {
  id: 'a0000000-0000-0000-0000-000000000001',
  fullName: 'Juan Repartidor',
  status: 'pending',
  dniHash: 'hash-dni-1234',
  phone: '3865123456',
  vehicleType: 'moto',
  vehiclePlate: 'ABC 123',
  docLevel: 1,
  createdAt: '2026-09-20T10:00:00.000Z',
  decidedAt: null,
  decidedBy: null,
  deactivatedAt: null,
  licenseStatus: 'submitted',
  insuranceStatus: 'submitted',
  documents: [
    {
      id: 'd0000000-0000-0000-0000-000000000001',
      documentType: 'dni_front',
      storagePath: 'courier-docs/dni_front.webp',
      status: 'submitted',
      uploadedAt: '2026-09-20T10:05:00.000Z',
    },
    {
      id: 'd0000000-0000-0000-0000-000000000002',
      documentType: 'dni_back',
      storagePath: 'courier-docs/dni_back.webp',
      status: 'submitted',
      uploadedAt: '2026-09-20T10:06:00.000Z',
    },
  ],
};

describe('ApplicantDetailView (PR106-H14, PR106-H13, PR106-H16)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. renderiza los tabs de documentos usando roles y primitivas oficiales (@/ui/tabs)', () => {
    render(<ApplicantDetailView applicant={mockApplicant} />);

    const tablist = screen.getByRole('tablist');
    expect(tablist.getAttribute('aria-orientation')).toBe('vertical');

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(2);
    expect(tabs[0]?.textContent).toContain('DNI Frente');
    expect(tabs[1]?.textContent).toContain('DNI Dorso');
    expect(tabs[0]?.getAttribute('data-state')).toBe('active');
  });

  it('2. carga el documento auditado de 60s al presionar Cargar documento seguro', async () => {
    vi.mocked(viewCourierDocumentAction).mockResolvedValue({
      ok: true,
      data: {
        signedUrl: 'https://example.com/signed/dni_front.webp',
        expiresInSeconds: 60,
      },
    });

    render(<ApplicantDetailView applicant={mockApplicant} />);

    const loadButton = screen.getByRole('button', { name: /cargar documento seguro/i });
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(viewCourierDocumentAction).toHaveBeenCalledWith({
        documentId: 'd0000000-0000-0000-0000-000000000001',
        courierId: 'a0000000-0000-0000-0000-000000000001',
      });
      const img = screen.getByRole('img', { name: /documento dni frente/i });
      expect(img.getAttribute('src')).toBe('https://example.com/signed/dni_front.webp');
      expect(screen.getByText(/URL temporal expira en:/i)).toBeDefined();
    });
  });

  it('3. aprueba el documento individual llamando a verifyCourierDocumentAction con verified: true', async () => {
    vi.mocked(viewCourierDocumentAction).mockResolvedValue({
      ok: true,
      data: {
        signedUrl: 'https://example.com/signed/dni_front.webp',
        expiresInSeconds: 60,
      },
    });
    vi.mocked(verifyCourierDocumentAction).mockResolvedValue({
      ok: true,
      data: { success: true },
    });

    render(<ApplicantDetailView applicant={mockApplicant} />);

    fireEvent.click(screen.getByRole('button', { name: /cargar documento seguro/i }));
    await screen.findByRole('img', { name: /documento dni frente/i });

    const verifyBtn = screen.getByRole('button', { name: /verificar documento/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(verifyCourierDocumentAction).toHaveBeenCalledWith({
        documentId: 'd0000000-0000-0000-0000-000000000001',
        verified: true,
        rejectionReason: null,
      });
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('4. abre el Dialog oficial de rechazo documental y envía el motivo real escrito por el admin (PR106-H14)', async () => {
    vi.mocked(viewCourierDocumentAction).mockResolvedValue({
      ok: true,
      data: {
        signedUrl: 'https://example.com/signed/dni_front.webp',
        expiresInSeconds: 60,
      },
    });
    vi.mocked(verifyCourierDocumentAction).mockResolvedValue({
      ok: true,
      data: { success: true },
    });

    render(<ApplicantDetailView applicant={mockApplicant} />);

    fireEvent.click(screen.getByRole('button', { name: /cargar documento seguro/i }));
    await screen.findByRole('img', { name: /documento dni frente/i });

    const rejectBtn = screen.getByRole('button', { name: /rechazar documento/i });
    fireEvent.click(rejectBtn);

    // Debe abrirse el diálogo oficial con role="dialog"
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    const textarea = screen.getByLabelText(/motivo del rechazo/i);
    const form = textarea.closest('form')!;

    // Intentar submit vacío debe bloquearse por RHF + Zod
    fireEvent.submit(form);
    expect(verifyCourierDocumentAction).not.toHaveBeenCalled();

    // Escribir motivo real y enviar
    fireEvent.change(textarea, {
      target: { value: 'La imagen del DNI está borrosa y no se distingue el número.' },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(verifyCourierDocumentAction).toHaveBeenCalledWith({
        documentId: 'd0000000-0000-0000-0000-000000000001',
        verified: false,
        rejectionReason: 'La imagen del DNI está borrosa y no se distingue el número.',
      });
      // Jamás debe enviar la cadena hardcodeada
      expect(verifyCourierDocumentAction).not.toHaveBeenCalledWith(
        expect.objectContaining({
          rejectionReason: 'Rechazado en revisión visual administrativa',
        })
      );
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('5. abre el Dialog oficial de decisión global sobre el postulante y llama a decideCourierAction (PR106-H13, PR106-H14)', async () => {
    vi.mocked(decideCourierAction).mockResolvedValue({
      ok: true,
      data: { success: true },
    });

    render(<ApplicantDetailView applicant={mockApplicant} />);

    const approveApplicantBtn = screen.getByRole('button', { name: /aprobar repartidor/i });
    fireEvent.click(approveApplicantBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Aprobar repartidor' })).toBeDefined();

    const textarea = screen.getByLabelText(/motivo de la decisión/i);
    const form = textarea.closest('form')!;

    // Validar que submit vacío no llama a la acción
    fireEvent.submit(form);
    expect(decideCourierAction).not.toHaveBeenCalled();

    fireEvent.change(textarea, {
      target: { value: 'Documentación completa y verificada correctamente para el piloto Aguilares.' },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(decideCourierAction).toHaveBeenCalledWith({
        courierId: 'a0000000-0000-0000-0000-000000000001',
        decision: 'approved',
        reason: 'Documentación completa y verificada correctamente para el piloto Aguilares.',
      });
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('6. con repartidor aprobado, permite suspender mediante el Dialog oficial y suspendCourierAction', async () => {
    vi.mocked(suspendCourierAction).mockResolvedValue({
      ok: true,
      data: { success: true },
    });

    const approvedApplicant: ApplicantDetail = {
      ...mockApplicant,
      status: 'approved',
    };

    render(<ApplicantDetailView applicant={approvedApplicant} />);

    const suspendBtn = screen.getByRole('button', { name: /suspender repartidor/i });
    fireEvent.click(suspendBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Suspender repartidor' })).toBeDefined();

    const textarea = screen.getByLabelText(/motivo de la decisión/i);
    const form = textarea.closest('form')!;

    fireEvent.change(textarea, {
      target: { value: 'Reclamos reiterados de comercios por pedidos dañados en tránsito.' },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(suspendCourierAction).toHaveBeenCalledWith({
        courierId: 'a0000000-0000-0000-0000-000000000001',
        reason: 'Reclamos reiterados de comercios por pedidos dañados en tránsito.',
      });
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('7. Escape cierra el Dialog de rechazo y devuelve el foco al botón disparador', async () => {
    vi.mocked(viewCourierDocumentAction).mockResolvedValue({
      ok: true,
      data: {
        signedUrl: 'https://example.com/signed/dni_front.webp',
        expiresInSeconds: 60,
      },
    });

    render(<ApplicantDetailView applicant={mockApplicant} />);

    fireEvent.click(screen.getByRole('button', { name: /cargar documento seguro/i }));
    await screen.findByRole('img', { name: /documento dni frente/i });

    const rejectButton = screen.getByRole('button', { name: /rechazar documento/i });
    rejectButton.focus();
    expect(document.activeElement).toBe(rejectButton);

    fireEvent.click(rejectButton);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(rejectButton);
    });
  });

  it('8. rota el visor en cuatro pasos usando solo utilidades Tailwind válidas', async () => {
    vi.mocked(viewCourierDocumentAction).mockResolvedValue({
      ok: true,
      data: {
        signedUrl: 'https://example.com/signed/dni_front.webp',
        expiresInSeconds: 60,
      },
    });

    render(<ApplicantDetailView applicant={mockApplicant} />);

    fireEvent.click(screen.getByRole('button', { name: /cargar documento seguro/i }));
    const image = await screen.findByRole('img', { name: /documento dni frente/i });
    const rotateButton = screen.getByRole('button', { name: /rotar 90 grados/i });

    fireEvent.click(rotateButton);
    expect(image.className).toContain('rotate-90');

    fireEvent.click(rotateButton);
    expect(image.className).toContain('rotate-180');

    fireEvent.click(rotateButton);
    expect(image.className).toContain('-rotate-90');
    expect(image.className).not.toContain('rotate-270');

    fireEvent.click(rotateButton);
    expect(image.className).toContain('rotate-0');
  });

  it('9. DoD T-354: muestra el tab con el nombre completo «Selfie con el DNI» cuando hay documento selfie', () => {
    const applicantWithSelfie: ApplicantDetail = {
      ...mockApplicant,
      documents: [
        ...mockApplicant.documents,
        {
          id: 'd0000000-0000-0000-0000-000000000003',
          documentType: 'selfie',
          storagePath: 'courier-docs/selfie.webp',
          status: 'submitted',
          uploadedAt: '2026-09-20T10:07:00.000Z',
        },
      ],
    };

    render(<ApplicantDetailView applicant={applicantWithSelfie} />);
    const tabs = screen.getAllByRole('tab');
    const selfieTab = tabs.find((t) => t.textContent?.includes('Selfie'));
    expect(selfieTab).toBeDefined();
    expect(selfieTab?.textContent).toContain('Selfie con el DNI');
  });

  it('10. DoD T-354: ApplicantsQueue renderiza badge «Selfie con el DNI ✓» cuando hasSelfie es true', () => {
    const applicantItem: ApplicantListItem = {
      id: 'a0000000-0000-0000-0000-000000000001',
      fullName: 'Juan Repartidor',
      dniHash: 'hash-1234',
      phone: '3865123456',
      vehicleType: 'moto',
      docLevel: 1,
      createdAt: '2026-09-20T10:00:00.000Z',
      status: 'pending',
      licenseStatus: 'none',
      insuranceStatus: 'none',
      documentsSummary: {
        hasDniFront: true,
        hasDniBack: true,
        hasSelfie: true,
        hasLicense: false,
        hasInsurance: false,
      },
    };

    render(<ApplicantsQueue initialTab="pending" applicants={[applicantItem]} />);
    expect(screen.getByText(/Selfie con el DNI/)).toBeDefined();
    expect(screen.getByText(/Selfie con el DNI\s*✓/)).toBeDefined();
  });

  it('11. CC-025 / T-356: distingue documento vigente (revisable) de histórico (deshabilitado)', async () => {
    vi.mocked(viewCourierDocumentAction).mockResolvedValue({
      ok: true,
      data: {
        signedUrl: 'https://example.com/signed/license.webp',
        expiresInSeconds: 60,
      },
    });

    const applicantWithHistory: ApplicantDetail = {
      ...mockApplicant,
      documents: [
        {
          id: 'd0000000-0000-0000-0000-000000000004',
          documentType: 'license',
          storagePath: 'courier-docs/license_v1.webp',
          status: 'rejected',
          uploadedAt: '2026-10-16T10:00:00.000Z',
          isCurrent: false,
        },
        {
          id: 'd0000000-0000-0000-0000-000000000003',
          documentType: 'license',
          storagePath: 'courier-docs/license_v2.webp',
          status: 'submitted',
          uploadedAt: '2026-10-17T10:00:00.000Z',
          isCurrent: true,
        },
      ],
    };

    render(<ApplicantDetailView applicant={applicantWithHistory} />);

    // Verifica que la pestaña del histórico indique «(Histórico)»
    const tabs = screen.getAllByRole('tab');
    const historicTab = tabs.find((t) => t.textContent?.includes('Histórico'));
    expect(historicTab).toBeDefined();
    expect(historicTab?.textContent).toContain('Licencia de Conducir (Histórico)');

    // Selecciona el documento histórico
    if (historicTab) {
      fireEvent.click(historicTab);
    }

    // Carga el documento histórico
    const loadButtons = screen.getAllByRole('button', { name: /cargar documento seguro/i });
    fireEvent.click(loadButtons[loadButtons.length - 1] ?? loadButtons[0]!);

    await screen.findByRole('img');

    // Comprueba que los botones de verificar y rechazar están deshabilitados
    const rejectBtn = screen.getByRole('button', { name: /rechazar documento/i });
    const verifyBtn = screen.getByRole('button', { name: /verificar documento/i });
    expect((rejectBtn as HTMLButtonElement).disabled).toBe(true);
    expect((verifyBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/documento histórico/i)).toBeDefined();
  });
});


describe('T-380: reactivar o reconsiderar con reinstateCourierAction (CC-034)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const REASON = 'Se revisó el reclamo y no hubo falta del repartidor.';

  function openReinstateDialog(status: 'suspended' | 'rejected', buttonName: RegExp) {
    render(<ApplicantDetailView applicant={{ ...mockApplicant, status }} />);
    fireEvent.click(screen.getByRole('button', { name: buttonName }));
    const textarea = screen.getByLabelText(/motivo de la decisión/i);
    fireEvent.change(textarea, { target: { value: REASON } });
    return screen.getByRole('button', { name: /confirmar decisión/i });
  }

  it.each([
    ['suspended' as const, /reactivar repartidor/i, 'Reactivar repartidor'],
    ['rejected' as const, /reconsiderar aprobación/i, 'Reconsiderar aprobación'],
  ])('con estado %s, el botón abre su diálogo y llama a reinstateCourierAction (no a decideCourierAction)', async (status, buttonName, title) => {
    vi.mocked(reinstateCourierAction).mockResolvedValue({ ok: true, data: { success: true, idempotent: false } });

    const confirm = openReinstateDialog(status, buttonName);
    expect(screen.getByRole('heading', { name: title })).toBeDefined();
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(reinstateCourierAction).toHaveBeenCalledWith({ courierId: mockApplicant.id, reason: REASON });
      expect(refresh).toHaveBeenCalled();
    });
    expect(decideCourierAction).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('el motivo es obligatorio: sin texto no llama a la acción', async () => {
    render(<ApplicantDetailView applicant={{ ...mockApplicant, status: 'suspended' }} />);
    fireEvent.click(screen.getByRole('button', { name: /reactivar repartidor/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar decisión/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(reinstateCourierAction).not.toHaveBeenCalled();
  });

  it('doble clic en confirmar no duplica la llamada y el botón queda deshabilitado durante la acción', async () => {
    let resolveAction: (value: Awaited<ReturnType<typeof reinstateCourierAction>>) => void = () => undefined;
    vi.mocked(reinstateCourierAction).mockImplementation(
      () => new Promise((resolve) => {
        resolveAction = resolve;
      })
    );

    const confirm = openReinstateDialog('suspended', /reactivar repartidor/i);
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(reinstateCourierAction).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect((screen.getByRole('button', { name: /procesando/i }) as HTMLButtonElement).disabled).toBe(true)
    );
    fireEvent.click(screen.getByRole('button', { name: /procesando/i }));

    resolveAction({ ok: true, data: { success: true, idempotent: false } });
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(reinstateCourierAction).toHaveBeenCalledTimes(1);
  });

  it('dos envíos seguidos del formulario (clic y Enter) no duplican la llamada', async () => {
    let resolveAction: (value: Awaited<ReturnType<typeof reinstateCourierAction>>) => void = () => undefined;
    vi.mocked(reinstateCourierAction).mockImplementation(
      () => new Promise((resolve) => {
        resolveAction = resolve;
      })
    );

    const confirm = openReinstateDialog('suspended', /reactivar repartidor/i);
    const form = confirm.closest('form');
    if (!form) throw new Error('el botón de confirmar tiene que estar dentro del formulario');
    fireEvent.submit(form);
    await waitFor(() => expect(reinstateCourierAction).toHaveBeenCalledTimes(1));
    // El segundo envío se entrega dentro de act: la validación y el handler terminan antes de afirmar.
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(reinstateCourierAction).toHaveBeenCalledTimes(1);

    resolveAction({ ok: true, data: { success: true, idempotent: false } });
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(reinstateCourierAction).toHaveBeenCalledTimes(1);
  });

  it('idempotent: true (ya estaba aprobado) se trata como éxito', async () => {
    vi.mocked(reinstateCourierAction).mockResolvedValue({ ok: true, data: { success: true, idempotent: true } });

    fireEvent.click(openReinstateDialog('suspended', /reactivar repartidor/i));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('INVALID_STATE_TRANSITION muestra un mensaje claro en el diálogo, no el genérico ni el de pedidos', async () => {
    vi.mocked(reinstateCourierAction).mockResolvedValue({ ok: false, code: 'INVALID_STATE_TRANSITION' });

    fireEvent.click(openReinstateDialog('rejected', /reconsiderar aprobación/i));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      'El estado actual del repartidor no permite este cambio. Actualizá la página para ver su estado.'
    );
    expect(screen.queryByText(/inconveniente inesperado/i)).toBeNull();
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('la primera decisión (pendiente) también muestra el mensaje claro ante INVALID_STATE_TRANSITION', async () => {
    vi.mocked(decideCourierAction).mockResolvedValue({ ok: false, code: 'INVALID_STATE_TRANSITION' });

    render(<ApplicantDetailView applicant={mockApplicant} />);
    fireEvent.click(screen.getByRole('button', { name: /aprobar repartidor/i }));
    fireEvent.change(screen.getByLabelText(/motivo de la decisión/i), { target: { value: REASON } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar decisión/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      'El estado actual del repartidor no permite este cambio. Actualizá la página para ver su estado.'
    );
    expect(reinstateCourierAction).not.toHaveBeenCalled();
  });
});

describe('T-376 / CC-033: señal de documento opcional en revisión en la cola de aprobados', () => {
  function approved(overrides: Partial<ApplicantListItem>): ApplicantListItem {
    return {
      id: 'a0000000-0000-0000-0000-000000000376',
      fullName: 'Rita Repartidora',
      dniHash: 'hash-376',
      phone: '3865000376',
      vehicleType: 'moto',
      docLevel: 1,
      createdAt: '2026-10-20T10:00:00.000Z',
      status: 'approved',
      licenseStatus: 'verified',
      insuranceStatus: 'none',
      documentsSummary: { hasDniFront: true, hasDniBack: true, hasSelfie: true, hasLicense: true, hasInsurance: false },
      ...overrides,
    };
  }

  it.each([
    ['seguro', { insuranceStatus: 'submitted', documentsSummary: { hasDniFront: true, hasDniBack: true, hasSelfie: true, hasLicense: true, hasInsurance: true } }],
    ['licencia', { licenseStatus: 'submitted' }],
  ] as const)('un aprobado con %s en revisión muestra «Documento opcional en revisión»', (_case, overrides) => {
    render(<ApplicantsQueue initialTab="approved" applicants={[approved(overrides)]} />);
    expect(screen.getByText('Documento opcional en revisión')).toBeDefined();
  });

  it('sin documentos opcionales en revisión no muestra la señal', () => {
    render(
      <ApplicantsQueue
        initialTab="approved"
        applicants={[approved({ insuranceStatus: 'verified', documentsSummary: { hasDniFront: true, hasDniBack: true, hasSelfie: true, hasLicense: true, hasInsurance: true } })]}
      />
    );
    expect(screen.queryByText('Documento opcional en revisión')).toBeNull();
  });
});
