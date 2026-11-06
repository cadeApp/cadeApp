import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AdminNav, ADMIN_NAV_TABS } from './admin-nav';
import { logoutAction } from '@/features/auth';

const push = vi.fn();
const refresh = vi.fn();
let pathname = '/admin/applicants';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => pathname,
}));

vi.mock('@/features/auth', () => ({
  logoutAction: vi.fn(),
}));

describe('AdminNav (PR106-H10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = '/admin/applicants';
  });

  it('T-410: muestra «Viajes» entre Comercios e Incidentes y la marca activa en el detalle de un viaje', () => {
    pathname = '/admin/trips/00000000-0000-4000-8000-000000370001';
    render(<AdminNav operatorName="Lautaro" />);

    const links = screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/admin/') && link.textContent);
    const labels = links.map((link) => link.textContent);
    expect(labels.indexOf('Viajes')).toBe(labels.indexOf('Comercios') + 1);
    expect(labels.indexOf('Incidentes')).toBe(labels.indexOf('Viajes') + 1);

    const trips = screen.getByRole('link', { name: 'Viajes' });
    expect(trips.getAttribute('href')).toBe('/admin/trips');
    expect(trips.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Incidentes' }).getAttribute('aria-current')).toBeNull();
  });

  it('ejecuta logoutAction y redirige a /login al hacer click en Salir', async () => {
    vi.mocked(logoutAction).mockResolvedValue(undefined as never);

    render(<AdminNav operatorName="Lautaro" />);

    const logoutButton = screen.getByRole('button', { name: /salir/i });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(logoutAction).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith('/login');
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });
});

describe('T-402: shell del admin (barra lateral y menú angosto)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = '/admin/merchants';
  });

  const labels = ADMIN_NAV_TABS.map((tab) => tab.label);

  function sidebar() {
    const aside = screen.getByRole('complementary');
    return within(aside);
  }

  it('la barra lateral tiene el logo, todas las secciones con ícono y el activo con aria-current', () => {
    render(<AdminNav operatorName="Lautaro" />);
    const nav = sidebar().getByRole('navigation', { name: /navegación principal de administración/i });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(labels);
    for (const link of links) expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(links.filter((link) => link.getAttribute('aria-current') === 'page').map((l) => l.textContent)).toEqual([
      'Comercios',
    ]);
    expect(sidebar().getByRole('link', { name: /panel de administración cadeapp/i })).not.toBeNull();
  });

  it('T-425: «Contraer menú» deja solo íconos con nombre accesible y el logo sin texto; «Expandir menú» lo revierte', () => {
    render(<AdminNav operatorName="Lautaro" />);
    const toggle = sidebar().getByRole('button', { name: 'Contraer menú' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);

    const expand = sidebar().getByRole('button', { name: 'Expandir menú' });
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    const nav = sidebar().getByRole('navigation', { name: /navegación principal de administración/i });
    for (const link of within(nav).getAllByRole('link')) {
      expect(link.querySelector('span')?.className).toContain('sr-only');
    }
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(labels);
    expect(sidebar().getByRole('button', { name: /salir/i })).not.toBeNull();
    expect(sidebar().getByText('Lautaro').parentElement?.className).toContain('sr-only');

    fireEvent.click(expand);
    expect(sidebar().getByRole('button', { name: 'Contraer menú' })).not.toBeNull();
    expect(within(nav).getByRole('link', { name: 'Comercios' }).querySelector('span')?.className).not.toContain('sr-only');
  });

  it('abajo de la barra lateral están el nombre del operador y «Salir»', () => {
    render(<AdminNav operatorName="Lautaro Jiménez" />);
    expect(sidebar().queryByText('Lautaro Jiménez')).not.toBeNull();
    expect(sidebar().queryByRole('button', { name: /salir/i })).not.toBeNull();
  });

  it('en angosto, «Menú» abre la misma navegación, un ítem navega y cierra el menú', async () => {
    render(<AdminNav operatorName="Lautaro" />);
    const header = screen.getByRole('banner');
    const menu = within(header).getByRole('button', { name: /menú/i });
    expect(menu.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(menu);
    const dialog = await screen.findByRole('dialog');
    const nav = within(dialog).getByRole('navigation', { name: /navegación principal de administración/i });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(labels);
    expect(within(dialog).queryByText('Lautaro')).not.toBeNull();
    expect(within(dialog).queryByRole('button', { name: /salir/i })).not.toBeNull();

    const audit = within(nav).getByRole('link', { name: 'Auditoría' });
    expect(audit.getAttribute('href')).toBe('/admin/audit');
    fireEvent.click(audit);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('al cerrar el menú con Escape el foco vuelve a «Menú»', async () => {
    render(<AdminNav operatorName="Lautaro" />);
    const menu = within(screen.getByRole('banner')).getByRole('button', { name: /menú/i });
    menu.focus();
    fireEvent.click(menu);
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(menu));
  });

  it('ninguna sección del admin queda sin ítem en la navegación', () => {
    const adminDir = path.join(process.cwd(), 'src', 'app', '(admin)', 'admin');
    // `couriers` es un alias que redirige a Postulantes.
    const sections = fs
      .readdirSync(adminDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(adminDir, entry.name, 'page.tsx')))
      .map((entry) => entry.name)
      .filter((name) => !fs.readFileSync(path.join(adminDir, name, 'page.tsx'), 'utf-8').includes('redirect('));
    const hrefs = ADMIN_NAV_TABS.map((tab) => tab.href);
    expect(sections.length).toBeGreaterThan(5);
    expect(sections.filter((name) => !hrefs.includes(`/admin/${name}` as (typeof hrefs)[number]))).toEqual([]);
  });
});

describe('T-406: contador de incidentes abiertos en la navegación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = '/admin/merchants';
  });

  function sidebarIncidents() {
    const nav = within(screen.getByRole('complementary')).getByRole('navigation', {
      name: /navegación principal de administración/i,
    });
    return within(nav).getByRole('link', { name: /^incidentes/i });
  }

  it('con abiertos muestra el número junto a «Incidentes» y un texto accesible', () => {
    render(<AdminNav operatorName="Lautaro" incidentsBadge={{ count: 3, label: '3 incidentes abiertos' }} />);
    const link = sidebarIncidents();
    expect(link.getAttribute('href')).toBe('/admin/incidents');
    expect(within(link).getByTestId('admin-nav-incidents-count').textContent).toBe('3');
    expect(within(link).getByTestId('admin-nav-incidents-count').getAttribute('aria-hidden')).toBe('true');
    expect(link.textContent).toBe('Incidentes3, 3 incidentes abiertos');
    // El número solo aparece en «Incidentes».
    expect(screen.getAllByTestId('admin-nav-incidents-count')).toHaveLength(1);
  });

  it('contraída, el número queda sobre el ícono y el texto accesible se conserva', () => {
    render(<AdminNav operatorName="Lautaro" incidentsBadge={{ count: 1, label: '1 incidente abierto' }} />);
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Contraer menú' }));
    const link = sidebarIncidents();
    expect(within(link).getByTestId('admin-nav-incidents-count').className).toContain('absolute');
    expect(link.textContent).toContain('1 incidente abierto');
  });

  it.each([
    ['sin dato (la lectura falló)', null],
    ['con cero abiertos', { count: 0, label: '0 incidentes abiertos' }],
  ])('%s no muestra contador', (_name, incidentsBadge) => {
    render(<AdminNav operatorName="Lautaro" incidentsBadge={incidentsBadge} />);
    expect(screen.queryByTestId('admin-nav-incidents-count')).toBeNull();
    expect(sidebarIncidents().textContent).toBe('Incidentes');
  });
});
