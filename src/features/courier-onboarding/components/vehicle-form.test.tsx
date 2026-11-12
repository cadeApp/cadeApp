// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VehicleFormServerError } from './vehicle-form';

const SUPPORT_HREF = 'https://wa.me/5493815550000?text=Hola';

describe('CC-050 (SEC-09): error del envío del alta', () => {
  it('DNI_ALREADY_REGISTERED muestra el mensaje neutral, sin «rechazado» ni «registrado»', () => {
    render(<VehicleFormServerError code="DNI_ALREADY_REGISTERED" supportWhatsAppHref={SUPPORT_HREF} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('No pudimos completar tu alta con esos datos.');
    expect(alert.textContent).not.toMatch(/rechazad|registrad/i);
  });

  it('con enlace de soporte muestra «Hablar con cadeApp» en una pestaña nueva', () => {
    render(<VehicleFormServerError code="DNI_ALREADY_REGISTERED" supportWhatsAppHref={SUPPORT_HREF} />);
    const link = screen.getByRole('link', { name: 'Hablar con cadeApp' });
    expect(link.getAttribute('href')).toBe(SUPPORT_HREF);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('sin enlace no hay ningún wa.me y avisa que el soporte no está disponible', () => {
    const { container } = render(<VehicleFormServerError code="DNI_ALREADY_REGISTERED" supportWhatsAppHref={null} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.innerHTML).not.toContain('wa.me');
    expect(screen.getByRole('alert').textContent).toContain('El soporte no está disponible por ahora');
  });

  it('RATE_LIMITED muestra el cupo diario, no «unos segundos» ni «revisá los datos»', () => {
    render(<VehicleFormServerError code="RATE_LIMITED" supportWhatsAppHref={SUPPORT_HREF} />);
    const text = screen.getByRole('alert').textContent ?? '';
    expect(text).toContain('Alcanzaste el máximo de 5 intentos de alta de hoy. Volvé a intentar mañana.');
    expect(text).not.toMatch(/segundos|verificá los datos/i);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('otro error mantiene el mensaje genérico', () => {
    render(<VehicleFormServerError code="INTERNAL_ERROR" supportWhatsAppHref={SUPPORT_HREF} />);
    expect(screen.getByRole('alert').textContent).toContain('Ocurrió un error al procesar tu solicitud.');
  });
});
