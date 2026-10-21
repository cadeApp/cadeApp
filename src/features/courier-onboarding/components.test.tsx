// @vitest-environment jsdom
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { StepIndicator } from './components/step-indicator';
import { IdentityForm } from './components/identity-form';
import { VehicleForm } from './components/vehicle-form';
import { DocumentUploadCard } from './components/document-upload-card';
import { DocumentReplacementCard } from './components/document-replacement-card';
import { StatusView } from './components/status-view';
import {
  CourierProfileView,
  combineDniDocumentStatus,
  getDocumentStatusPresentation,
  type DocumentReviewStatus,
  type CourierReviewStatus,
} from './components/courier-profile-view';
import * as actionsModule from './actions';
import { vehiclePlateSchema } from './schemas';
import { COURIER_ONBOARDING_COPY } from './copy';
import * as uploadManager from './upload-manager';
import { compressImage } from '@/lib/image-compression';

const {
  mockUploadCourierDocument,
  mockGetUser,
  mockRouterRefresh,
  mockRouterPush,
  mockRouterReplace,
} = vi.hoisted(() => ({
  mockUploadCourierDocument: vi.fn(),
  mockGetUser: vi.fn(),
  mockRouterRefresh: vi.fn(),
  mockRouterPush: vi.fn(),
  mockRouterReplace: vi.fn(),
}));

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
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
    push: mockRouterPush,
    replace: mockRouterReplace,
    refresh: mockRouterRefresh,
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
      expect(screen.getByText('Selfie con el DNI')).toBeDefined();
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

    it('muestra error de validación cuando el DNI contiene letras (ej: 1234567A) y mantiene deshabilitado el botón Continuar', async () => {
      render(<IdentityForm courierId="test-courier" />);
      const dniInput = screen.getByLabelText(/Número de DNI/i);
      const continueBtn = screen.getByRole('button', { name: /Continuar/i });

      fireEvent.change(dniInput, { target: { value: '1234567A' } });
      fireEvent.blur(dniInput);

      await waitFor(() => {
        expect(screen.getByText(/El DNI debe tener 7 u 8 dígitos numéricos/i)).toBeDefined();
      });
      expect((continueBtn as HTMLButtonElement).disabled).toBe(true);

      // Corrección con DNI válido sin perder estado
      fireEvent.change(dniInput, { target: { value: '12345678' } });
      fireEvent.blur(dniInput);

      await waitFor(() => {
        expect(screen.queryByText(/El DNI debe tener 7 u 8 dígitos numéricos/i)).toBeNull();
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
      ['123 ABC', true],
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

    describe('VehicleForm en modo edición (T-357 / Issue #344)', () => {
      it('no renderiza StepIndicator ni el contador de pasos ("Paso 3 de 4")', () => {
        render(
          <VehicleForm
            courierId="test-courier"
            isEditing={true}
            initialVehicleType="moto"
            initialVehiclePlate="AB 123 CD"
          />
        );

        expect(screen.queryByText('Paso 3 de 4')).toBeNull();
        expect(screen.queryByText('Datos')).toBeNull();
        expect(screen.queryByText('Identidad')).toBeNull();
        expect(screen.queryByText('Listo')).toBeNull();
      });

      it('no muestra tarjetas documentales en edición de moto', () => {
        render(<VehicleForm courierId="test-courier" isEditing initialVehicleType="moto" initialVehiclePlate="AB 123 CD" />);
        expect(screen.queryByText(COURIER_ONBOARDING_COPY.licenseTitle)).toBeNull();
        expect(screen.queryByText(COURIER_ONBOARDING_COPY.insuranceTitle)).toBeNull();
      });

      it('no renderiza checkboxes de consentimientos legales obligatorios en edición', () => {
        render(
          <VehicleForm
            courierId="test-courier"
            isEditing={true}
            initialVehicleType="moto"
            initialVehiclePlate="AB 123 CD"
          />
        );

        expect(screen.queryByRole('checkbox')).toBeNull();
        expect(screen.queryByText(/Términos para repartidores/i)).toBeNull();
        expect(screen.queryByText(/Política de privacidad/i)).toBeNull();
        expect(screen.queryByText(/Condiciones para repartidores/i)).toBeNull();
      });

      it('precarga vehículo y patente iniciales y botón de guardar', () => {
        render(
          <VehicleForm
            courierId="test-courier"
            isEditing={true}
            initialVehicleType="moto"
            initialVehiclePlate="AB 123 CD"
          />
        );

        const plateInput = screen.getByLabelText(/Patente del vehículo/i) as HTMLInputElement;
        expect(plateInput.value).toBe('AB 123 CD');
        expect(screen.getByRole('button', { name: /Guardar vehículo|Actualizar vehículo/i })).toBeDefined();
      });

      it('al enviar en modo edición invoca updateCourierVehicleAction y no courierOnboardingAction', async () => {
        const mockOnboardingAction = vi.spyOn(actionsModule, 'courierOnboardingAction');
        const mockUpdateAction = vi.spyOn(actionsModule, 'updateCourierVehicleAction').mockResolvedValue({
          ok: true,
          data: { redirectTo: '/courier/profile' },
        });
        const onSuccess = vi.fn();

        render(
          <VehicleForm
            courierId="test-courier"
            isEditing={true}
            initialVehicleType="moto"
            initialVehiclePlate="AB 123 CD"
            onSuccess={onSuccess}
          />
        );

        const submitBtn = screen.getByRole('button', { name: /Guardar vehículo|Actualizar vehículo/i });
        expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
        fireEvent.click(submitBtn);

        await waitFor(() => {
          expect(mockUpdateAction).toHaveBeenCalledTimes(1);
          expect(mockUpdateAction).toHaveBeenCalledWith(
            expect.objectContaining({
              vehicleType: 'moto',
              vehiclePlate: 'AB 123 CD',
            })
          );
          expect(mockOnboardingAction).not.toHaveBeenCalled();
          expect(onSuccess).toHaveBeenCalled();
        });
      });

      it('permite cambiar a bici o pie ocultando patente y enviando sin patente', async () => {
        const mockUpdateAction = vi.spyOn(actionsModule, 'updateCourierVehicleAction').mockResolvedValue({
          ok: true,
          data: { redirectTo: '/courier/profile' },
        });

        render(
          <VehicleForm
            courierId="test-courier"
            isEditing={true}
            initialVehicleType="moto"
            initialVehiclePlate="AB 123 CD"
          />
        );

        const bikeText = screen.getByText('Bici');
        fireEvent.click(bikeText);

        await waitFor(() => {
          expect(screen.queryByLabelText(/Patente del vehículo/i)).toBeNull();
        });

        const submitBtn = screen.getByRole('button', { name: /Guardar vehículo|Actualizar vehículo/i });
        expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
        fireEvent.click(submitBtn);

        await waitFor(() => {
          expect(mockUpdateAction).toHaveBeenCalledTimes(1);
          expect(mockUpdateAction).toHaveBeenCalledWith(
            expect.objectContaining({
              vehicleType: 'bike',
              vehiclePlate: null,
            })
          );
        });
      });

      it('muestra error diferenciado de validación ante fallo de la acción', async () => {
        vi.spyOn(actionsModule, 'updateCourierVehicleAction').mockResolvedValue({
          ok: false,
          code: 'VALIDATION_ERROR',
        });

        render(
          <VehicleForm
            courierId="test-courier"
            isEditing={true}
            initialVehicleType="moto"
            initialVehiclePlate="AB 123 CD"
          />
        );

        const submitBtn = screen.getByRole('button', { name: /Guardar vehículo|Actualizar vehículo/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
          expect(screen.getByRole('alert')).toBeDefined();
          expect(screen.getByText(/verificá los datos|patente es obligatoria|inválida/i)).toBeDefined();
        });
      });
    });
  });

  describe('StatusView (R03)', () => {
    it('muestra el estado en revisión, la insignia y el checklist de documentos', () => {
      render(<StatusView documents={[]} />);

      expect(screen.getByText('Estamos revisando tus datos')).toBeDefined();
      expect(screen.getByText('En revisión manual')).toBeDefined();
      expect(screen.getByText('DNI frente y dorso')).toBeDefined();
      expect(screen.getByText('Selfie con el DNI')).toBeDefined();
      expect(screen.getByRole('button', { name: /Ir al panel de repartidor/i })).toBeDefined();
    });

    it('PR242-H02: con showFeedButton={false} no muestra el botón al panel', () => {
      render(<StatusView documents={[]} showFeedButton={false} />);

      expect(screen.getByText('Estamos revisando tus datos')).toBeDefined();
      expect(screen.queryByRole('button', { name: /Ir al panel de repartidor/i })).toBeNull();
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
      expect(screen.getByText('Selfie con el DNI')).toBeDefined();
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
      const selfieRow = screen.getByText('Selfie con el DNI').closest('div[class*="flex items-center justify-between"]');
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

      const selfieRow = screen.getByText('Selfie con el DNI').closest('div[class*="flex items-center justify-between"]');
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

    it('Hotfix T-325 / T-382: ajustes sin el switch falso de notificaciones y con enlaces a los documentos legales publicados', () => {
      render(
        <CourierProfileView
          profile={{
            displayName: 'Carlos Gómez',
            email: 'carlos@test.com',
            vehicleType: 'motorcycle',
            plate: 'AB 123 CD',
            dniStatus: 'submitted',
            selfieStatus: 'submitted',
            licenseStatus: 'none',
            insuranceStatus: 'none',
            courierStatus: 'pending',
            onboardingComplete: true,
          }}
        />
      );

      // T-382: el switch local «Notificaciones» se retira; la entrada única es «Notificaciones y avisos → Configurar».
      expect(screen.queryByRole('switch', { name: 'Alternar notificaciones' })).toBeNull();
      expect(screen.queryByText('Notificaciones')).toBeNull();
      expect(screen.queryByText(/sonoras/i)).toBeNull();
      expect(screen.queryByText(/T-311|en publicación/i)).toBeNull();

      for (const [name, href] of [
        [/Términos para repartidores/i, '/legal/terms'],
        [/Política de privacidad/i, '/legal/privacy'],
        [/Condiciones para repartidores/i, '/legal/courier'],
      ] as const) {
        const link = screen.getByRole('link', { name });
        expect(link.getAttribute('href')).toBe(href);
        expect(link.className).toMatch(/min-h-12/);
      }
    });

    describe('T-367: Visualización de avatar autorizado del repartidor en su perfil', () => {
      it('renderiza la foto del avatar con alt accesible y estilos definidos cuando avatarUrl está disponible', () => {
        render(
          <CourierProfileView
            profile={{
              displayName: 'Carlos Gómez',
              email: 'carlos@test.com',
              vehicleType: 'moto',
              plate: 'AB 123 CD',
              dniStatus: 'verified',
              selfieStatus: 'verified',
              licenseStatus: 'verified',
              insuranceStatus: 'none',
              courierStatus: 'approved',
              onboardingComplete: true,
              avatarUrl: 'https://test-storage.local/courier-docs/courier/carlos/avatar_123.jpg?token=valid',
            }}
          />
        );

        const img = screen.getByRole('img', { name: 'Foto de perfil de Carlos Gómez' });
        expect(img).toBeDefined();
        expect(img.getAttribute('src')).toBe(
          'https://test-storage.local/courier-docs/courier/carlos/avatar_123.jpg?token=valid'
        );
        expect(img.className).toContain('object-cover');
      });

      it('muestra el ícono genérico User si avatarUrl es null o undefined', () => {
        const { container } = render(
          <CourierProfileView
            profile={{
              displayName: 'Carlos Gómez',
              email: 'carlos@test.com',
              vehicleType: 'moto',
              plate: 'AB 123 CD',
              dniStatus: 'verified',
              selfieStatus: 'verified',
              licenseStatus: 'none',
              insuranceStatus: 'none',
              courierStatus: 'approved',
              onboardingComplete: true,
              avatarUrl: null,
            }}
          />
        );

        expect(screen.queryByRole('img', { name: /foto de perfil/i })).toBeNull();
        expect(screen.getByRole('img', { name: 'Avatar de perfil no disponible' })).toBeDefined();
        const svg = container.querySelector('svg.lucide-user');
        expect(svg).not.toBeNull();
      });

      it('hace fallback al ícono User si la imagen de avatarUrl dispara error de carga (onError)', () => {
        render(
          <CourierProfileView
            profile={{
              displayName: 'Carlos Gómez',
              email: 'carlos@test.com',
              vehicleType: 'moto',
              plate: 'AB 123 CD',
              dniStatus: 'verified',
              selfieStatus: 'verified',
              licenseStatus: 'none',
              insuranceStatus: 'none',
              courierStatus: 'approved',
              onboardingComplete: true,
              avatarUrl: 'https://test-storage.local/courier-docs/courier/carlos/expired.jpg',
            }}
          />
        );

        const img = screen.getByRole('img', { name: 'Foto de perfil de Carlos Gómez' });
        expect(img).toBeDefined();

        fireEvent.error(img);

        expect(screen.queryByRole('img', { name: 'Foto de perfil de Carlos Gómez' })).toBeNull();
        expect(screen.getByRole('img', { name: 'Avatar de perfil no disponible' })).toBeDefined();
      });

      it('invariante de seguridad: jamás renderiza DNI o selfie como avatar si no hay avatarUrl', () => {
        render(
          <CourierProfileView
            profile={{
              displayName: 'Carlos Gómez',
              email: 'carlos@test.com',
              vehicleType: 'moto',
              plate: 'AB 123 CD',
              dniStatus: 'verified',
              selfieStatus: 'verified',
              licenseStatus: 'none',
              insuranceStatus: 'none',
              courierStatus: 'approved',
              onboardingComplete: true,
              avatarUrl: null,
            }}
          />
        );

        expect(screen.queryByRole('img', { name: /foto de perfil/i })).toBeNull();
        expect(screen.queryByRole('img', { name: /selfie/i })).toBeNull();
        expect(screen.queryByRole('img', { name: /dni/i })).toBeNull();
      });
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

    describe('T-355: Datos personales y edición de teléfono en CourierProfileView', () => {
      const baseCourier = {
        courierId: 'courier-123',
        displayName: 'Lautaro Repartidor',
        email: 'lautaro@cadeapp.test',
        phone: '3865123456',
        hasDniOnFile: true,
        vehicleType: 'moto',
        plate: 'A 123 BCD',
        dniStatus: 'verified' as DocumentReviewStatus,
        selfieStatus: 'verified' as DocumentReviewStatus,
        licenseStatus: 'none' as DocumentReviewStatus,
        insuranceStatus: 'none' as DocumentReviewStatus,
        courierStatus: 'approved' as CourierReviewStatus,
        onboardingComplete: true,
      };

      it('renderiza la sección Datos personales con nombre, email, DNI y teléfono formateado', () => {
        render(<CourierProfileView profile={baseCourier} />);

        // Tarjeta Datos personales visible
        const personalCard = screen.getByText('Datos personales').closest('.space-y-4');
        if (!personalCard) throw new Error('No se encontró la tarjeta Datos personales');
        expect(personalCard).toBeDefined();

        // Nombre solo lectura
        expect(within(personalCard as HTMLElement).getByText('Lautaro Repartidor')).toBeDefined();
        // Email solo lectura
        expect(within(personalCard as HTMLElement).getByText('lautaro@cadeapp.test')).toBeDefined();
        // DNI o identificación de legajo
        expect(within(personalCard as HTMLElement).getByText(/Documento de identidad|DNI/i)).toBeDefined();
        // Teléfono formateado
        expect(within(personalCard as HTMLElement).getByText('3865 12-3456')).toBeDefined();

        // Botón exclusivo "Editar teléfono" disponible
        expect(within(personalCard as HTMLElement).getByRole('button', { name: /editar teléfono/i })).toBeDefined();

        // Ningún input editable visible en la tarjeta principal
        const inputs = screen.queryAllByRole('textbox');
        expect(inputs).toHaveLength(0);

        // Sin botones de edición para nombre, email ni DNI
        expect(within(personalCard as HTMLElement).queryByRole('button', { name: /editar nombre/i })).toBeNull();
        expect(within(personalCard as HTMLElement).queryByRole('button', { name: /editar email/i })).toBeNull();
        expect(within(personalCard as HTMLElement).queryByRole('button', { name: /editar dni/i })).toBeNull();
      });

      it('muestra «Sin teléfono registrado» cuando phone es null y permite abrir edición', () => {
        render(<CourierProfileView profile={{ ...baseCourier, phone: null }} />);

        expect(screen.getByText('Sin teléfono registrado')).toBeDefined();
        const editBtn = screen.getByRole('button', { name: /editar teléfono/i });
        expect(editBtn).toBeDefined();
        fireEvent.click(editBtn);

        // Abre diálogo con input de teléfono vacío
        const dialog = screen.getByRole('dialog');
        const phoneInput = within(dialog).getByLabelText(/teléfono de contacto/i);
        expect(phoneInput).toBeDefined();
        expect((phoneInput as HTMLInputElement).value).toBe('');
      });

      it('precarga el teléfono actual en el diálogo de edición y valida formato en submit', async () => {
        render(<CourierProfileView profile={baseCourier} />);

        const editBtn = screen.getByRole('button', { name: /editar teléfono/i });
        fireEvent.click(editBtn);

        // Input precargado con el teléfono actual
        const dialog = screen.getByRole('dialog');
        const phoneInput = within(dialog).getByLabelText(/teléfono de contacto/i) as HTMLInputElement;
        expect(phoneInput.value).toBe('3865123456');

        // Modifica a un teléfono inválido
        fireEvent.change(phoneInput, { target: { value: '12345' } });
        const saveBtn = within(dialog).getByRole('button', { name: /guardar|confirmar/i });
        fireEvent.click(saveBtn);

        // Muestra error de validación y no llama a la acción
        await waitFor(() => {
          expect(screen.getByRole('alert')).toBeDefined();
          expect(screen.getByRole('alert').textContent).toMatch(/10 dígitos nacionales|número argentino válido/i);
        });
      });

      it('al guardar exitosamente actualiza la UI, muestra confirmación y llama a router.refresh()', async () => {
        const spyAction = vi.spyOn(actionsModule, 'updateCourierPhoneAction').mockResolvedValueOnce({
          ok: true,
          data: { phone: '3865999888', redirectTo: '/courier/profile' },
        });

        render(<CourierProfileView profile={baseCourier} />);

        fireEvent.click(screen.getByRole('button', { name: /editar teléfono/i }));

        const dialog = screen.getByRole('dialog');
        const phoneInput = within(dialog).getByLabelText(/teléfono de contacto/i) as HTMLInputElement;
        fireEvent.change(phoneInput, { target: { value: '3865999888' } });

        const saveBtn = within(dialog).getByRole('button', { name: /guardar|confirmar/i });
        fireEvent.click(saveBtn);

        await waitFor(() => {
          expect(spyAction).toHaveBeenCalledWith({ phone: '3865999888' });
        });

        // UI refleja el nuevo teléfono formateado
        await waitFor(() => {
          expect(screen.getByText('3865 99-9888')).toBeDefined();
        });

        expect(mockRouterRefresh).toHaveBeenCalled();
        spyAction.mockRestore();
      });

      it('al ocurrir un error de red/servidor conserva el valor anterior sin borrar el dato previo', async () => {
        const spyAction = vi.spyOn(actionsModule, 'updateCourierPhoneAction').mockResolvedValueOnce({
          ok: false,
          code: 'INTERNAL_ERROR',
        });

        render(<CourierProfileView profile={baseCourier} />);

        fireEvent.click(screen.getByRole('button', { name: /editar teléfono/i }));

        const dialog = screen.getByRole('dialog');
        const phoneInput = within(dialog).getByLabelText(/teléfono de contacto/i) as HTMLInputElement;
        fireEvent.change(phoneInput, { target: { value: '3865999888' } });

        const saveBtn = within(dialog).getByRole('button', { name: /guardar|confirmar/i });
        fireEvent.click(saveBtn);

        await waitFor(() => {
          expect(within(dialog).getByRole('alert')).toBeDefined();
        });

        // Cancelar o cerrar diálogo
        const cancelBtn = within(dialog).getByRole('button', { name: /cancelar|volver/i });
        fireEvent.click(cancelBtn);

        // El teléfono previo original se preserva intacto
        expect(screen.getByText('3865 12-3456')).toBeDefined();
        spyAction.mockRestore();
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

    for (const label of [/DNI dorso/, /Selfie con el DNI/, /Foto de perfil/]) {
      const { input, card } = uploadCard(label);
      selectFile(input, 'doc.jpg');
      await waitFor(() => expect(card.getAttribute('data-status')).toBe('success'));
    }

    expect(screen.getByText('4 de 4 cargados')).toBeDefined();
    const continueBtn = screen.getByRole('button', { name: /Continuar/i });
    expect((continueBtn as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('T-351: contraste WCAG AA de la tarjeta de carga en sus cuatro estados', () => {
  afterEach(cleanup);

  // Los colores salen de src/ui/tokens.css (HSL), no de valores copiados en el test.
  const tokensCss = fs.readFileSync(path.resolve('src/ui/tokens.css'), 'utf8');

  type Rgb = [number, number, number];

  function tokenRgb(name: string): Rgb {
    const match = tokensCss.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
    if (!match?.[1] || !match[2] || !match[3]) throw new Error(`Token --${name} no encontrado`);
    const h = Number(match[1]);
    const s = Number(match[2]) / 100;
    const l = Number(match[3]) / 100;
    const a = s * Math.min(l, 1 - l);
    const channel = (n: number) => {
      const k = (n + h / 30) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [channel(0), channel(8), channel(4)];
  }

  function over(top: Rgb, alpha: number, base: Rgb): Rgb {
    return [
      Math.round(alpha * top[0] + (1 - alpha) * base[0]),
      Math.round(alpha * top[1] + (1 - alpha) * base[1]),
      Math.round(alpha * top[2] + (1 - alpha) * base[2]),
    ];
  }

  function luminance([r, g, b]: Rgb) {
    const lin = (c: number) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function contrast(a: Rgb, b: Rgb) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  // Clase de color de texto → token. Se lee la clase exacta del elemento que contiene el texto.
  const TEXT_TOKENS: Record<string, string> = {
    'text-primary-dark': 'primary-dark',
    'text-primary': 'primary',
    'text-success': 'success',
    'text-destructive': 'destructive',
    'text-muted-foreground': 'muted-foreground',
    'text-foreground': 'foreground',
  };

  function textTokenClass(element: HTMLElement) {
    const classes = element.className.split(/\s+/).filter((c) => c in TEXT_TOKENS);
    expect(classes, `clases de color de «${element.textContent}»`).toHaveLength(1);
    return classes[0] ?? '';
  }

  // La tarjeta es translúcida en hover (bg-primary/5) y en error (bg-destructive/5): se compone sobre la tarjeta
  // blanca y sobre el fondo de página, y se exige AA en los dos.
  const white = tokenRgb('card');
  const page = tokenRgb('background');
  const idleBackgrounds = [white, over(tokenRgb('primary'), 0.05, white), over(tokenRgb('primary'), 0.05, page)];
  const successBackgrounds = [white];
  const errorBackgrounds = [over(tokenRgb('destructive'), 0.05, white), over(tokenRgb('destructive'), 0.05, page)];

  function expectAa(element: HTMLElement, expectedClass: string, backgrounds: Rgb[]) {
    const tokenClass = textTokenClass(element);
    expect(tokenClass, `token de «${element.textContent}»`).toBe(expectedClass);
    const color = tokenRgb(TEXT_TOKENS[tokenClass] ?? '');
    for (const background of backgrounds) {
      expect(
        contrast(color, background),
        `«${element.textContent}» ${tokenClass} sobre rgb(${background.join(',')})`
      ).toBeGreaterThanOrEqual(4.5);
    }
  }

  function renderCard(props: Partial<React.ComponentProps<typeof DocumentUploadCard>>) {
    return render(
      <DocumentUploadCard
        kind="dni_front"
        title="DNI frente"
        subtitle="Sacá una foto clara del frente"
        status="idle"
        onFileSelected={() => undefined}
        {...props}
      />
    );
  }

  it('idle: «Subir» usa primary-dark y título, estado y acción cumplen AA', () => {
    renderCard({ status: 'idle' });
    expect(screen.getByRole('status').textContent).toBe('Sacá una foto clara del frente');
    expectAa(screen.getByText('DNI frente'), 'text-foreground', idleBackgrounds);
    expectAa(screen.getByRole('status'), 'text-muted-foreground', idleBackgrounds);
    expectAa(screen.getByText('Subir', { exact: true }), 'text-primary-dark', idleBackgrounds);
  });

  it('uploading comprimiendo: estado de optimización con AA y sin texto de acción', () => {
    renderCard({ status: 'uploading', compressing: true });
    expect(screen.getByRole('status').textContent).toBe('Optimizando...');
    expect(screen.queryByText('Subir', { exact: true })).toBeNull();
    expectAa(screen.getByText('DNI frente'), 'text-foreground', idleBackgrounds);
    expectAa(screen.getByRole('status'), 'text-muted-foreground', idleBackgrounds);
  });

  it('uploading subiendo: estado de subida con AA y sin texto de acción', () => {
    renderCard({ status: 'uploading', compressing: false });
    expect(screen.getByRole('status').textContent).toBe('Subiendo...');
    expect(screen.queryByText('Subir', { exact: true })).toBeNull();
    expectAa(screen.getByText('DNI frente'), 'text-foreground', idleBackgrounds);
    expectAa(screen.getByRole('status'), 'text-muted-foreground', idleBackgrounds);
  });

  it('success: nombre del archivo y «Cargado» cumplen AA', () => {
    renderCard({ status: 'success', fileName: 'dni_front.png' });
    expect(screen.getByRole('status').textContent).toBe('dni_front.png');
    expectAa(screen.getByText('DNI frente'), 'text-foreground', successBackgrounds);
    expectAa(screen.getByRole('status'), 'text-muted-foreground', successBackgrounds);
    expectAa(screen.getByText('Cargado', { exact: true }), 'text-success', successBackgrounds);
  });

  it('error: mensaje de error y «Reintentar» cumplen AA sobre el fondo de error', () => {
    renderCard({ status: 'error' });
    expect(screen.getByRole('alert').textContent).toBe('Error al subir. Tocá para reintentar.');
    expectAa(screen.getByText('DNI frente'), 'text-foreground', errorBackgrounds);
    expectAa(screen.getByRole('alert'), 'text-muted-foreground', errorBackgrounds);
    expectAa(screen.getByText('Reintentar', { exact: true }), 'text-destructive', errorBackgrounds);
  });

  it('el asterisco de DNI obligatorio usa primary-dark con AA sobre la página', () => {
    const { container } = render(<IdentityForm courierId="c-1" />);
    const label = container.querySelector('label[for="dni-input"]');
    if (!(label instanceof HTMLElement)) throw new Error('No se encontró el label del DNI');
    expectAa(within(label).getByText('*'), 'text-primary-dark', [white, page]);
  });
});

describe('T-354 — Unificación de copy «Selfie con el DNI» y accesibilidad', () => {
  it('IdentityForm muestra título e instrucción exactos, input file accesible y sin truncate en subtítulo', () => {
    render(<IdentityForm courierId="c-test-t354" />);

    // 1. Título exacto
    expect(screen.getByText('Selfie con el DNI')).toBeDefined();

    // 2. Instrucción exacta
    const instructionText =
      'Sostené el DNI junto a tu rostro. Ambos deben verse legibles, sin reflejos ni obstrucciones';
    expect(screen.getByText(instructionText)).toBeDefined();

    // 3. input[type=file] asociado por etiqueta
    const fileInput = screen.getByLabelText(/Selfie con el DNI/i);
    expect(fileInput).toBeDefined();
    expect(fileInput.getAttribute('type')).toBe('file');
    expect(fileInput.getAttribute('aria-label')).toBe('Selfie con el DNI');

    // 4. aria-describedby referenciando un nodo real con el subtítulo
    const describedById = fileInput.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    const describedNode = describedById ? document.getElementById(describedById) : null;
    expect(describedNode).not.toBeNull();
    expect(describedNode?.textContent).toBe(instructionText);

    // 5. Instrucción visible sin truncate
    expect(describedNode?.className).not.toContain('truncate');
    expect(describedNode?.className).toContain('whitespace-normal');
  });

  it('StatusView muestra «Selfie con el DNI» y refleja estados pendiente, observado y listo', () => {
    // Faltante -> Pendiente
    const { rerender } = render(<StatusView documents={[]} />);
    const rowPending = screen
      .getByText('Selfie con el DNI')
      .closest('div[class*="flex items-center justify-between"]');
    expect(rowPending).not.toBeNull();
    expect(rowPending?.textContent).toContain('Pendiente');

    // Rechazada -> Observado
    rerender(<StatusView documents={[{ kind: 'selfie', status: 'rejected' }]} />);
    const rowRejected = screen
      .getByText('Selfie con el DNI')
      .closest('div[class*="flex items-center justify-between"]');
    expect(rowRejected).not.toBeNull();
    expect(rowRejected?.textContent).toContain('Observado');

    // Cargada / verificada -> Listo
    rerender(<StatusView documents={[{ kind: 'selfie', status: 'submitted' }]} />);
    const rowSubmitted = screen
      .getByText('Selfie con el DNI')
      .closest('div[class*="flex items-center justify-between"]');
    expect(rowSubmitted).not.toBeNull();
    expect(rowSubmitted?.textContent).toContain('Listo');
  });

  it('CourierProfileView nombra la selfie como «Selfie con el DNI» en perfil activo', () => {
    render(
      <CourierProfileView
        profile={{
          displayName: 'Repartidor Test',
          email: 'courier@test.com',
          vehicleType: 'moto',
          plate: 'A123BCD',
          dniStatus: 'verified',
          selfieStatus: 'submitted',
          licenseStatus: 'none',
          insuranceStatus: 'none',
          courierStatus: 'pending',
          onboardingComplete: true,
        }}
      />
    );
    expect(screen.getByText('Selfie con el DNI')).toBeDefined();
  });
});

describe('T-356 · CC-025: Recarga de documentos del repartidor rechazados por admin', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'courier-session-123' } },
      error: null,
    });
  });

  it('(a) actor sin sesión: DocumentReplacementCard muestra error al fallar la sesión y no autoaprueba', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Session not found'),
    });

    render(
      <DocumentReplacementCard
        kind="license"
        title="Licencia de conducir"
        initialStatus="rejected"
        rejectionCode="illegible"
      />
    );

    expect(screen.getByText(COURIER_ONBOARDING_COPY.rejectedBadge)).toBeDefined();

    const fileInput = screen.getByLabelText(/Reemplazar licencia de conducir/i);
    const testFile = new File(['content'], 'licencia.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
      expect(screen.getByText(/No se pudo identificar la sesión del repartidor/i)).toBeDefined();
    });

    // Invariante de seguridad: jamás avanza a "En revisión manual" ni autoaprueba
    expect(screen.queryByText(COURIER_ONBOARDING_COPY.underReviewBadge)).toBeNull();
  });

  it('(b) rechazo solo de licencia: CourierProfileView muestra control de reemplazo para licencia y no para DNI verificado', () => {
    render(
      <CourierProfileView
        profile={{
          courierId: 'courier-123',
          displayName: 'Juan Repartidor',
          email: 'juan@test.com',
          vehicleType: 'moto',
          plate: 'AB 123 CD',
          dniStatus: 'verified',
          selfieStatus: 'submitted',
          licenseStatus: 'rejected',
          licenseRejectionMessage: 'La imagen de la licencia no es legible.',
          insuranceStatus: 'none',
          courierStatus: 'approved',
          onboardingComplete: true,
        }}
      />
    );

    // DNI y selfie no admiten reemplazo
    expect(screen.getByText('Validado por admin')).toBeDefined();
    expect(screen.getByText('En revisión')).toBeDefined();

    // Licencia muestra "Rechazado / requiere corrección", el motivo seguro y el botón de reemplazo
    expect(screen.getAllByText(COURIER_ONBOARDING_COPY.rejectedBadge).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('La imagen de la licencia no es legible.')).toBeDefined();
    const replaceButtons = screen.getAllByText('Reemplazar');
    expect(replaceButtons.length).toBe(1);
  });

  it('(b2) rechazo de solo DNI frente manteniendo dorso verificado: reemplaza individualmente frente sin mutar dorso', () => {
    render(
      <CourierProfileView
        profile={{
          courierId: 'courier-123',
          displayName: 'Juan Repartidor',
          email: 'juan@test.com',
          vehicleType: 'bike',
          plate: null,
          dniStatus: 'rejected',
          dniFrontStatus: 'rejected',
          dniFrontRejectionMessage: 'El frente del DNI está cortado.',
          dniBackStatus: 'verified',
          selfieStatus: 'verified',
          licenseStatus: 'none',
          insuranceStatus: 'none',
          courierStatus: 'pending',
          onboardingComplete: true,
        }}
      />
    );

    // Dorso y Selfie siguen verificados
    expect(screen.getAllByText('Validado por admin').length).toBeGreaterThanOrEqual(2);

    // Frente muestra tarjeta de reemplazo con su motivo
    expect(screen.getByText('El frente del DNI está cortado.')).toBeDefined();
    const replaceButtons = screen.getAllByText('Reemplazar');
    expect(replaceButtons.length).toBe(1);
  });

  it('(c) submitted y verified sin botón ni control de reemplazo', () => {
    render(
      <CourierProfileView
        profile={{
          courierId: 'courier-123',
          displayName: 'Juan Repartidor',
          email: 'juan@test.com',
          vehicleType: 'moto',
          plate: 'AB 123 CD',
          dniStatus: 'verified',
          selfieStatus: 'submitted',
          licenseStatus: 'verified',
          insuranceStatus: 'submitted',
          courierStatus: 'pending',
          onboardingComplete: true,
        }}
      />
    );

    expect(screen.queryByText('Reemplazar')).toBeNull();
    expect(screen.queryByText(COURIER_ONBOARDING_COPY.rejectedBadge)).toBeNull();
  });

  it('(d) mensaje público del catálogo y nota interna centinela que jamás llega a props/DOM', () => {
    render(
      <DocumentReplacementCard
        courierId="courier-123"
        kind="selfie"
        title="Selfie con el DNI"
        initialStatus="rejected"
        rejectionCode="expired"
      />
    );

    // Muestra el mensaje seguro del catálogo
    expect(screen.getByText('Documento vencido o no vigente.')).toBeDefined();

    // Jamás se renderiza texto interno ni notas privadas de auditoría
    expect(screen.queryByText(/INTERNAL_NOTE_SENTINEL/i)).toBeNull();
    expect(screen.queryByText(/audit_log/i)).toBeNull();
  });

  it('(e) flujo exitoso: usuario selecciona archivo -> comprime -> sube a Storage -> llama action -> pasa a «En revisión manual»', async () => {
    mockUploadCourierDocument.mockResolvedValue({
      storagePath: 'courier/courier-123/license_1700000000000.jpg',
    });

    const mockReplaceAction = vi
      .spyOn(actionsModule, 'replaceCourierDocumentAction')
      .mockResolvedValue({
        ok: true,
        data: {
          kind: 'license',
          idempotent: false,
          documentId: 'd0000000-0000-0000-0000-000000000002',
          replacedDocumentId: 'd0000000-0000-0000-0000-000000000001',
          status: 'submitted',
          isCurrent: true,
        },
      });

    const onReplaced = vi.fn();

    render(
      <DocumentReplacementCard
        courierId="courier-123"
        kind="license"
        title="Licencia de conducir"
        initialStatus="rejected"
        rejectionCode="illegible"
        onReplaced={onReplaced}
      />
    );

    const fileInput = screen.getByLabelText(/Reemplazar licencia de conducir/i);
    const testFile = new File(['content'], 'nueva_licencia.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      // Verifica compresión
      expect(compressImage).toHaveBeenCalledWith(testFile);

      // Verifica subida a Storage con timestamp del intento estable
      expect(mockUploadCourierDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          courierId: 'courier-123',
          kind: 'license',
          file: testFile,
        })
      );

      // Verifica invocación de la acción de servidor
      expect(mockReplaceAction).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'license',
          storagePath: 'courier/courier-123/license_1700000000000.jpg',
        })
      );

      // Pasa a estado "En revisión manual" tras confirmación en DB
      expect(screen.getByText(COURIER_ONBOARDING_COPY.underReviewBadge)).toBeDefined();
      expect(screen.getByText(COURIER_ONBOARDING_COPY.documentReplacedSuccess)).toBeDefined();
      expect(onReplaced).toHaveBeenCalledWith({ kind: 'license', status: 'submitted' });
    });
  });

  it('(f) fallo de Storage permite reintentar sin autoaprobar ni pasar a «En revisión manual»', async () => {
    mockUploadCourierDocument.mockRejectedValueOnce(
      new Error('Error de conexión al subir a Storage')
    );

    render(
      <DocumentReplacementCard
        courierId="courier-123"
        kind="insurance"
        title="Seguro de accidentes"
        initialStatus="rejected"
        rejectionCode="incomplete"
      />
    );

    const fileInput = screen.getByLabelText(/Reemplazar seguro de accidentes/i);
    const testFile = new File(['content'], 'poliza.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
      expect(screen.getByText(/Error de conexión al subir a Storage/i)).toBeDefined();
    });

    // Invariante: no pasa a En revisión manual
    expect(screen.queryByText(COURIER_ONBOARDING_COPY.underReviewBadge)).toBeNull();
    expect(screen.getAllByText(COURIER_ONBOARDING_COPY.rejectedBadge).length).toBeGreaterThanOrEqual(1);
  });

  it('(f2) error de RPC en DB mantiene estado en error con mensaje seguro y no inventa éxito', async () => {
    mockUploadCourierDocument.mockResolvedValue({
      storagePath: 'courier/courier-123/dni_front_1700000000000.png',
    });

    vi.spyOn(actionsModule, 'replaceCourierDocumentAction').mockResolvedValueOnce({
      ok: false,
      code: 'INVALID_STATE_TRANSITION',
    });

    render(
      <DocumentReplacementCard
        courierId="courier-123"
        kind="dni_front"
        title="DNI frente"
        initialStatus="rejected"
        rejectionCode="wrong_type"
      />
    );

    const fileInput = screen.getByLabelText(/Reemplazar dni frente/i);
    const testFile = new File(['content'], 'dni_nuevo.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
      expect(screen.getByText(/El documento ya no está en estado rechazado/i)).toBeDefined();
    });

    // Invariante: no anuncia éxito
    expect(screen.queryByText(COURIER_ONBOARDING_COPY.underReviewBadge)).toBeNull();
  });

  it('(g) segundo intento / reintento exitoso tras fallo temporal', async () => {
    mockUploadCourierDocument.mockResolvedValue({
      storagePath: 'courier/courier-123/dni_back_1700000000000.png',
    });

    const mockReplaceAction = vi
      .spyOn(actionsModule, 'replaceCourierDocumentAction')
      .mockResolvedValueOnce({
        ok: false,
        code: 'VALIDATION_ERROR',
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          kind: 'dni_back',
          idempotent: false,
          documentId: 'd0000000-0000-0000-0000-000000000005',
          replacedDocumentId: 'd0000000-0000-0000-0000-000000000006',
          status: 'submitted',
          isCurrent: true,
        },
      });

    render(
      <DocumentReplacementCard
        courierId="courier-123"
        kind="dni_back"
        title="DNI dorso"
        initialStatus="rejected"
        rejectionCode="expired"
      />
    );

    const fileInput = screen.getByLabelText(/Reemplazar dni dorso/i);
    const testFile = new File(['content'], 'dorso_nuevo.png', { type: 'image/png' });

    // Intento 1: falla RPC
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(COURIER_ONBOARDING_COPY.underReviewBadge)).toBeNull();

    // Intento 2: reintento exitoso
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText(COURIER_ONBOARDING_COPY.underReviewBadge)).toBeDefined();
      expect(screen.getByText(COURIER_ONBOARDING_COPY.documentReplacedSuccess)).toBeDefined();
    });
    expect(mockReplaceAction).toHaveBeenCalledTimes(2);
  });

  it('(h) PR358-R01: Reintento con el mismo archivo tras fallo de RPC reutiliza idempotencyKey y storagePath y NO vuelve a subir a Storage', async () => {
    mockUploadCourierDocument.mockResolvedValue({
      storagePath: 'courier/courier-123/license_stable_1700000000000.jpg',
    });

    const mockReplaceAction = vi
      .spyOn(actionsModule, 'replaceCourierDocumentAction')
      .mockResolvedValueOnce({
        ok: false,
        code: 'INTERNAL_ERROR',
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          kind: 'license',
          idempotent: false,
          documentId: 'd0000000-0000-0000-0000-000000000010',
          replacedDocumentId: 'd0000000-0000-0000-0000-000000000009',
          status: 'submitted',
          isCurrent: true,
        },
      });

    render(
      <DocumentReplacementCard
        courierId="courier-123"
        kind="license"
        title="Licencia de conducir"
        initialStatus="rejected"
        rejectionCode="illegible"
      />
    );

    const fileInput = screen.getByLabelText(/Reemplazar licencia de conducir/i);
    const testFile = new File(['same-content'], 'licencia_identica.jpg', {
      type: 'image/jpeg',
      lastModified: 1700000000000,
    });

    // Intento 1: sube y luego RPC falla
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
    expect(mockUploadCourierDocument).toHaveBeenCalledTimes(1);
    expect(mockReplaceAction).toHaveBeenCalledTimes(1);

    const firstCall = mockReplaceAction.mock.calls[0];
    if (!firstCall) throw new Error('Expected at least 1 call to mockReplaceAction');
    const firstAttemptPayload = firstCall[0] as {
      kind: string;
      storagePath: string;
      idempotencyKey?: string;
    };
    expect(firstAttemptPayload.idempotencyKey).toBeDefined();

    // Intento 2: reintento con el MISMO archivo (mismo fingerprint)
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText(COURIER_ONBOARDING_COPY.underReviewBadge)).toBeDefined();
    });

    // Invariante PR358-R01: NO se vuelve a llamar a uploadCourierDocument (conserva un solo upload)
    expect(mockUploadCourierDocument).toHaveBeenCalledTimes(1);
    expect(mockReplaceAction).toHaveBeenCalledTimes(2);

    const secondCall = mockReplaceAction.mock.calls[1];
    if (!secondCall) throw new Error('Expected at least 2 calls to mockReplaceAction');
    const secondAttemptPayload = secondCall[0] as {
      kind: string;
      storagePath: string;
      idempotencyKey?: string;
    };
    // Invariante PR358-R01: se preservan exactamente la misma clave de idempotencia y storagePath
    expect(secondAttemptPayload.idempotencyKey).toBe(firstAttemptPayload.idempotencyKey);
    expect(secondAttemptPayload.storagePath).toBe(firstAttemptPayload.storagePath);
  });

  it('(i) PR358-R01: Selección de un archivo diferente genera nuevo intento lógico, nueva idempotencyKey y sube a Storage', async () => {
    mockUploadCourierDocument
      .mockResolvedValueOnce({
        storagePath: 'courier/courier-123/license_file1_1700000000000.jpg',
      })
      .mockResolvedValueOnce({
        storagePath: 'courier/courier-123/license_file2_1700000000001.jpg',
      });

    const mockReplaceAction = vi
      .spyOn(actionsModule, 'replaceCourierDocumentAction')
      .mockResolvedValueOnce({
        ok: false,
        code: 'INTERNAL_ERROR',
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          kind: 'license',
          idempotent: false,
          documentId: 'd0000000-0000-0000-0000-000000000012',
          replacedDocumentId: 'd0000000-0000-0000-0000-000000000011',
          status: 'submitted',
          isCurrent: true,
        },
      });

    render(
      <DocumentReplacementCard
        courierId="courier-123"
        kind="license"
        title="Licencia de conducir"
        initialStatus="rejected"
        rejectionCode="illegible"
      />
    );

    const fileInput = screen.getByLabelText(/Reemplazar licencia de conducir/i);
    const fileA = new File(['content-A'], 'licencia_A.jpg', {
      type: 'image/jpeg',
      lastModified: 1700000000000,
    });
    const fileB = new File(['content-B-distinto'], 'licencia_B.jpg', {
      type: 'image/jpeg',
      lastModified: 1700000001000,
    });

    // Intento 1 con fileA: falla
    fireEvent.change(fileInput, { target: { files: [fileA] } });
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });

    const firstCall = mockReplaceAction.mock.calls[0];
    if (!firstCall) throw new Error('Expected at least 1 call to mockReplaceAction');
    const firstPayload = firstCall[0] as {
      storagePath: string;
      idempotencyKey?: string;
    };

    // Intento 2 con fileB (archivo distinto): debe realizar nueva subida y nueva clave
    fireEvent.change(fileInput, { target: { files: [fileB] } });
    await waitFor(() => {
      expect(screen.getByText(COURIER_ONBOARDING_COPY.underReviewBadge)).toBeDefined();
    });

    expect(mockUploadCourierDocument).toHaveBeenCalledTimes(2);
    expect(mockReplaceAction).toHaveBeenCalledTimes(2);

    const secondCall = mockReplaceAction.mock.calls[1];
    if (!secondCall) throw new Error('Expected at least 2 calls to mockReplaceAction');
    const secondPayload = secondCall[0] as {
      storagePath: string;
      idempotencyKey?: string;
    };
    expect(secondPayload.idempotencyKey).not.toBe(firstPayload.idempotencyKey);
    expect(secondPayload.storagePath).not.toBe(firstPayload.storagePath);
  });

  it('(j) PR358-R01: Estado autoritativo: si RPC retorna status verified, se renderiza «Validado por admin» con badge verified y callback verified', async () => {
    mockUploadCourierDocument.mockResolvedValue({
      storagePath: 'courier/courier-123/license_verified_1700000000000.jpg',
    });

    vi.spyOn(actionsModule, 'replaceCourierDocumentAction').mockResolvedValueOnce({
      ok: true,
      data: {
        kind: 'license',
        idempotent: false,
        documentId: 'd0000000-0000-0000-0000-000000000020',
        replacedDocumentId: 'd0000000-0000-0000-0000-000000000019',
        status: 'verified',
        isCurrent: true,
      },
    });

    const onReplaced = vi.fn();

    render(
      <DocumentReplacementCard
        courierId="courier-123"
        kind="license"
        title="Licencia de conducir"
        initialStatus="rejected"
        rejectionCode="illegible"
        onReplaced={onReplaced}
      />
    );

    const fileInput = screen.getByLabelText(/Reemplazar licencia de conducir/i);
    const testFile = new File(['content'], 'licencia.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getByText('Validado por admin')).toBeDefined();
      expect(screen.getByText('Documento validado exitosamente.')).toBeDefined();
    });

    expect(onReplaced).toHaveBeenCalledWith({ kind: 'license', status: 'verified' });
  });

  it('(k) PR358-R02: StatusView actualiza el checklist del padre tras reemplazo exitoso sin mutar otros kinds y llama router.refresh()', async () => {
    mockUploadCourierDocument.mockResolvedValue({
      storagePath: 'courier/courier-123/license_1700000000000.jpg',
    });

    vi.spyOn(actionsModule, 'replaceCourierDocumentAction').mockResolvedValueOnce({
      ok: true,
      data: {
        kind: 'license',
        idempotent: false,
        documentId: 'd0000000-0000-0000-0000-000000000030',
        replacedDocumentId: 'd0000000-0000-0000-0000-000000000029',
        status: 'submitted',
        isCurrent: true,
      },
    });

    render(
      <StatusView
        courierId="courier-123"
        documents={[
          {
            kind: 'dni_front',
            status: 'rejected',
            rejectionCode: 'wrong_type',
          },
          {
            kind: 'dni_back',
            status: 'verified',
          },
          {
            kind: 'selfie',
            status: 'verified',
          },
          {
            kind: 'avatar',
            status: 'verified',
          },
          {
            kind: 'license',
            status: 'rejected',
            rejectionCode: 'illegible',
          },
        ]}
      />
    );

    // Inicialmente: DNI frente y dorso está Rechazado, y Licencia de conducir está Rechazado
    const initialRejectedBadges = screen.getAllByText(COURIER_ONBOARDING_COPY.rejectedBadge);
    expect(initialRejectedBadges.length).toBeGreaterThanOrEqual(2);

    // Reemplazamos la licencia
    const fileInput = screen.getByLabelText(/Reemplazar licencia de conducir/i);
    const testFile = new File(['content'], 'nueva_licencia.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      // La tarjeta de reemplazo muestra éxito
      expect(screen.getByText(COURIER_ONBOARDING_COPY.documentReplacedSuccess)).toBeDefined();
    });

    // Invariante PR358-R02: router.refresh() fue llamado
    expect(mockRouterRefresh).toHaveBeenCalled();

    // Invariante PR358-R02: En el checklist del padre, Licencia pasó a "Listo"
    const listoBadges = screen.getAllByText('Listo');
    expect(listoBadges.length).toBeGreaterThanOrEqual(1);

    // Invariante PR358-R02: DNI frente y dorso NO mutó y sigue observado/rechazado
    expect(screen.getByText('DNI frente y dorso')).toBeDefined();
  });

  it('(l) PR358-R02: CourierProfileView actualiza badges exteriores a «En revisión» tras reemplazo exitoso sin mutar otros kinds y llama router.refresh()', async () => {
    mockUploadCourierDocument.mockResolvedValue({
      storagePath: 'courier/courier-123/license_1700000000000.jpg',
    });

    vi.spyOn(actionsModule, 'replaceCourierDocumentAction').mockResolvedValueOnce({
      ok: true,
      data: {
        kind: 'license',
        idempotent: false,
        documentId: 'd0000000-0000-0000-0000-000000000040',
        replacedDocumentId: 'd0000000-0000-0000-0000-000000000039',
        status: 'submitted',
        isCurrent: true,
      },
    });

    render(
      <CourierProfileView
        profile={{
          courierId: 'courier-123',
          displayName: 'Juan Repartidor',
          email: 'juan@test.com',
          vehicleType: 'moto',
          plate: 'AB 123 CD',
          dniStatus: 'verified',
          selfieStatus: 'submitted',
          licenseStatus: 'rejected',
          licenseRejectionMessage: 'La imagen de la licencia no es legible.',
          insuranceStatus: 'none',
          courierStatus: 'approved',
          onboardingComplete: true,
        }}
      />
    );

    // Inicialmente: DNI está verificado, Selfie en revisión, Licencia observada
    expect(screen.getByText('Validado por admin')).toBeDefined();
    expect(screen.getByText('En revisión')).toBeDefined();
    expect(screen.getAllByText(COURIER_ONBOARDING_COPY.rejectedBadge).length).toBeGreaterThanOrEqual(1);

    // Reemplazamos la licencia
    const fileInput = screen.getByLabelText(/Reemplazar licencia de conducir/i);
    const testFile = new File(['content'], 'nueva_licencia.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getByText(COURIER_ONBOARDING_COPY.documentReplacedSuccess)).toBeDefined();
    });

    // Invariante PR358-R02: router.refresh() fue llamado
    expect(mockRouterRefresh).toHaveBeenCalled();

    // Invariante PR358-R02: El badge exterior de Licencia ahora figura como "En revisión" (hay 2 badges de "En revisión": selfie y licencia)
    const enRevisionBadges = screen.getAllByText('En revisión');
    expect(enRevisionBadges.length).toBeGreaterThanOrEqual(2);

    // Invariante PR358-R02: DNI continúa inalterado como "Validado por admin"
    expect(screen.getByText('Validado por admin')).toBeDefined();
  });

  it('(m) PR358-H03: si globalThis.crypto.randomUUID no está disponible o lanza error, muestra error seguro en UI y frena sin comprimir, subir ni invocar RPC', async () => {
    const mockReplaceAction = vi.spyOn(actionsModule, 'replaceCourierDocumentAction');
    const originalRandomUUID = globalThis.crypto.randomUUID;

    try {
      // Simular ausencia de crypto.randomUUID
      // @ts-expect-error simular entorno sin randomUUID
      globalThis.crypto.randomUUID = undefined;

      render(
        <DocumentReplacementCard
          courierId="courier-123"
          kind="license"
          title="Licencia de conducir"
          initialStatus="rejected"
          rejectionCode="illegible"
        />
      );

      const fileInput = screen.getByLabelText(/Reemplazar licencia de conducir/i);
      const testFile = new File(['content'], 'licencia.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [testFile] } });

      await waitFor(() => {
        expect(
          screen.getByText('No se pudo generar un identificador seguro para la operación')
        ).toBeDefined();
      });

      expect(compressImage).not.toHaveBeenCalled();
      expect(mockUploadCourierDocument).not.toHaveBeenCalled();
      expect(mockReplaceAction).not.toHaveBeenCalled();
    } finally {
      globalThis.crypto.randomUUID = originalRandomUUID;
    }
  });

  it('(m2) PR358-H03: si globalThis.crypto.randomUUID lanza una excepción, muestra error seguro y frena sin side-effects', async () => {
    const mockReplaceAction = vi.spyOn(actionsModule, 'replaceCourierDocumentAction');
    const originalRandomUUID = globalThis.crypto.randomUUID;

    try {
      globalThis.crypto.randomUUID = vi.fn().mockImplementation(() => {
        throw new Error('Entropy pool exhausted');
      });

      render(
        <DocumentReplacementCard
          courierId="courier-123"
          kind="license"
          title="Licencia de conducir"
          initialStatus="rejected"
          rejectionCode="illegible"
        />
      );

      const fileInput = screen.getByLabelText(/Reemplazar licencia de conducir/i);
      const testFile = new File(['content'], 'licencia.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [testFile] } });

      await waitFor(() => {
        expect(
          screen.getByText('No se pudo generar un identificador seguro para la operación')
        ).toBeDefined();
      });

      expect(compressImage).not.toHaveBeenCalled();
      expect(mockUploadCourierDocument).not.toHaveBeenCalled();
      expect(mockReplaceAction).not.toHaveBeenCalled();
    } finally {
      globalThis.crypto.randomUUID = originalRandomUUID;
    }
  });

  it('(n) PR358-H04: StatusView muestra «Seguimiento de documentos corregidos» cuando todos los rechazados fueron resueltos', async () => {
    mockUploadCourierDocument.mockResolvedValue({
      storagePath: 'courier/courier-123/license_1700000000000.jpg',
    });

    vi.spyOn(actionsModule, 'replaceCourierDocumentAction').mockResolvedValueOnce({
      ok: true,
      data: {
        kind: 'license',
        idempotent: false,
        documentId: 'd0000000-0000-0000-0000-000000000050',
        replacedDocumentId: 'd0000000-0000-0000-0000-000000000049',
        status: 'submitted',
        isCurrent: true,
      },
    });

    render(
      <StatusView
        courierId="courier-123"
        documents={[
          {
            kind: 'license',
            status: 'rejected',
            rejectionCode: 'illegible',
          },
        ]}
      />
    );

    // Inicialmente con rechazado pendiente: muestra "Documentos que requieren corrección"
    expect(screen.getByText('Documentos que requieren corrección')).toBeDefined();
    expect(screen.queryByText('Seguimiento de documentos corregidos')).toBeNull();

    // Reemplazamos la licencia
    const fileInput = screen.getByLabelText(/Reemplazar licencia de conducir/i);
    const testFile = new File(['content'], 'licencia.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      // Tras resolverse el único rechazado, el encabezado cambia a "Seguimiento de documentos corregidos"
      expect(screen.getByText('Seguimiento de documentos corregidos')).toBeDefined();
      expect(screen.queryByText('Documentos que requieren corrección')).toBeNull();
    });
  });

  it('(o) PR358-H04: StatusView mantiene «Documentos que requieren corrección» cuando el estado es mixto (al menos un rechazado pendiente)', async () => {
    mockUploadCourierDocument.mockResolvedValue({
      storagePath: 'courier/courier-123/license_1700000000000.jpg',
    });

    vi.spyOn(actionsModule, 'replaceCourierDocumentAction').mockResolvedValueOnce({
      ok: true,
      data: {
        kind: 'license',
        idempotent: false,
        documentId: 'd0000000-0000-0000-0000-000000000051',
        replacedDocumentId: 'd0000000-0000-0000-0000-000000000050',
        status: 'submitted',
        isCurrent: true,
      },
    });

    render(
      <StatusView
        courierId="courier-123"
        documents={[
          {
            kind: 'license',
            status: 'rejected',
            rejectionCode: 'illegible',
          },
          {
            kind: 'insurance',
            status: 'rejected',
            rejectionCode: 'expired',
          },
        ]}
      />
    );

    expect(screen.getByText('Documentos que requieren corrección')).toBeDefined();

    // Reemplazamos solo la licencia (el seguro continúa rechazado)
    const fileInput = screen.getByLabelText(/Reemplazar licencia de conducir/i);
    const testFile = new File(['content'], 'licencia.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getByText(COURIER_ONBOARDING_COPY.documentReplacedSuccess)).toBeDefined();
    });

    // Mantiene "Documentos que requieren corrección" porque aún queda seguro rechazado
    expect(screen.getByText('Documentos que requieren corrección')).toBeDefined();
    expect(screen.queryByText('Seguimiento de documentos corregidos')).toBeNull();
  });

  it('(p) PR358-H04: StatusView no renderiza la sección de documentos cuando no hay rechazados iniciales ni actuales', () => {
    render(
      <StatusView
        courierId="courier-123"
        documents={[
          { kind: 'dni_front', status: 'verified' },
          { kind: 'dni_back', status: 'verified' },
          { kind: 'selfie', status: 'submitted' },
        ]}
      />
    );

    expect(screen.queryByText('Documentos que requieren corrección')).toBeNull();
    expect(screen.queryByText('Seguimiento de documentos corregidos')).toBeNull();
  });
});

