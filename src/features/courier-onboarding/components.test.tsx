// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
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
      render(<StatusView />);

      expect(screen.getByText('Estamos revisando tus datos')).toBeDefined();
      expect(screen.getByText('En revisión manual')).toBeDefined();
      expect(screen.getByText('DNI frente y dorso')).toBeDefined();
      expect(screen.getByText('Selfie de seguridad')).toBeDefined();
      expect(screen.getByRole('button', { name: /Ir al panel de repartidor/i })).toBeDefined();
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
  });
});
