// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { StepIndicator } from './components/step-indicator';
import { IdentityForm } from './components/identity-form';
import { VehicleForm } from './components/vehicle-form';
import { StatusView } from './components/status-view';
import {
  CourierProfileView,
  combineDniDocumentStatus,
  getDocumentStatusPresentation,
  type DocumentReviewStatus,
} from './components/courier-profile-view';
import * as actionsModule from './actions';
import { vehiclePlateSchema } from './schemas';
import * as uploadManager from './upload-manager';
import { compressImage } from '@/lib/image-compression';

const { mockUploadCourierDocument } = vi.hoisted(() => ({
  mockUploadCourierDocument: vi.fn(),
}));

vi.mock('@/lib/image-compression', () => ({
  compressImage: vi.fn((file: File) => Promise.resolve(file)),
}));

vi.mock('./upload-manager', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    uploadCourierDocument: mockUploadCourierDocument,
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('T-121 · PR77-H08: Pruebas de componentes de onboarding R01, R02, R03', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe('StepIndicator', () => {
    it('renderiza los cuatro pasos y marca el paso activo', () => {
      render(<StepIndicator currentStep={2} />);
      expect(screen.getByText('Datos')).toBeDefined();
      expect(screen.getByText('Identidad')).toBeDefined();
      expect(screen.getByText('Vehículo')).toBeDefined();
      expect(screen.getByText('Listo')).toBeDefined();
    });
  });

  describe('IdentityForm (R01)', () => {
    it('renderiza banner de seguridad, input de DNI y tarjetas de los 4 documentos obligatorios', () => {
      render(<IdentityForm courierId="test-courier" />);

      // Banner de seguridad
      expect(screen.getByText('Verificación de seguridad')).toBeDefined();

      // Input de DNI
      const dniInput = screen.getByLabelText(/Número de DNI/i);
      expect(dniInput).toBeDefined();

      // Las 4 tarjetas obligatorias
      expect(screen.getByText('DNI frente')).toBeDefined();
      expect(screen.getByText('DNI dorso')).toBeDefined();
      expect(screen.getByText('Selfie de validación')).toBeDefined();
      expect(screen.getByText('Foto de perfil')).toBeDefined();

      // Botón Continuar deshabilitado inicialmente
      const continueBtn = screen.getByRole('button', { name: /Continuar/i });
      expect((continueBtn as HTMLButtonElement).disabled).toBe(true);
    });

    it('el input de DNI declara inputmode="numeric" para teclado numérico móvil', () => {
      render(<IdentityForm courierId="test-courier" />);
      const dniInput = screen.getByLabelText(/Número de DNI/i);
      expect(dniInput.getAttribute('inputmode')).toBe('numeric');
    });

    it('muestra error de validación cuando el DNI no tiene 7 u 8 dígitos', async () => {
      render(<IdentityForm courierId="test-courier" />);
      const dniInput = screen.getByLabelText(/Número de DNI/i);

      fireEvent.change(dniInput, { target: { value: '123' } });
      fireEvent.blur(dniInput);

      await waitFor(() => {
        expect(screen.getByText(/El DNI debe tener 7 u 8 dígitos numéricos/i)).toBeDefined();
      });
    });
  });

  describe('VehicleForm (R02)', () => {
    it('renderiza selector de transporte 2x2, campo de patente condicional y consentimientos obligatorios', () => {
      render(<VehicleForm courierId="test-courier" initialDni="38123456" />);

      expect(screen.getByText('Elegí cómo vas a repartir')).toBeDefined();
      expect(screen.getByText('A pie')).toBeDefined();
      expect(screen.getByText('Bici')).toBeDefined();
      expect(screen.getByText('Moto')).toBeDefined();
      expect(screen.getByText('Auto')).toBeDefined();

      // Para Moto, el campo de patente está presente
      expect(screen.getByLabelText(/Patente del vehículo/i)).toBeDefined();

      // Los 3 consentimientos
      expect(screen.getByText(/Términos para repartidores/i)).toBeDefined();
      expect(screen.getByText(/Política de privacidad/i)).toBeDefined();
      expect(screen.getByText(/cadeApp no me emplea ni cobra por mí/i)).toBeDefined();
      expect(screen.getByRole('checkbox', { name: /términos para repartidores/i })).toBeDefined();
      expect(screen.getByRole('checkbox', { name: /política de privacidad/i })).toBeDefined();
      expect(screen.getByRole('checkbox', { name: /cadeapp no me emplea ni cobra por mí/i })).toBeDefined();

      // Botón de envío
      expect(screen.getByRole('button', { name: /Enviar para revisión/i })).toBeDefined();
    });

    it('oculta patente, licencia y seguro al seleccionar "A pie" o "Bici"', async () => {
      render(<VehicleForm courierId="test-courier" initialDni="38123456" />);

      // Inicialmente (Moto) están visibles patente, licencia y seguro
      expect(screen.getByLabelText(/Patente del vehículo/i)).toBeDefined();
      expect(screen.getByText('Licencia de conducir')).toBeDefined();
      expect(screen.getByText('Seguro')).toBeDefined();

      const walkText = screen.getByText('A pie');
      fireEvent.click(walkText);

      await waitFor(() => {
        expect(screen.queryByLabelText(/Patente del vehículo/i)).toBeNull();
        expect(screen.queryByText('Licencia de conducir')).toBeNull();
        expect(screen.queryByText('Seguro')).toBeNull();
      });

      const bikeText = screen.getByText('Bici');
      fireEvent.click(bikeText);

      await waitFor(() => {
        expect(screen.queryByLabelText(/Patente del vehículo/i)).toBeNull();
        expect(screen.queryByText('Licencia de conducir')).toBeNull();
        expect(screen.queryByText('Seguro')).toBeNull();
      });
    });

    it('valida formato de patente argentina cuando se selecciona Moto', async () => {
      render(<VehicleForm courierId="test-courier" initialDni="38123456" />);

      const plateInput = screen.getByLabelText(/Patente del vehículo/i);
      fireEvent.change(plateInput, { target: { value: 'INVALID' } });
      fireEvent.blur(plateInput);

      await waitFor(() => {
        expect(screen.getByText(/Formato de patente inválido/i)).toBeDefined();
      });
    });

    it.each([
      ['AB 123 CD', true],
      ['AB123CD', true],
      ['ABC 123', true],
      ['ABC123', true],
      ['ELA 666', true],
      ['ELA666', true],
      ['A 123 BCD', true],
      ['123 ABC', false],
    ])(
      'PR87-R05: la validación UI de %s coincide con el schema servidor',
      (plate, expectedValid) => {
        render(<VehicleForm courierId="test-courier" initialDni="38123456" />);

        fireEvent.change(screen.getByLabelText(/Patente del vehículo/i), {
          target: { value: plate },
        });

        for (const checkbox of screen.getAllByRole('checkbox')) {
          fireEvent.click(checkbox);
        }
        const submitButton = screen.getByRole('button', { name: /Enviar para revisión/i });
        const schemaResult = vehiclePlateSchema.safeParse(plate);

        expect(schemaResult.success).toBe(expectedValid);
        expect((submitButton as HTMLButtonElement).disabled).toBe(!schemaResult.success);
      }
    );

    it('envía el formulario exitosamente llamando a courierOnboardingAction', async () => {
      const mockAction = vi.spyOn(actionsModule, 'courierOnboardingAction').mockResolvedValue({
        ok: true,
        data: { redirectTo: '/onboarding/status' },
      });
      const onSuccess = vi.fn();

      render(
        <VehicleForm
          courierId="test-courier"
          initialDni="38123456"
          initialDocs={{
            dni_front: 'path/front.jpg',
            dni_back: 'path/back.jpg',
            selfie: 'path/selfie.jpg',
            avatar: 'path/avatar.jpg',
          }}
          onSuccess={onSuccess}
        />
      );

      const plateInput = screen.getByLabelText(/Patente del vehículo/i);
      fireEvent.change(plateInput, { target: { value: 'AB 123 CD' } });

      for (const checkbox of screen.getAllByRole('checkbox')) {
        fireEvent.click(checkbox);
      }
      const submitBtn = screen.getByRole('button', { name: /Enviar para revisión/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockAction).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('StatusView (R03)', () => {
    it('muestra el estado en revisión, la insignia y el checklist de documentos', () => {
      render(<StatusView documents={[]} />);

      expect(screen.getByText('Estamos revisando tus datos')).toBeDefined();
      expect(screen.getByText('En revisión manual')).toBeDefined();
      expect(screen.getByText('DNI frente y dorso')).toBeDefined();
      expect(screen.getByText('Selfie de seguridad')).toBeDefined();
      expect(screen.getByRole('button', { name: /Ir al panel de repartidor/i })).toBeDefined();
    });

    it('DoD T-324: muestra documentos obligatorios y opcionales como "Listo" cuando licencia y seguro están presentes (submitted o verified)', () => {
      const documents = [
        { kind: 'dni_front' as const, status: 'submitted' as const },
        { kind: 'dni_back' as const, status: 'verified' as const },
        { kind: 'selfie' as const, status: 'submitted' as const },
        { kind: 'avatar' as const, status: 'submitted' as const },
        { kind: 'license' as const, status: 'submitted' as const },
        { kind: 'insurance' as const, status: 'verified' as const },
      ];

      render(<StatusView documents={documents} />);

      expect(screen.getByText('DNI frente y dorso')).toBeDefined();
      expect(screen.getByText('Selfie de seguridad')).toBeDefined();
      expect(screen.getByText('Foto de perfil para comercios')).toBeDefined();
      expect(screen.getByText('Vehículo y consentimientos')).toBeDefined();

      // Licencia y seguro deben aparecer cargados
      const licenseRow = screen.getByText(/Licencia/).closest('div[class*="flex items-center justify-between"]');
      expect(licenseRow).toBeDefined();
      expect(licenseRow?.textContent).toContain('Listo');
      expect(licenseRow?.textContent).not.toContain('Pendiente');

      const insuranceRow = screen.getByText(/Seguro/).closest('div[class*="flex items-center justify-between"]');
      expect(insuranceRow).toBeDefined();
      expect(insuranceRow?.textContent).toContain('Listo');
      expect(insuranceRow?.textContent).not.toContain('Pendiente');
    });

    it('DoD T-324: si solo licencia está presente, licencia figura como "Listo" y seguro como "No cargado (opcional)", nunca "Pendiente"', () => {
      const documents = [
        { kind: 'dni_front' as const, status: 'submitted' as const },
        { kind: 'dni_back' as const, status: 'submitted' as const },
        { kind: 'selfie' as const, status: 'submitted' as const },
        { kind: 'avatar' as const, status: 'submitted' as const },
        { kind: 'license' as const, status: 'submitted' as const },
      ];

      render(<StatusView documents={documents} />);

      const licenseRow = screen.getByText(/Licencia/).closest('div[class*="flex items-center justify-between"]');
      expect(licenseRow?.textContent).toContain('Listo');

      const insuranceRow = screen.getByText(/Seguro/).closest('div[class*="flex items-center justify-between"]');
      expect(insuranceRow?.textContent).toContain('No cargado (opcional)');
      expect(insuranceRow?.textContent).not.toContain('Pendiente');
    });

    it('DoD T-324: si solo seguro está presente, seguro figura como "Listo" y licencia como "No cargado (opcional)", nunca "Pendiente"', () => {
      const documents = [
        { kind: 'dni_front' as const, status: 'submitted' as const },
        { kind: 'dni_back' as const, status: 'submitted' as const },
        { kind: 'selfie' as const, status: 'submitted' as const },
        { kind: 'avatar' as const, status: 'submitted' as const },
        { kind: 'insurance' as const, status: 'submitted' as const },
      ];

      render(<StatusView documents={documents} />);

      const insuranceRow = screen.getByText(/Seguro/).closest('div[class*="flex items-center justify-between"]');
      expect(insuranceRow?.textContent).toContain('Listo');

      const licenseRow = screen.getByText(/Licencia/).closest('div[class*="flex items-center justify-between"]');
      expect(licenseRow?.textContent).toContain('No cargado (opcional)');
      expect(licenseRow?.textContent).not.toContain('Pendiente');
    });

    it('DoD T-324: si ningún opcional fue cargado, ambos figuran como "No cargado (opcional)" y ninguno como "Pendiente"', () => {
      const documents = [
        { kind: 'dni_front' as const, status: 'submitted' as const },
        { kind: 'dni_back' as const, status: 'submitted' as const },
        { kind: 'selfie' as const, status: 'submitted' as const },
        { kind: 'avatar' as const, status: 'submitted' as const },
      ];

      render(<StatusView documents={documents} />);

      const licenseRow = screen.getByText(/Licencia/).closest('div[class*="flex items-center justify-between"]');
      expect(licenseRow?.textContent).toContain('No cargado (opcional)');
      expect(licenseRow?.textContent).not.toContain('Pendiente');

      const insuranceRow = screen.getByText(/Seguro/).closest('div[class*="flex items-center justify-between"]');
      expect(insuranceRow?.textContent).toContain('No cargado (opcional)');
      expect(insuranceRow?.textContent).not.toContain('Pendiente');
    });

    it('DoD T-324: distingue visual y semánticamente opcionales ausentes de un documento obligatorio faltante', () => {
      // Falta selfie (obligatorio) y seguro (opcional)
      const documents = [
        { kind: 'dni_front' as const, status: 'submitted' as const },
        { kind: 'dni_back' as const, status: 'submitted' as const },
        { kind: 'avatar' as const, status: 'submitted' as const },
        { kind: 'license' as const, status: 'submitted' as const },
      ];

      render(<StatusView documents={documents} />);

      // Obligatorio faltante muestra 'Pendiente'
      const selfieRow = screen.getByText('Selfie de seguridad').closest('div[class*="flex items-center justify-between"]');
      expect(selfieRow?.textContent).toContain('Pendiente');

      // Opcional faltante muestra 'No cargado (opcional)', NUNCA 'Pendiente'
      const insuranceRow = screen.getByText(/Seguro/).closest('div[class*="flex items-center justify-between"]');
      expect(insuranceRow?.textContent).toContain('No cargado (opcional)');
      expect(insuranceRow?.textContent).not.toContain('Pendiente');
    });

    it('H02: obligatorio con status rejected se muestra como "Observado" y NO contiene "Listo"', () => {
      const documents = [
        { kind: 'dni_front' as const, status: 'submitted' as const },
        { kind: 'dni_back' as const, status: 'submitted' as const },
        { kind: 'selfie' as const, status: 'rejected' as const },
        { kind: 'avatar' as const, status: 'submitted' as const },
      ];

      render(<StatusView documents={documents} />);

      const selfieRow = screen.getByText('Selfie de seguridad').closest('div[class*="flex items-center justify-between"]');
      expect(selfieRow?.textContent).toContain('Observado');
      expect(selfieRow?.textContent).not.toContain('Listo');
    });

    it('H02: opcional con status rejected se muestra como "Observado", NO "Listo" y NO "No cargado (opcional)"', () => {
      const documents = [
        { kind: 'dni_front' as const, status: 'submitted' as const },
        { kind: 'dni_back' as const, status: 'submitted' as const },
        { kind: 'selfie' as const, status: 'submitted' as const },
        { kind: 'avatar' as const, status: 'submitted' as const },
        { kind: 'insurance' as const, status: 'rejected' as const },
      ];

      render(<StatusView documents={documents} />);

      const insuranceRow = screen.getByText(/Seguro/).closest('div[class*="flex items-center justify-between"]');
      expect(insuranceRow?.textContent).toContain('Observado');
      expect(insuranceRow?.textContent).not.toContain('Listo');
      expect(insuranceRow?.textContent).not.toContain('No cargado (opcional)');
    });

    it.each([
      ['solo dni_front presente', [{ kind: 'dni_front' as const, status: 'submitted' as const }]],
      ['solo dni_back presente', [{ kind: 'dni_back' as const, status: 'submitted' as const }]],
    ])('H04: DNI incompleto (%s) muestra "DNI frente y dorso" como "Pendiente"', (_, docs) => {
      const documents = [
        ...docs,
        { kind: 'selfie' as const, status: 'submitted' as const },
        { kind: 'avatar' as const, status: 'submitted' as const },
      ];

      render(<StatusView documents={documents} />);

      const dniRow = screen.getByText('DNI frente y dorso').closest('div[class*="flex items-center justify-between"]');
      expect(dniRow?.textContent).toContain('Pendiente');
      expect(dniRow?.textContent).not.toContain('Listo');
    });

    it('H04: avatar faltante con dni_front, dni_back y selfie presentes muestra "Foto de perfil para comercios" como "Pendiente"', () => {
      const documents = [
        { kind: 'dni_front' as const, status: 'submitted' as const },
        { kind: 'dni_back' as const, status: 'submitted' as const },
        { kind: 'selfie' as const, status: 'submitted' as const },
      ];

      render(<StatusView documents={documents} />);

      const avatarRow = screen.getByText('Foto de perfil para comercios').closest('div[class*="flex items-center justify-between"]');
      expect(avatarRow?.textContent).toContain('Pendiente');
      expect(avatarRow?.textContent).not.toContain('Listo');
    });

    it.each([
      [
        'frente rechazado y dorso ausente',
        [{ kind: 'dni_front' as const, status: 'rejected' as const }],
      ],
      [
        'dorso rechazado y frente ausente',
        [{ kind: 'dni_back' as const, status: 'rejected' as const }],
      ],
    ])('H05: DNI con %s muestra "DNI frente y dorso" como "Observado"', (_, documents) => {
      render(<StatusView documents={documents} />);
      const dniRow = screen
        .getByText('DNI frente y dorso')
        .closest('div[class*="flex items-center justify-between"]');
      expect(dniRow?.textContent).toContain('Observado');
      expect(dniRow?.textContent).not.toContain('Pendiente');
      expect(dniRow?.textContent).not.toContain('Listo');
    });

    it('DoD T-324: no lee ni escribe en sessionStorage', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      render(<StatusView documents={[]} />);

      expect(getItemSpy).not.toHaveBeenCalled();
      expect(setItemSpy).not.toHaveBeenCalled();
    });
  });

  describe('CourierProfileView (R08) y estados documentales reales (PR87-H03)', () => {
    it('combineDniDocumentStatus combina frente y dorso con none|submitted|verified|rejected', () => {
      expect(combineDniDocumentStatus('verified', 'verified')).toBe('verified');
      expect(combineDniDocumentStatus('verified', 'submitted')).toBe('submitted');
      expect(combineDniDocumentStatus('submitted', 'none')).toBe('submitted');
      expect(combineDniDocumentStatus('verified', 'rejected')).toBe('rejected');
      expect(combineDniDocumentStatus('rejected', 'none')).toBe('rejected');
      expect(combineDniDocumentStatus('none', 'none')).toBe('none');
    });

    it('getDocumentStatusPresentation mapea submitted a "En revisión" y verified a "Validado por admin"', () => {
      expect(getDocumentStatusPresentation('verified')).toEqual({
        variant: 'verified',
        label: 'Validado por admin',
      });
      expect(getDocumentStatusPresentation('submitted')).toEqual({
        variant: 'declared',
        label: 'En revisión',
      });
      expect(getDocumentStatusPresentation('rejected')).toEqual({
        variant: 'destructive',
        label: 'Observado',
      });
      expect(getDocumentStatusPresentation('none')).toEqual({
        variant: 'outline',
        label: 'No cargado',
      });
      expect(() =>
        getDocumentStatusPresentation('pending' as unknown as DocumentReviewStatus)
      ).toThrow(/Estado documental no soportado/);
    });

    it('renderiza CourierProfileView con los 4 estados documentales reales y EmptyState cuando profile es null', () => {
      const { unmount } = render(
        <CourierProfileView
          profile={{
            displayName: 'Carlos Gómez',
            email: 'carlos@test.com',
            vehicleType: 'motorcycle',
            plate: 'AB 123 CD',
            dniStatus: 'verified',
            selfieStatus: 'submitted',
            licenseStatus: 'rejected',
            insuranceStatus: 'none',
            courierStatus: 'approved',
            onboardingComplete: true,
          }}
        />
      );

      expect(screen.getByText('Validado por admin')).toBeDefined();
      expect(screen.getByText('En revisión')).toBeDefined();
      expect(screen.getByText('Observado')).toBeDefined();
      expect(screen.getByText('No cargado')).toBeDefined();
      unmount();

      render(<CourierProfileView profile={null} />);
      expect(screen.getByText(/Todavía no completaste tu legajo de repartidor/i)).toBeDefined();
    });

    describe('T-334: repartidor recién registrado sin onboarding enviado', () => {
      const freshCourier = {
        displayName: 'Repartidor Nuevo',
        email: 'nuevo@test.com',
        vehicleType: null,
        plate: null,
        dniStatus: 'none',
        selfieStatus: 'none',
        licenseStatus: 'none',
        insuranceStatus: 'none',
        courierStatus: 'pending',
      } as const;

      it('muestra «Completá tu registro» con enlace para continuar y nunca «En revisión administrativa»', () => {
        render(<CourierProfileView profile={{ ...freshCourier, onboardingComplete: false }} />);

        expect(screen.getAllByText('Completá tu registro').length).toBeGreaterThan(0);
        expect(screen.queryByText('En revisión administrativa')).toBeNull();
        const continuar = screen.getByRole('link', { name: /continuar registro/i });
        expect(continuar.getAttribute('href')).toBe('/courier/onboarding/identity');
      });

      it('control: un repartidor que sí envió todo sigue viendo «En revisión administrativa»', () => {
        render(
          <CourierProfileView
            profile={{
              ...freshCourier,
              vehicleType: 'moto',
              dniStatus: 'submitted',
              selfieStatus: 'submitted',
              onboardingComplete: true,
            }}
          />
        );

        expect(screen.getByText('En revisión administrativa')).toBeDefined();
        expect(screen.queryByText('Completá tu registro')).toBeNull();
        expect(screen.queryByRole('link', { name: /continuar registro/i })).toBeNull();
      });
    });
  });

  describe('T-322 / PR167-H04: eliminación de fallbacks temp-courier en componentes', () => {
    it('IdentityForm no utiliza valor por defecto temp-courier ni temp-courier-id al subir documentos', async () => {
      mockUploadCourierDocument.mockReset();
      mockUploadCourierDocument.mockResolvedValue({ storagePath: 'courier/mock/path.jpg' });

      // Render sin prop courierId (ejerciendo la ausencia de prop)
      const { container, unmount } = render(
        <IdentityForm {...({} as unknown as { courierId: string })} />
      );
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).not.toBeNull();

      const fakeFile = new File(['fake-content'], 'dni_front.jpg', { type: 'image/jpeg' });
      Object.defineProperty(fileInput, 'files', {
        value: [fakeFile],
        configurable: true,
      });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockUploadCourierDocument).toHaveBeenCalled();
      });

      const call = mockUploadCourierDocument.mock.calls[0]?.[0];
      // Si se reintroduce courierId = 'temp-courier-id' o 'temp-courier', este test falla inmediatamente.
      expect(call?.courierId).toBeUndefined();
      expect(call?.courierId).not.toBe('temp-courier-id');
      expect(call?.courierId).not.toBe('temp-courier');
      unmount();
    });

    it('VehicleForm no utiliza valor por defecto temp-courier ni temp-courier-id al subir opcionales', async () => {
      mockUploadCourierDocument.mockReset();
      mockUploadCourierDocument.mockResolvedValue({ storagePath: 'courier/mock/path.jpg' });

      // Render sin prop courierId (ejerciendo la ausencia de prop)
      const { container, unmount } = render(
        <VehicleForm {...({} as unknown as { courierId: string })} initialDni="12345678" />
      );
      const optionalFileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(optionalFileInput).not.toBeNull();

      const fakeFile = new File(['fake-lic'], 'lic.jpg', { type: 'image/jpeg' });
      Object.defineProperty(optionalFileInput, 'files', {
        value: [fakeFile],
        configurable: true,
      });
      fireEvent.change(optionalFileInput);

      await waitFor(() => {
        expect(mockUploadCourierDocument).toHaveBeenCalled();
      });

      const call = mockUploadCourierDocument.mock.calls[0]?.[0];
      // Si se reintroduce courierId = 'temp-courier-id' o 'temp-courier', este test falla inmediatamente.
      expect(call?.courierId).toBeUndefined();
      expect(call?.courierId).not.toBe('temp-courier-id');
      expect(call?.courierId).not.toBe('temp-courier');
      unmount();
    });

    it('IdentityForm y VehicleForm usan el courierId real provisto sin alteraciones', async () => {
      mockUploadCourierDocument.mockReset();
      mockUploadCourierDocument.mockResolvedValue({ storagePath: 'courier/mock/path.jpg' });

      const { container, unmount } = render(<IdentityForm courierId="usr-real-123" />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const fakeFile = new File(['fake'], 'dni_front.jpg', { type: 'image/jpeg' });
      Object.defineProperty(fileInput, 'files', {
        value: [fakeFile],
        configurable: true,
      });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockUploadCourierDocument).toHaveBeenCalled();
      });

      expect(mockUploadCourierDocument.mock.calls[0]?.[0]?.courierId).toBe('usr-real-123');
      unmount();
    });
  });
});

/** Promesa controlable para observar estados intermedios (optimizando/subiendo). */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function selectFile(input: HTMLElement, name: string) {
  const file = new File(['img'], name, { type: 'image/jpeg' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
  return file;
}

/** Tarjeta de subida que contiene al input asociado a `label`. */
function uploadCard(label: RegExp) {
  const input = screen.getByLabelText(label);
  const card = input.closest('[data-slot="document-upload-card"]');
  if (!(card instanceof HTMLElement)) throw new Error(`No document-upload-card for ${label}`);
  return { input: input as HTMLInputElement, card };
}

function acceptConsentsWithPlate() {
  fireEvent.change(screen.getByLabelText(/Patente del vehículo/i), {
    target: { value: 'AB 123 CD' },
  });
  for (const checkbox of screen.getAllByRole('checkbox')) fireEvent.click(checkbox);
}

describe('T-325: licencia y seguro usan el mismo sistema de carga que el paso 2', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    // mockReset descarta implementaciones `Once` que un test fallido haya dejado sin consumir.
    mockUploadCourierDocument.mockReset();
    vi.mocked(compressImage)
      .mockReset()
      .mockImplementation((file: File) => Promise.resolve(file));
  });

  const OPTIONAL_DOCS = [
    { kind: 'license', label: /Licencia de conducir/, subtitle: 'Frente y dorso (opcional)' },
    { kind: 'insurance', label: /Seguro/, subtitle: 'Póliza vigente (opcional)' },
  ] as const;

  it('el paso 2 y el paso 3 renderizan la misma tarjeta compartida de subida', () => {
    const { container, unmount } = render(<IdentityForm courierId="c-1" />);
    expect(container.querySelectorAll('[data-slot="document-upload-card"]')).toHaveLength(4);
    unmount();

    render(<VehicleForm courierId="c-1" initialDni="38123456" />);
    expect(uploadCard(/Licencia de conducir/).card).toBeDefined();
    expect(uploadCard(/Seguro/).card).toBeDefined();
  });

  describe.each(OPTIONAL_DOCS)('$kind', ({ kind, label, subtitle }) => {
    it('idle: input asociado a su label, subtítulo opcional, acción "Subir" y target >= 48 px', () => {
      render(<VehicleForm courierId="c-1" initialDni="38123456" />);
      const { input, card } = uploadCard(label);

      expect(input.getAttribute('type')).toBe('file');
      expect(input.id).toBe(`file-input-${kind}`);
      expect(card.getAttribute('data-status')).toBe('idle');
      expect(card.textContent).toContain(subtitle);
      expect(card.textContent).toContain('Subir');
      const target = card.querySelector(`label[for="file-input-${kind}"]`);
      expect(target?.className).toMatch(/min-h-\[56px\]/);
    });

    it('optimizando y subiendo: anuncia el estado y bloquea el input mientras sube', async () => {
      const compression = deferred<File>();
      const upload = deferred<{ storagePath: string }>();
      vi.mocked(compressImage).mockImplementationOnce(() => compression.promise);
      mockUploadCourierDocument.mockImplementationOnce(() => upload.promise);

      render(<VehicleForm courierId="c-1" initialDni="38123456" />);
      const { input, card } = uploadCard(label);
      const file = selectFile(input, `${kind}.jpg`);

      await waitFor(() => expect(card.getAttribute('data-status')).toBe('uploading'));
      expect(within(card).getByRole('status').textContent).toContain('Optimizando...');
      expect(input.disabled).toBe(true);

      compression.resolve(file);
      await waitFor(() =>
        expect(within(card).getByRole('status').textContent).toContain('Subiendo...')
      );
      expect(card.getAttribute('aria-busy')).toBe('true');

      upload.resolve({ storagePath: `courier/c-1/${kind}.jpg` });
      await waitFor(() => expect(card.getAttribute('data-status')).toBe('success'));
    });

    it('cargado: muestra el nombre del archivo y "Cargado" como en el paso 2', async () => {
      mockUploadCourierDocument.mockResolvedValueOnce({ storagePath: `courier/c-1/${kind}.jpg` });

      render(<VehicleForm courierId="c-1" initialDni="38123456" />);
      const { input, card } = uploadCard(label);
      selectFile(input, `mi-${kind}.jpg`);

      await waitFor(() => expect(card.getAttribute('data-status')).toBe('success'));
      expect(card.textContent).toContain(`mi-${kind}.jpg`);
      expect(card.textContent).toContain('Cargado');
      expect(card.getAttribute('aria-busy')).toBe('false');
    });

    it('error: no se silencia, se anuncia y ofrece "Reintentar" de forma explícita', async () => {
      mockUploadCourierDocument.mockRejectedValueOnce(new Error('network'));

      render(<VehicleForm courierId="c-1" initialDni="38123456" />);
      const { input, card } = uploadCard(label);
      selectFile(input, `${kind}.jpg`);

      await waitFor(() => expect(card.getAttribute('data-status')).toBe('error'));
      expect(within(card).getByRole('alert').textContent).toContain(
        'Error al subir. Tocá para reintentar.'
      );
      expect(card.textContent).toContain('Reintentar');
      expect(input.disabled).toBe(false);
    });

    it('reintento: después del error vuelve a subir y queda cargado', async () => {
      mockUploadCourierDocument
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce({ storagePath: `courier/c-1/${kind}.jpg` });

      render(<VehicleForm courierId="c-1" initialDni="38123456" />);
      const { input, card } = uploadCard(label);
      // En jsdom el value de un input file siempre es '', así que se observa el setter: el input se limpia
      // tras cada intento para que elegir el mismo archivo vuelva a disparar la subida en el navegador.
      const valueSetter = vi.spyOn(input, 'value', 'set');
      selectFile(input, `${kind}.jpg`);
      await waitFor(() => expect(card.getAttribute('data-status')).toBe('error'));

      expect(valueSetter).toHaveBeenCalledWith('');
      selectFile(input, `${kind}.jpg`);

      await waitFor(() => expect(card.getAttribute('data-status')).toBe('success'));
      expect(mockUploadCourierDocument).toHaveBeenCalledTimes(2);
      expect(within(card).queryByRole('alert')).toBeNull();
    });

    it('PR237-H02: el foco de teclado llega al input y la tarjeta visible lo muestra', () => {
      render(<VehicleForm courierId="c-1" initialDni="38123456" />);
      const { input, card } = uploadCard(label);

      input.focus();

      expect(document.activeElement).toBe(input);
      const classes = card.className.split(/\s+/);
      expect(classes).toContain('focus-within:ring-2');
      expect(classes).toContain('focus-within:ring-ring');
    });
  });

  // PR237-H01: un reemplazo fallido (en la compresión o en la subida) no borra el último path exitoso.
  describe.each(
    OPTIONAL_DOCS.flatMap((doc) =>
      (['compresión', 'subida'] as const).map((stage) => ({ ...doc, stage }))
    )
  )('$kind: si el reemplazo falla en la $stage', ({ kind, label, stage }) => {
    it('la tarjeta queda en error con "Reintentar" y el envío conserva el path anterior', async () => {
      const mockAction = vi.spyOn(actionsModule, 'courierOnboardingAction').mockResolvedValue({
        ok: true,
        data: { redirectTo: '/courier/onboarding/status' },
      });
      const oldPath = `courier/c-1/${kind}-old.jpg`;
      mockUploadCourierDocument.mockResolvedValueOnce({ storagePath: oldPath });

      render(<VehicleForm courierId="c-1" initialDni="38123456" onSuccess={vi.fn()} />);
      const { input, card } = uploadCard(label);
      selectFile(input, `${kind}-old.jpg`);
      await waitFor(() => expect(card.getAttribute('data-status')).toBe('success'));

      if (stage === 'compresión') {
        vi.mocked(compressImage).mockRejectedValueOnce(new Error('compression'));
      } else {
        mockUploadCourierDocument.mockRejectedValueOnce(new Error('network'));
      }
      selectFile(input, `${kind}-new.jpg`);
      await waitFor(() => expect(card.getAttribute('data-status')).toBe('error'));
      expect(card.textContent).toContain('Reintentar');

      acceptConsentsWithPlate();
      fireEvent.click(screen.getByRole('button', { name: /Enviar para revisión/i }));

      await waitFor(() => expect(mockAction).toHaveBeenCalledTimes(1));
      const payload = mockAction.mock.calls[0]?.[0] as
        | { documents?: Partial<Record<string, string>> }
        | undefined;
      expect(payload?.documents?.[kind]).toBe(oldPath);
    });
  });

  it('Consejo: mientras un opcional sube no se puede enviar; al terminar, sí', async () => {
    const mockAction = vi.spyOn(actionsModule, 'courierOnboardingAction').mockResolvedValue({
      ok: true,
      data: { redirectTo: '/courier/onboarding/status' },
    });
    const upload = deferred<{ storagePath: string }>();
    mockUploadCourierDocument.mockImplementationOnce(() => upload.promise);

    render(<VehicleForm courierId="c-1" initialDni="38123456" onSuccess={vi.fn()} />);
    acceptConsentsWithPlate();
    const submit = screen.getByRole('button', { name: /Enviar para revisión/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);

    const { input, card } = uploadCard(/Licencia de conducir/);
    selectFile(input, 'lic.jpg');
    await waitFor(() => expect(card.getAttribute('aria-busy')).toBe('true'));
    expect(submit.disabled).toBe(true);
    fireEvent.submit(submit.closest('form') as HTMLFormElement);
    expect(mockAction).not.toHaveBeenCalled();

    upload.resolve({ storagePath: 'courier/c-1/license.jpg' });
    await waitFor(() => expect(card.getAttribute('data-status')).toBe('success'));
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => expect(mockAction).toHaveBeenCalledTimes(1));
    const payload = mockAction.mock.calls[0]?.[0] as
      | { documents?: Partial<Record<string, string>> }
      | undefined;
    expect(payload?.documents?.license).toBe('courier/c-1/license.jpg');
  });

  it('Consejo: en error el texto accionable no se trunca (se lee completo a 360 px)', async () => {
    mockUploadCourierDocument.mockRejectedValueOnce(new Error('network'));

    render(<VehicleForm courierId="c-1" initialDni="38123456" />);
    const { input, card } = uploadCard(/Seguro/);
    selectFile(input, 'seg.jpg');
    await waitFor(() => expect(card.getAttribute('data-status')).toBe('error'));

    const alert = within(card).getByRole('alert');
    expect(alert.className.split(/\s+/)).not.toContain('truncate');
    expect(alert.className.split(/\s+/)).toContain('whitespace-normal');
  });

  it('siguen siendo opcionales: con licencia en error se puede enviar y no viaja una ruta falsa', async () => {
    const mockAction = vi.spyOn(actionsModule, 'courierOnboardingAction').mockResolvedValue({
      ok: true,
      data: { redirectTo: '/courier/onboarding/status' },
    });
    mockUploadCourierDocument
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ storagePath: 'courier/c-1/insurance.jpg' });

    render(<VehicleForm courierId="c-1" initialDni="38123456" onSuccess={vi.fn()} />);
    selectFile(uploadCard(/Licencia de conducir/).input, 'lic.jpg');
    await waitFor(() =>
      expect(uploadCard(/Licencia de conducir/).card.getAttribute('data-status')).toBe('error')
    );
    selectFile(uploadCard(/Seguro/).input, 'seg.jpg');
    await waitFor(() =>
      expect(uploadCard(/Seguro/).card.getAttribute('data-status')).toBe('success')
    );

    acceptConsentsWithPlate();
    const submit = screen.getByRole('button', { name: /Enviar para revisión/i });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => expect(mockAction).toHaveBeenCalledTimes(1));
    const payload = mockAction.mock.calls[0]?.[0] as
      | { documents?: Partial<Record<string, string>> }
      | undefined;
    const documents = payload?.documents;
    expect(documents?.license).toBeUndefined();
    expect(documents?.insurance).toBe('courier/c-1/insurance.jpg');
  });

  it('paso 2 conserva su flujo: error → reintento → cargado, y Continuar se habilita con los 4', async () => {
    mockUploadCourierDocument.mockImplementation(({ kind }: { kind: string }) =>
      Promise.resolve({ storagePath: `courier/c-1/${kind}.jpg` })
    );
    mockUploadCourierDocument.mockRejectedValueOnce(new Error('network'));

    render(<IdentityForm courierId="c-1" />);
    fireEvent.change(screen.getByLabelText(/Número de DNI/i), { target: { value: '38123456' } });

    const front = uploadCard(/DNI frente/);
    selectFile(front.input, 'frente.jpg');
    await waitFor(() => expect(front.card.getAttribute('data-status')).toBe('error'));
    expect(within(front.card).getByRole('alert').textContent).toContain(
      'Error al subir. Tocá para reintentar.'
    );
    selectFile(front.input, 'frente.jpg');
    await waitFor(() => expect(front.card.getAttribute('data-status')).toBe('success'));

    for (const label of [/DNI dorso/, /Selfie de validación/, /Foto de perfil/]) {
      const { input, card } = uploadCard(label);
      selectFile(input, 'doc.jpg');
      await waitFor(() => expect(card.getAttribute('data-status')).toBe('success'));
    }

    expect(screen.getByText('4 de 4 cargados')).toBeDefined();
    const continueBtn = screen.getByRole('button', { name: /Continuar/i });
    expect((continueBtn as HTMLButtonElement).disabled).toBe(false);
  });
});
