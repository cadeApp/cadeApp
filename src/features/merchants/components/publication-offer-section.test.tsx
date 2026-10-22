// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { PublicationOffer } from '@/domain';
import { PublicationOfferSection } from './publication-offer-section';

const PHONE = '+54 9 3865 123456';

const OFFER: PublicationOffer = {
  plans: [
    {
      planId: '00000000-0000-4000-8000-000000390002',
      name: 'Ilimitado',
      kind: 'unlimited',
      monthlyCredits: null,
      referencePriceArs: null,
    },
    {
      planId: '00000000-0000-4000-8000-000000390001',
      name: 'Plan 40',
      kind: 'quota',
      monthlyCredits: 40,
      referencePriceArs: 20000,
    },
  ],
  looseCreditReferencePriceArs: 900,
  launchDiscountPct: 15,
};

const wa = (message: string) => `https://wa.me/5493865123456?text=${encodeURIComponent(message)}`;

function renderSection(result: React.ComponentProps<typeof PublicationOfferSection>['result'], phone = PHONE) {
  render(<PublicationOfferSection result={result} supportPhone={phone} />);
  return screen.getByRole('region', { name: 'Planes disponibles' });
}

describe('T-412: planes disponibles en Mi plan', () => {
  afterEach(cleanup);

  it('lista cada plan con sus créditos o ilimitado y su precio de referencia', () => {
    const section = renderSection({ ok: true, data: OFFER });
    const items = within(within(section).getByRole('list', { name: 'Planes disponibles para tu comercio' })).getAllByRole(
      'listitem'
    );
    expect(items).toHaveLength(3);
    expect(within(items[0] as HTMLElement).getByText('Ilimitado')).toBeTruthy();
    expect(within(items[0] as HTMLElement).getByText('Publicaciones ilimitadas')).toBeTruthy();
    expect(within(items[0] as HTMLElement).getByText('Precio a consultar')).toBeTruthy();
    expect(within(items[1] as HTMLElement).getByText('40 créditos por mes')).toBeTruthy();
    expect(within(items[1] as HTMLElement).getByText('$ 20.000 por mes')).toBeTruthy();
    expect(within(items[2] as HTMLElement).getByText('Créditos sueltos')).toBeTruthy();
    expect(within(items[2] as HTMLElement).getByText('$ 900 por crédito · no vencen')).toBeTruthy();
    expect(within(section).getByText(/cadeApp no cobra dentro de la app/)).toBeTruthy();
  });

  it('cada botón abre el WhatsApp del soporte con lo elegido', () => {
    const section = renderSection({ ok: true, data: OFFER });
    const plan40 = within(section).getByRole('link', { name: 'Quiero este plan: Plan 40' });
    expect(plan40.getAttribute('href')).toBe(
      wa('Hola cadeApp, quiero contratar el plan «Plan 40» para mi comercio.')
    );
    expect(plan40.getAttribute('target')).toBe('_blank');
    expect(plan40.getAttribute('rel')).toBe('noopener noreferrer');
    expect(within(section).getByRole('link', { name: 'Quiero este plan: Ilimitado' }).getAttribute('href')).toBe(
      wa('Hola cadeApp, quiero contratar el plan «Ilimitado» para mi comercio.')
    );
    expect(within(section).getByRole('link', { name: 'Comprar créditos' }).getAttribute('href')).toBe(
      wa('Hola cadeApp, quiero comprar créditos sueltos para mi comercio.')
    );
  });

  it('avisa el descuento de primera compra solo si corresponde', () => {
    renderSection({ ok: true, data: OFFER });
    expect(screen.getByText('Tu primera compra tiene 15 % de descuento.')).toBeTruthy();
    cleanup();
    renderSection({ ok: true, data: { ...OFFER, launchDiscountPct: null } });
    expect(screen.queryByText(/de descuento/)).toBeNull();
  });

  it('sin precio de créditos sueltos no muestra esa fila', () => {
    const section = renderSection({ ok: true, data: { ...OFFER, looseCreditReferencePriceArs: null } });
    expect(within(section).queryByText('Créditos sueltos')).toBeNull();
    expect(within(section).queryByRole('link', { name: 'Comprar créditos' })).toBeNull();
  });

  it('sin número de soporte válido, los botones quedan deshabilitados con su aviso', () => {
    const section = renderSection({ ok: true, data: OFFER }, '');
    expect(within(section).queryAllByRole('link')).toHaveLength(0);
    const plan40 = within(section).getByRole('button', { name: 'Quiero este plan: Plan 40' }) as HTMLButtonElement;
    expect(plan40.disabled).toBe(true);
    expect((within(section).getByRole('button', { name: 'Comprar créditos' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(section).getByRole('status').textContent).toBe(
      'El contacto por WhatsApp no está disponible en este momento.'
    );
  });

  it('sin planes ni créditos sueltos, invita a escribir', () => {
    const section = renderSection({
      ok: true,
      data: { plans: [], looseCreditReferencePriceArs: null, launchDiscountPct: null },
    });
    expect(within(section).getByText('Por ahora no hay planes publicados. Escribinos y te contamos las opciones.'))
      .toBeTruthy();
    expect(within(section).queryByRole('list')).toBeNull();
  });

  it('PR528-H02: el descuento se avisa aunque todavía no haya planes ni precio de créditos', () => {
    const section = renderSection({
      ok: true,
      data: { plans: [], looseCreditReferencePriceArs: null, launchDiscountPct: 15 },
    });
    expect(within(section).getByText('Tu primera compra tiene 15 % de descuento.')).toBeTruthy();
    expect(within(section).getByText('Por ahora no hay planes publicados. Escribinos y te contamos las opciones.'))
      .toBeTruthy();
  });

  it('si la lectura falla, avisa en la sección', () => {
    const section = renderSection({ ok: false, code: 'INTERNAL_ERROR' });
    expect(within(section).getByRole('alert').textContent).toContain('No pudimos cargar los planes disponibles');
    expect(within(section).queryByRole('list')).toBeNull();
  });
});
