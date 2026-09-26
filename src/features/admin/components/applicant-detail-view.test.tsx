// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApplicantDetailView } from './applicant-detail-view';
import {
  viewCourierDocumentAction,
  decideCourierAction,
  suspendCourierAction,
  verifyCourierDocumentAction,
} from '../actions';
import type { ApplicantDetail } from '../types';

const refresh = vi.fn();
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push }),
}));

vi.mock('../actions', () => ({
  viewCourierDocumentAction: vi.fn(),
  decideCourierAction: vi.fn(),
  suspendCourierAction: vi.fn(),
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
});
