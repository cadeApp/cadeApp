// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MerchantOnboardingForm } from './onboarding-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('../actions', () => ({
  merchantOnboardingAction: vi.fn(),
}));

describe('T-116 / T-111: MerchantOnboardingForm con componente de mapa', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockZones = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Centro',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Barrio Sur',
    },
  ];

  it('renderiza el formulario de alta de comercio con los campos y el selector de mapa', () => {
    render(<MerchantOnboardingForm zones={mockZones} />);

    expect(screen.getByLabelText(/nombre del negocio/i)).toBeDefined();
    expect(screen.getByLabelText(/teléfono de contacto/i)).toBeDefined();
    expect(screen.getByLabelText(/barrio de retiro/i)).toBeDefined();
    expect(screen.getByLabelText(/dirección de retiro habitual/i)).toBeDefined();
  });

  it('permite ingresar la dirección manualmente aun sin interactuar con el mapa', () => {
    render(<MerchantOnboardingForm zones={mockZones} />);

    const addressInput = screen.getByLabelText(/dirección de retiro habitual/i);
    fireEvent.change(addressInput, { target: { value: 'San Martín 450' } });

    expect(addressInput).toHaveProperty('value', 'San Martín 450');
  });
});
