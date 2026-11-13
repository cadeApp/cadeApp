// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ApplicantDetailView } from './applicant-detail-view';
import { ApplicantsQueue } from './applicants-queue';
import {
  viewCourierDocumentAction,
  decideCourierAction,
  rejectCourierAction,
  suspendCourierAction,
  reinstateCourierAction,
  releaseCourierDniAction,
  verifyCourierDocumentAction,
} from '../actions';
import type { ApplicantDetail, ApplicantDocumentDetail, ApplicantListItem } from '../types';

const refresh = vi.fn();
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../actions', () => ({
  viewCourierDocumentAction: vi.fn(),
  decideCourierAction: vi.fn(),
  rejectCourierAction: vi.fn(),
  suspendCourierAction: vi.fn(),
  reinstateCourierAction: vi.fn(),
  releaseCourierDniAction: vi.fn(),
  verifyCourierDocumentAction: vi.fn(),
}));

const mockApplicant: ApplicantDetail = {
  id: 'a0000000-0000-0000-0000-000000000001',
  fullName: 'Juan Repartidor',
  status: 'pending',
  hasDni: true,
  applicationSubmitted: true,
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
      purgedAt: null,
    },
    {
      id: 'd0000000-0000-0000-0000-000000000002',
      documentType: 'dni_back',
      storagePath: 'courier-docs/dni_back.webp',
      status: 'submitted',
      uploadedAt: '2026-09-20T10:06:00.000Z',
      purgedAt: null,
    },
  ],
};

// CC-052: los cuatro obligatorios vigentes, verificados y sin purgar habilitan aprobar, reactivar y reconsiderar.
const verifiedRequired = (['dni_front', 'dni_back', 'selfie', 'avatar'] as const).map(
  (documentType, i): ApplicantDocumentDetail => ({
    id: `e0000000-0000-0000-0000-00000000000${i}`,
    documentType,
    storagePath: `courier-docs/${documentType}.webp`,
    status: 'verified',
    uploadedAt: '2026-09-20T10:05:00.000Z',
    isCurrent: true,
    purgedAt: null,
  })
);
const readyApplicant: ApplicantDetail = { ...mockApplicant, documents: verifiedRequired };

describe('CC-052: aprobar, reactivar y reconsiderar reflejan la guarda de documentos', () => {
  const buttons: ReadonlyArray<readonly ['pending' | 'suspended' | 'rejected', RegExp]> = [
    ['pending', /aprobar repartidor/i],
    ['suspended', /reactivar repartidor/i],
    ['rejected', /reconsiderar aprobación/i],
  ];
  const reason = /verificá DNI \(frente y dorso\), selfie y foto de perfil vigentes/i;

  it.each(buttons)('con %s y un obligatorio sin verificar, el botón queda deshabilitado con el motivo', (status, name) => {
    const selfieSubmitted = verifiedRequired.map((d) =>
      d.documentType === 'selfie' ? { ...d, status: 'submitted' as const } : d
    );
    render(<ApplicantDetailView applicant={{ ...readyApplicant, status, documents: selfieSubmitted }} />);
    const button = screen.getByRole('button', { name });
    expect(button).toHaveProperty('disabled', true);
    expect(screen.getByText(reason)).toBeDefined();
    expect(button.getAttribute('aria-describedby')).toBe('required-documents-reason');
  });

  it.each(buttons)('con %s y los cuatro verificados, el botón queda habilitado y sin motivo', (status, name) => {
    render(<ApplicantDetailView applicant={{ ...readyApplicant, status }} />);
    expect(screen.getByRole('button', { name })).toHaveProperty('disabled', false);
    expect(screen.queryByText(reason)).toBeNull();
  });

  it.each([
    ['ausente', verifiedRequired.filter((d) => d.documentType !== 'avatar')],
    ['rechazado', verifiedRequired.map((d) => (d.documentType === 'avatar' ? { ...d, status: 'rejected' as const } : d))],
    ['purgado', verifiedRequired.map((d) => (d.documentType === 'avatar' ? { ...d, purgedAt: '2026-10-01T00:00:00.000Z' } : d))],
    ['solo histórico', verifiedRequired.map((d) => (d.documentType === 'avatar' ? { ...d, isCurrent: false } : d))],
    ['duplicado', [...verifiedRequired, { ...verifiedRequired[3], id: 'e0000000-0000-0000-0000-000000000009' } as ApplicantDocumentDetail]],
  ])('la foto de perfil %s deshabilita aprobar', (_label, documents) => {
    render(<ApplicantDetailView applicant={{ ...readyApplicant, documents }} />);
    expect(screen.getByRole('button', { name: /aprobar repartidor/i })).toHaveProperty('disabled', true);
  });
});

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
        contentType: 'image',
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
        contentType: 'image',
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
        contentType: 'image',
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

    render(<ApplicantDetailView applicant={readyApplicant} />);

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
        contentType: 'image',
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
        contentType: 'image',
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

  it('T-419 (CC-042): la licencia y el seguro muestran su vehículo, para verificarlos por vehículo', () => {
    const applicantWithVehicles: ApplicantDetail = {
      ...mockApplicant,
      documents: [
        {
          id: 'd0000000-0000-0000-0000-000000000041',
          documentType: 'license',
          storagePath: 'courier/x/license_1.jpg',
          status: 'submitted',
          uploadedAt: '2026-09-20T10:08:00.000Z',
          purgedAt: null,
          vehicle: { vehicleType: 'moto', plate: 'AB 123 CD' },
        },
        {
          id: 'd0000000-0000-0000-0000-000000000042',
          documentType: 'license',
          storagePath: 'courier/x/license_2.jpg',
          status: 'verified',
          uploadedAt: '2026-09-20T10:09:00.000Z',
          purgedAt: null,
          vehicle: { vehicleType: 'car', plate: 'ELA 666' },
        },
      ],
    };

    render(<ApplicantDetailView applicant={applicantWithVehicles} />);
    const tabNames = screen.getAllByRole('tab').map((tab) => tab.textContent ?? '');
    expect(tabNames.some((name) => name.includes('Moto AB 123 CD'))).toBe(true);
    expect(tabNames.some((name) => name.includes('Automóvil ELA 666'))).toBe(true);
  });

  it('PR624-H07: dos vehículos con el mismo tipo y patente (uno archivado) no se fusionan', () => {
    const applicantWithTwins: ApplicantDetail = {
      ...mockApplicant,
      documents: [
        {
          id: 'd0000000-0000-0000-0000-000000000043',
          documentType: 'license',
          storagePath: 'courier/x/license_3.jpg',
          status: 'submitted',
          uploadedAt: '2026-09-21T10:00:00.000Z',
          purgedAt: null,
          vehicle: { vehicleType: 'moto', plate: 'AB 123 CD' },
        },
        {
          id: 'd0000000-0000-0000-0000-000000000044',
          documentType: 'license',
          storagePath: 'courier/x/license_4.jpg',
          status: 'verified',
          uploadedAt: '2026-09-01T10:00:00.000Z',
          purgedAt: null,
          isCurrent: true,
          vehicle: { vehicleType: 'moto', plate: 'AB 123 CD' },
        },
      ],
    };

    render(<ApplicantDetailView applicant={applicantWithTwins} />);
    const twinTabs = screen.getAllByRole('tab').filter((tab) => (tab.textContent ?? '').includes('Moto AB 123 CD'));
    expect(twinTabs).toHaveLength(2);
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
          purgedAt: null,
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
      hasDni: true,
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
        contentType: 'image',
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
          purgedAt: null,
          isCurrent: false,
        },
        {
          id: 'd0000000-0000-0000-0000-000000000003',
          documentType: 'license',
          storagePath: 'courier-docs/license_v2.webp',
          status: 'submitted',
          uploadedAt: '2026-10-17T10:00:00.000Z',
          purgedAt: null,
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
    render(<ApplicantDetailView applicant={{ ...readyApplicant, status }} />);
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
    render(<ApplicantDetailView applicant={{ ...readyApplicant, status: 'suspended' }} />);
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

    render(<ApplicantDetailView applicant={readyApplicant} />);
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
      hasDni: true,
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

describe('T-387: visor auditado de un PDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const pdfApplicant: ApplicantDetail = {
    ...mockApplicant,
    status: 'approved',
    insuranceStatus: 'submitted',
    documents: [
      {
        id: 'd0000000-0000-0000-0000-000000000387',
        documentType: 'insurance',
        storagePath: 'courier/a0000000-0000-0000-0000-000000000001/insurance_1730000000387.pdf',
        status: 'submitted',
        uploadedAt: '2026-10-20T10:05:00.000Z',
        purgedAt: null,
      },
    ],
  };

  const SIGNED_PDF = 'https://example.com/signed/insurance_1730000000387.pdf?token=t';

  async function loadPdf() {
    vi.mocked(viewCourierDocumentAction).mockResolvedValue({
      ok: true,
      data: { signedUrl: SIGNED_PDF, expiresInSeconds: 60, contentType: 'pdf' },
    });
    render(<ApplicantDetailView applicant={pdfApplicant} />);
    fireEvent.click(screen.getByRole('button', { name: /cargar documento seguro/i }));
    await screen.findByText(/URL temporal expira en:/i);
  }

  it('muestra el PDF embebido en un iframe sin referrer, no como imagen', async () => {
    await loadPdf();

    const frame = screen.getByTitle(/documento seguro de vehículo/i);
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('src')).toBe(SIGNED_PDF);
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(screen.queryByRole('img', { name: /documento seguro/i })).toBeNull();
  });

  it('ofrece abrir el PDF en otra pestaña sin opener ni referrer', async () => {
    await loadPdf();

    const link = screen.getByRole('link', { name: /abrir pdf en otra pestaña/i });
    expect(link.getAttribute('href')).toBe(SIGNED_PDF);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('oculta zoom y rotación, que solo aplican a fotos, y mantiene verificar y rechazar', async () => {
    await loadPdf();

    expect(screen.queryByRole('button', { name: /aumentar zoom/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /rotar 90 grados/i })).toBeNull();
    expect(screen.getByRole('button', { name: /verificar documento/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /rechazar/i })).toBeDefined();
  });

  it('una foto sigue mostrándose como imagen con zoom y rotación', async () => {
    vi.mocked(viewCourierDocumentAction).mockResolvedValue({
      ok: true,
      data: { signedUrl: 'https://example.com/signed/insurance.jpg', expiresInSeconds: 60, contentType: 'image' },
    });
    render(<ApplicantDetailView applicant={pdfApplicant} />);
    fireEvent.click(screen.getByRole('button', { name: /cargar documento seguro/i }));

    expect((await screen.findByRole('img', { name: /documento seguro/i })).getAttribute('src')).toBe(
      'https://example.com/signed/insurance.jpg'
    );
    expect(screen.queryByTitle(/documento seguro de vehículo/i)).toBeNull();
    expect(screen.getByRole('button', { name: /aumentar zoom/i })).toBeDefined();
  });

  it('un DNI que el backend admitió como PDF también se ve embebido (decisión 2 C de la PR #470)', async () => {
    vi.mocked(viewCourierDocumentAction).mockResolvedValue({
      ok: true,
      data: { signedUrl: 'https://example.com/signed/dni_front.pdf?token=t', expiresInSeconds: 60, contentType: 'pdf' },
    });
    render(<ApplicantDetailView applicant={mockApplicant} />);
    fireEvent.click(screen.getByRole('button', { name: /cargar documento seguro/i }));

    const frame = await screen.findByTitle(/documento dni frente \(pdf\)/i);
    expect(frame.tagName).toBe('IFRAME');
    expect(screen.queryByRole('img', { name: /documento dni frente/i })).toBeNull();
  });
});

describe('T-401: el hash del DNI no se muestra', () => {
  const queueItem: ApplicantListItem = {
    id: 'a0000000-0000-0000-0000-000000000401',
    fullName: 'Juan Repartidor',
    hasDni: true,
    phone: '3865123456',
    vehicleType: 'moto',
    docLevel: 1,
    createdAt: '2026-09-20T10:00:00.000Z',
    status: 'pending',
    licenseStatus: 'none',
    insuranceStatus: 'none',
    documentsSummary: { hasDniFront: true, hasDniBack: true, hasSelfie: true, hasLicense: false, hasInsurance: false },
  };

  it('la cola muestra «DNI cargado» o «DNI pendiente» y nunca «DNI Hash»', () => {
    render(
      <ApplicantsQueue
        initialTab="pending"
        applicants={[queueItem, { ...queueItem, id: 'a0000000-0000-0000-0000-000000000402', fullName: 'Ana Pendiente', hasDni: false }]}
      />
    );
    const rows = screen.getAllByRole('row');
    expect(rows.find((row) => row.textContent?.includes('Juan Repartidor'))?.textContent).toContain('DNI cargado');
    expect(rows.find((row) => row.textContent?.includes('Ana Pendiente'))?.textContent).toContain('DNI pendiente');
    expect(document.body.textContent ?? '').not.toMatch(/hash/i);
  });

  it('el detalle muestra «DNI cargado» o «DNI pendiente» y nunca «DNI Hash»', () => {
    const { unmount } = render(<ApplicantDetailView applicant={mockApplicant} />);
    expect(screen.queryByText('DNI cargado')).not.toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(/hash/i);
    unmount();

    render(<ApplicantDetailView applicant={{ ...mockApplicant, hasDni: false }} />);
    expect(screen.queryByText('DNI pendiente')).not.toBeNull();
  });
});

describe('T-404: detalle según A02', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const a02Applicant: ApplicantDetail = {
    ...mockApplicant,
    submittedAt: '2026-09-20T11:00:00.000Z',
    consents: [
      { document: 'tos', version: '2026-09', acceptedAt: '2026-09-20T10:01:00.000Z' },
      { document: 'courier_contract', version: '1', acceptedAt: '2026-09-20T10:02:00.000Z' },
    ],
    history: [
      { kind: 'registered', id: 'registered', at: '2026-09-20T10:00:00.000Z' },
      { kind: 'submitted', id: 'submitted', at: '2026-09-20T11:00:00.000Z' },
    ],
  };

  function toolbarButtons(): string[] {
    const toolbar = screen.getByRole('toolbar', { name: 'Acciones sobre el postulante' });
    return within(toolbar)
      .getAllByRole('button')
      .map((button) => button.textContent ?? '');
  }

  it('la columna de datos muestra nombre, teléfono, vehículo con patente, alta y nivel, sin CBU ni DNI', () => {
    render(<ApplicantDetailView applicant={a02Applicant} />);
    const data = screen.getByText('Datos del postulante').closest('[class*="border"]');
    const text = data?.textContent ?? '';

    expect(text).toContain('Juan Repartidor');
    expect(text).toContain('3865123456');
    expect(text).toContain('Moto · ABC 123');
    expect(text).toContain('20/09/2026');
    expect(document.body.textContent ?? '').not.toMatch(/cbu|alias bancario|DNI terminado/i);
  });

  it('los consentimientos muestran documento, versión y fecha', () => {
    render(<ApplicantDetailView applicant={a02Applicant} />);
    const items = within(screen.getByRole('list', { name: 'Consentimientos' })).getAllByRole('listitem');

    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain('Términos y condiciones');
    expect(items[0]?.textContent).toMatch(/Versión 2026-09 · 20\/09\/2026/);
    expect(items[1]?.textContent).toContain('Contrato de repartidor');
  });

  it('el historial llega a la línea de tiempo tal cual, en su orden', () => {
    render(<ApplicantDetailView applicant={a02Applicant} />);
    const items = within(screen.getByRole('list', { name: 'Historial del postulante' })).getAllByRole('listitem');
    expect(items.map((item) => item.querySelector('p')?.textContent)).toEqual(['Registrado', 'Postulación enviada']);
  });

  it.each([
    ['pending' as const, ['Rechazar postulación', 'Aprobar repartidor']],
    ['approved' as const, ['Suspender repartidor']],
    ['suspended' as const, ['Reactivar repartidor']],
    ['rejected' as const, ['Reconsiderar aprobación']],
  ])('con estado %s, la barra fija ofrece solo %j', (status, expected) => {
    render(<ApplicantDetailView applicant={{ ...a02Applicant, status }} />);
    expect(toolbarButtons()).toEqual(expected);
  });

  it('la barra es sticky al pie, dentro del flujo: reserva su alto y no tapa contenido', () => {
    render(<ApplicantDetailView applicant={a02Applicant} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Acciones sobre el postulante' });
    expect(toolbar.className).toContain('sticky');
    expect(toolbar.className).toContain('bottom-0');
    expect(toolbar.className).not.toContain('fixed');
  });

  function openReject() {
    render(<ApplicantDetailView applicant={a02Applicant} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar postulación' }));
    expect(screen.getByRole('heading', { name: 'Rechazar a Juan Repartidor' })).toBeDefined();
  }

  function chooseOption(option: string) {
    fireEvent.click(screen.getByRole('combobox', { name: /motivo/i }));
    fireEvent.click(screen.getByRole('option', { name: option }));
  }

  it('el rechazo exige elegir un motivo de la lista', async () => {
    openReject();
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));

    expect(await screen.findByText('Elegí un motivo.')).toBeDefined();
    expect(rejectCourierAction).not.toHaveBeenCalled();
  });

  it('con «Otro», el mensaje es obligatorio; con mensaje, llama a rejectCourierAction', async () => {
    vi.mocked(rejectCourierAction).mockResolvedValue({ ok: true, data: { success: true } });
    openReject();
    chooseOption('Otro');
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));

    expect(await screen.findByText('Con «Otro», escribí el mensaje para el postulante.')).toBeDefined();
    expect(rejectCourierAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/mensaje para el postulante/i), {
      target: { value: 'No coincide el barrio declarado.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));

    await waitFor(() => {
      expect(rejectCourierAction).toHaveBeenCalledWith({
        courierId: mockApplicant.id,
        option: 'Otro',
        message: 'No coincide el barrio declarado.',
      });
      expect(refresh).toHaveBeenCalled();
    });
    expect(decideCourierAction).not.toHaveBeenCalled();
  });

  it('una opción que no es «Otro» puede ir sin mensaje', async () => {
    vi.mocked(rejectCourierAction).mockResolvedValue({ ok: true, data: { success: true } });
    openReject();
    chooseOption('Foto ilegible');
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));

    await waitFor(() =>
      expect(rejectCourierAction).toHaveBeenCalledWith({
        courierId: mockApplicant.id,
        option: 'Foto ilegible',
        message: '',
      })
    );
  });

  it('regresión del visor: aviso de auditoría arriba, pestañas, zoom, rotación y «Restablecer»', async () => {
    vi.mocked(viewCourierDocumentAction).mockResolvedValue({
      ok: true,
      data: { signedUrl: 'https://example.com/signed/dni_front.webp', contentType: 'image', expiresInSeconds: 60 },
    });
    render(<ApplicantDetailView applicant={a02Applicant} />);

    const notice = screen.getByText('Este acceso queda registrado en la auditoría.');
    const tablist = screen.getByRole('tablist');
    expect(notice.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /cargar documento seguro/i }));
    const image = await screen.findByRole('img', { name: /documento dni frente/i });

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar zoom' }));
    expect(image.className).toContain('scale-125');
    fireEvent.click(screen.getByRole('button', { name: 'Rotar 90 grados' }));
    expect(image.className).toContain('rotate-90');

    fireEvent.click(screen.getByTitle('Restablecer vista'));
    expect(image.className).toContain('scale-100');
    expect(image.className).toContain('rotate-0');
  });
});

describe('CC-050 (D3-A): Liberar DNI en el detalle del postulante', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['pendiente', { status: 'pending' as const, hasDni: true }],
    ['aprobado', { status: 'approved' as const, hasDni: true }],
    ['rechazado sin DNI', { status: 'rejected' as const, hasDni: false }],
  ])('no muestra «Liberar DNI» si está %s', (_label, patch) => {
    render(<ApplicantDetailView applicant={{ ...mockApplicant, ...patch }} />);
    expect(screen.queryByRole('button', { name: 'Liberar DNI' })).toBeNull();
  });

  it.each(['rejected', 'suspended'] as const)('con %s y DNI pide motivo y llama a releaseCourierDniAction', async (status) => {
    vi.mocked(releaseCourierDniAction).mockResolvedValue({ ok: true, data: { success: true } });
    render(<ApplicantDetailView applicant={{ ...mockApplicant, status, hasDni: true }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Liberar DNI' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Liberar DNI' })).toBeDefined();
    expect(dialog.textContent).toContain('No escribas números de documento ni datos personales en el motivo');

    const textarea = within(dialog).getByLabelText(/motivo de la liberación/i);
    fireEvent.change(textarea, { target: { value: 'Reclamo verificado del titular por soporte' } });
    fireEvent.submit(textarea.closest('form')!);

    await waitFor(() => {
      expect(releaseCourierDniAction).toHaveBeenCalledWith({
        courierId: mockApplicant.id,
        reason: 'Reclamo verificado del titular por soporte',
      });
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('con un motivo de menos de 3 caracteres no llama a la acción', async () => {
    render(<ApplicantDetailView applicant={{ ...mockApplicant, status: 'rejected', hasDni: true }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Liberar DNI' }));
    const dialog = screen.getByRole('dialog');
    const textarea = within(dialog).getByLabelText(/motivo de la liberación/i);
    fireEvent.change(textarea, { target: { value: 'ab' } });
    fireEvent.submit(textarea.closest('form')!);

    await waitFor(() => expect(within(dialog).getAllByRole('alert').length).toBeGreaterThan(0));
    expect(releaseCourierDniAction).not.toHaveBeenCalled();
  });
});

describe('CC-050 (PR711-H01): una cuenta sin enviar no se decide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pendiente sin enviar: no muestra Aprobar ni Rechazar y explica por qué', () => {
    render(<ApplicantDetailView applicant={{ ...mockApplicant, status: 'pending', applicationSubmitted: false }} />);
    expect(screen.queryByRole('button', { name: /aprobar repartidor/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /rechazar postulación/i })).toBeNull();
    expect(screen.getByText(/todavía no envió el alta/i)).toBeDefined();
  });

  it('pendiente enviado: sigue mostrando Aprobar y Rechazar', () => {
    render(<ApplicantDetailView applicant={{ ...mockApplicant, status: 'pending', applicationSubmitted: true }} />);
    expect(screen.getByRole('button', { name: /aprobar repartidor/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /rechazar postulación/i })).toBeDefined();
  });
});

describe('CC-050 (PR711-H07): reactivar o reconsiderar solo con el alta enviada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['suspended', /reactivar repartidor/i],
    ['rejected', /reconsiderar aprobación/i],
  ] as const)('%s sin enviar: oculta el botón y explica por qué', (status, buttonName) => {
    render(<ApplicantDetailView applicant={{ ...mockApplicant, status, applicationSubmitted: false, hasDni: false }} />);
    expect(screen.queryByRole('button', { name: buttonName })).toBeNull();
    expect(screen.getByText(/nunca envió el alta/i)).toBeDefined();
  });

  it.each([
    ['suspended', /reactivar repartidor/i],
    ['rejected', /reconsiderar aprobación/i],
  ] as const)('%s enviado: muestra el botón', (status, buttonName) => {
    render(<ApplicantDetailView applicant={{ ...mockApplicant, status, applicationSubmitted: true }} />);
    expect(screen.getByRole('button', { name: buttonName })).toBeDefined();
  });

  it('sin enviar pero con DNI reservado: «Liberar DNI» sigue disponible', () => {
    render(<ApplicantDetailView applicant={{ ...mockApplicant, status: 'rejected', applicationSubmitted: false, hasDni: true }} />);
    expect(screen.getByRole('button', { name: 'Liberar DNI' })).toBeDefined();
  });
});
