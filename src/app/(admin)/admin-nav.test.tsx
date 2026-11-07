import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AdminNav, ADMIN_NAV_TABS, fetchOpenIncidentsCount, openIncidentsQueryOptions } from './admin-nav';
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

  it('T-427: la barra arranca contraída según la cookie y al alternar guarda la preferencia', () => {
    // La cookie es de path=/admin y jsdom no la devuelve en su URL: se mira lo que escribe la barra.
    const setCookie = vi.spyOn(document, 'cookie', 'set');
    render(<AdminNav operatorName="Lautaro" initialCollapsed />);
    const expand = sidebar().getByRole('button', { name: 'Expandir menú' });
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(expand);
    expect(setCookie).toHaveBeenLastCalledWith(expect.stringContaining('admin_sidebar=expanded; path=/admin'));
    fireEvent.click(sidebar().getByRole('button', { name: 'Contraer menú' }));
    expect(setCookie).toHaveBeenLastCalledWith(expect.stringContaining('admin_sidebar=collapsed; path=/admin'));
    setCookie.mockRestore();
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
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    pathname = '/admin/merchants';
    // Sin dato inicial, la navegación lee la ruta en vivo al montar; con dato, espera un minuto.
    fetchMock.mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('D01 = C: sin dato inicial lee /api/live/open-incidents y muestra el número', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ count: 2 }), { status: 200 }));
    render(<AdminNav operatorName="Lautaro" initialOpenIncidents={null} />);
    const badge = await within(screen.getByRole('complementary')).findByRole('img', { name: '2 incidentes abiertos' });
    expect(badge.textContent).toBe('2');
    expect(fetchMock).toHaveBeenCalledWith('/api/live/open-incidents', { cache: 'no-store' });
  });

  it('D01 = C: con dato inicial no vuelve a leer al montar y se relee cada minuto solo con la pestaña visible', () => {
    render(<AdminNav operatorName="Lautaro" initialOpenIncidents={3} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(openIncidentsQueryOptions(3)).toMatchObject({
      refetchInterval: 60_000,
      staleTime: 60_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: 'always',
      initialData: 3,
    });
    expect(openIncidentsQueryOptions(null)).not.toHaveProperty('initialData');
  });

  it('una respuesta fuera de contrato no se muestra', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ count: -1 }), { status: 200 }));
    await expect(fetchOpenIncidentsCount()).rejects.toThrow();
    fetchMock.mockResolvedValue(new Response('{}', { status: 403 }));
    await expect(fetchOpenIncidentsCount()).rejects.toThrow('HTTP 403');
  });

  function sidebarNav() {
    return within(
      within(screen.getByRole('complementary')).getByRole('navigation', {
        name: /navegación principal de administración/i,
      })
    );
  }

  it('con abiertos muestra el número junto a «Incidentes», sin cambiar el nombre del link', () => {
    render(<AdminNav operatorName="Lautaro" initialOpenIncidents={3} />);
    const link = sidebarNav().getByRole('link', { name: 'Incidentes' });
    expect(link.getAttribute('href')).toBe('/admin/incidents');
    expect(link.textContent).toBe('Incidentes');
    const badge = sidebarNav().getByRole('img', { name: '3 incidentes abiertos' });
    expect(badge.textContent).toBe('3');
    expect(link.closest('li')?.contains(badge)).toBe(true);
    expect(sidebarNav().getAllByRole('link').map((item) => item.textContent)).toEqual(
      ADMIN_NAV_TABS.map((tab) => tab.label)
    );
    // El número solo aparece una vez por navegación y solo en «Incidentes».
    expect(sidebarNav().getAllByTestId('admin-nav-incidents-count')).toHaveLength(1);
  });

  it('contraída, el número queda sobre el ícono y el texto accesible se conserva', () => {
    render(<AdminNav operatorName="Lautaro" initialOpenIncidents={1} />);
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Contraer menú' }));
    const badge = sidebarNav().getByRole('img', { name: '1 incidente abierto' });
    expect(badge.className).toContain('top-1');
  });

  it.each([
    ['sin dato (la lectura falló)', null],
    ['con cero abiertos', 0],
  ])('%s no muestra contador', (_name, initialOpenIncidents) => {
    render(<AdminNav operatorName="Lautaro" initialOpenIncidents={initialOpenIncidents} />);
    expect(screen.queryByTestId('admin-nav-incidents-count')).toBeNull();
    expect(sidebarNav().getByRole('link', { name: 'Incidentes' }).textContent).toBe('Incidentes');
  });
});
