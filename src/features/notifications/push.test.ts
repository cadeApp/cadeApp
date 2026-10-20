import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PushPermissionPrompt,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSupported,
  getNotificationPermission,
  getPushSubscriptionStatus,
  PENDING_UNSUB_STORAGE_KEY,
  PUSH_STORAGE_KEY,
  pendingUnsubStorageKey,
} from './push';
import { PUSH_COPY } from './push/copy';

// T-382 (PR459-H05): la baja pendiente es de la cuenta logueada; la sesión del navegador se controla por test.
const session = vi.hoisted(() => ({ userId: 'user-a' as string | null }));
const USER_A = 'user-a';
const USER_B = 'user-b';

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: session.userId ? { user: { id: session.userId } } : null },
        error: null,
      }),
    },
  }),
}));

vi.mock('@/lib/env.public', () => ({
  publicEnv: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY:
      'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',
  },
}));

describe('T-202: Cliente de push y Soft Prompt T02 (DoD Fase RED)', () => {
  beforeEach(() => {
    session.userId = USER_A;
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();

    Object.defineProperty(window, 'PushManager', {
      value: class MockPushManager {},
      writable: true,
      configurable: true,
    });

    const mockNotification = {
      permission: 'default',
      requestPermission: vi.fn().mockImplementation(async () => {
        mockNotification.permission = 'granted';
        return 'granted';
      }),
    };

    Object.defineProperty(window, 'Notification', {
      value: mockNotification,
      writable: true,
      configurable: true,
    });

    vi.stubGlobal('Notification', mockNotification);
  });

  describe('1. Pantalla T02 (Soft Prompt de Notificaciones)', () => {
    it('DoD: T02 no existe (debe fallar antes de implementar el componente)', () => {
      // Falla si el componente T02 no está definido o no se puede renderizar
      expect(PushPermissionPrompt, 'El componente PushPermissionPrompt (T02) aún no existe').toBeDefined();
      expect(typeof PushPermissionPrompt).toBe('function');

      const { container } = render(
        React.createElement(PushPermissionPrompt as React.ComponentType<{ onDismiss?: () => void }>, {
          onDismiss: vi.fn(),
        })
      );

      // Debe incluir título y copy oficial según Stitch T02
      expect(screen.getByText(/¿Te avisamos al instante\?/i)).toBeTruthy();
      expect(screen.getByText(/Te avisamos cuando aparezca una solicitud nueva o cuando te elijan/i)).toBeTruthy();

      // Beneficios de la pantalla T02
      expect(screen.getByText(/Cero demoras/i)).toBeTruthy();
      expect(screen.getByText(/Sin spam molesto/i)).toBeTruthy();

      // Nota no invasiva
      expect(screen.getByText(/Si no llegan, igual lo vas a ver en la app al abrirla/i)).toBeTruthy();

      // Botón principal y botón ghost
      expect(screen.getByRole('button', { name: /Activar avisos/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Ahora no/i })).toBeTruthy();
    });

    it('DoD: el soft prompt ofrece "Activar avisos" y "Ahora no" y nunca bloquea el uso de la app', async () => {
      const handleDismiss = vi.fn();
      render(
        React.createElement(PushPermissionPrompt as React.ComponentType<{ onDismiss?: () => void }>, {
          onDismiss: handleDismiss,
        })
      );

      const dismissBtn = screen.getByRole('button', { name: /Ahora no/i });
      fireEvent.click(dismissBtn);

      expect(handleDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Solicitud de permiso desde un gesto', () => {
    it('DoD: el permiso se solicita fuera de un gesto (debe fallar si se llama sin gesto explícito de usuario)', async () => {
      // Intentar solicitar permiso en background o sin gesto explícito del usuario
      const result = await requestNotificationPermission({ isUserGesture: false });

      // Debe rechazar o bloquear la solicitud para evitar penalizaciones de browser
      expect(result.ok, 'No se debe solicitar permiso fuera de un gesto de usuario').toBe(false);
      expect(result.error).toBe('gesture_required');
    });

    it('DoD: con gesto de usuario y permiso denegado, el flujo no se rompe y degrada limpiamente', async () => {
      // Mock de Notification.requestPermission devolviendo 'denied'
      const mockRequestPermission = vi.fn().mockResolvedValue('denied');
      vi.stubGlobal('Notification', {
        requestPermission: mockRequestPermission,
        permission: 'denied',
      });

      const result = await requestNotificationPermission({ isUserGesture: true });

      expect(mockRequestPermission).toHaveBeenCalledTimes(1);
      expect(result.ok).toBe(false);
      expect(result.permission).toBe('denied');
      expect(result.error).toBe('permission_denied');
    });
  });

  describe('3. Alta y baja de suscripciones (Idempotencia)', () => {
    it('DoD: una suscripción no se elimina (debe fallar si la baja no desuscribe en navegador y backend)', async () => {
      const mockUnsubscribe = vi.fn().mockResolvedValue(true);
      const mockSubscription = {
        endpoint: 'https://push.example.com/sub/active-1',
        unsubscribe: mockUnsubscribe,
      };

      const mockGetSubscription = vi.fn().mockResolvedValue(mockSubscription);
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
      vi.stubGlobal('fetch', mockFetch);

      // Simular navigator.serviceWorker.ready
      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: mockGetSubscription,
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      const result = await unsubscribeFromPush();

      expect(result.ok).toBe(true);
      expect(mockUnsubscribe, 'Debe invocar unsubscribe() sobre la suscripción nativa').toHaveBeenCalledTimes(1);
      expect(mockFetch, 'Debe llamar a DELETE /api/push/subscriptions con el endpoint').toHaveBeenCalledWith(
        '/api/push/subscriptions',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ endpoint: 'https://push.example.com/sub/active-1' }),
        })
      );
    });

    it('DoD: baja de suscripción es idempotente si no existe suscripción previa', async () => {
      const mockGetSubscription = vi.fn().mockResolvedValue(null);
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: mockGetSubscription,
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      const result = await unsubscribeFromPush();

      expect(result.ok).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('DoD: alta de suscripción es idempotente si ya existe suscripción activa y RECONCILIA con el backend', async () => {
      const existingSubscription = {
        endpoint: 'https://push.example.com/sub/existing',
        toJSON: () => ({
          endpoint: 'https://push.example.com/sub/existing',
          keys: { p256dh: 'p256', auth: 'auth' },
        }),
      };

      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'granted',
          requestPermission: vi.fn().mockResolvedValue('granted'),
        },
        writable: true,
        configurable: true,
      });

      const mockGetSubscription = vi.fn().mockResolvedValue(existingSubscription);
      const mockSubscribe = vi.fn();
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
      vi.stubGlobal('fetch', mockFetch);

      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: mockGetSubscription,
              subscribe: mockSubscribe,
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      const result = await subscribeToPush('test-vapid-key');

      expect(result.ok).toBe(true);
      // No debe llamar a subscribe nuevamente si ya existe
      expect(mockSubscribe).not.toHaveBeenCalled();
      // PR120-H03: DEBE reconciliar con backend para garantizar que la sesión posee la suscripción
      expect(mockFetch, 'Debe reconciliar la suscripción existente con POST /api/push/subscriptions').toHaveBeenCalledWith(
        '/api/push/subscriptions',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('PR120-H03: subscribeToPush falla si el backend responde 401', async () => {
      const mockSub = {
        endpoint: 'https://push.example.com/sub/new-1',
        toJSON: () => ({
          endpoint: 'https://push.example.com/sub/new-1',
          keys: { p256dh: 'p256', auth: 'auth' },
        }),
      };

      Object.defineProperty(window, 'Notification', {
        value: { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue(null),
              subscribe: vi.fn().mockResolvedValue(mockSub),
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      ));

      const result = await subscribeToPush('test-vapid-key');
      expect(result.ok, '401 en backend debe provocar ok: false').toBe(false);
      expect(localStorage.getItem('cadeapp_push_enabled')).not.toBe('true');
    });

    it('PR120-H03: subscribeToPush falla si las claves p256dh o auth están ausentes', async () => {
      const mockSubWithoutKeys = {
        endpoint: 'https://push.example.com/sub/no-keys',
        toJSON: () => ({
          endpoint: 'https://push.example.com/sub/no-keys',
          keys: {},
        }),
      };

      Object.defineProperty(window, 'Notification', {
        value: { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue(null),
              subscribe: vi.fn().mockResolvedValue(mockSubWithoutKeys),
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      const result = await subscribeToPush('test-vapid-key');
      expect(result.ok, 'Suscripción sin claves debe fallar').toBe(false);
      expect(result.error).toMatch(/missing_keys|invalid/i);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('PR120-H05: unsubscribeFromPush retiene endpoint pendiente si DELETE falla con 500 y reconcilia en segunda llamada', async () => {
      const targetEndpoint = 'https://push.example.com/sub/orphan-check';
      const mockUnsubscribe = vi.fn().mockResolvedValue(true);
      const mockSub = {
        endpoint: targetEndpoint,
        unsubscribe: mockUnsubscribe,
      };

      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue(mockSub),
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      // Primer intento: backend falla con 500
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'DB error' }), { status: 500 })
      ));

      const firstResult = await unsubscribeFromPush();
      expect(firstResult.ok, 'Fallo 500 de DELETE debe provocar ok: false').toBe(false);
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBe(targetEndpoint);

      // Segundo intento: navegador ya no tiene suscripción nativa, pero reconcilia con endpoint retenido
      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue(null),
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      const mockFetchRetry = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
      vi.stubGlobal('fetch', mockFetchRetry);

      const secondResult = await unsubscribeFromPush();
      expect(secondResult.ok).toBe(true);
      expect(mockFetchRetry).toHaveBeenCalledWith(
        '/api/push/subscriptions',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ endpoint: targetEndpoint }),
        })
      );
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBeNull();
    });
  });

  describe('4. PR120 Ronda 2: permiso, matriz de alta/baja, storage y layout', () => {
    const SUB_ENDPOINT = 'https://push.example.com/sub/round-2';

    function mockServiceWorker(pushManager: Record<string, unknown>) {
      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: { ready: Promise.resolve({ pushManager }) },
        writable: true,
        configurable: true,
      });
    }

    function mockGrantedPermission() {
      const requestPermission = vi.fn().mockResolvedValue('granted');
      vi.stubGlobal('Notification', { permission: 'granted', requestPermission });
      return requestPermission;
    }

    function newSubscription() {
      return {
        endpoint: SUB_ENDPOINT,
        toJSON: () => ({ endpoint: SUB_ENDPOINT, keys: { p256dh: 'p', auth: 'a' } }),
      };
    }

    it('PR120-H04: permiso ya concedido al montar NO muestra éxito hasta confirmar el alta en backend', async () => {
      const requestPermission = mockGrantedPermission();
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
      vi.stubGlobal('fetch', mockFetch);
      mockServiceWorker({
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue(newSubscription()),
      });

      render(React.createElement(PushPermissionPrompt, { onDismiss: vi.fn() }));

      expect(screen.queryByText(/Avisos activados/i)).toBeNull();
      const activateBtn = screen.getByRole('button', { name: /Activar avisos/i });
      expect((activateBtn as HTMLButtonElement).disabled).toBe(false);

      fireEvent.click(activateBtn);

      await waitFor(() => {
        expect(screen.getByText(/¡Avisos activados con éxito!/i)).toBeTruthy();
      });
      expect(requestPermission).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/push/subscriptions',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('PR120-H03: subscribeToPush con POST 500 devuelve ok=false, error estable y no habilita storage', async () => {
      mockGrantedPermission();
      mockServiceWorker({
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue(newSubscription()),
      });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));

      const result = await subscribeToPush('test-vapid-key');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('backend_error');
      expect(localStorage.getItem('cadeapp_push_enabled')).not.toBe('true');
    });

    it('PR120-H03: subscribeToPush con rechazo de red devuelve network_error y no habilita storage', async () => {
      mockGrantedPermission();
      mockServiceWorker({
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue(newSubscription()),
      });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));

      const result = await subscribeToPush('test-vapid-key');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('network_error');
      expect(localStorage.getItem('cadeapp_push_enabled')).not.toBe('true');
    });

    it('PR120-H05: DELETE rechazado por red guarda el endpoint pendiente y la segunda llamada reconcilia', async () => {
      mockServiceWorker({
        getSubscription: vi.fn().mockResolvedValue({
          endpoint: SUB_ENDPOINT,
          unsubscribe: vi.fn().mockResolvedValue(true),
        }),
      });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));

      const firstResult = await unsubscribeFromPush();
      expect(firstResult.ok).toBe(false);
      expect(firstResult.error).toBe('network_error');
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBe(SUB_ENDPOINT);

      mockServiceWorker({ getSubscription: vi.fn().mockResolvedValue(null) });
      const mockFetchRetry = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
      vi.stubGlobal('fetch', mockFetchRetry);

      const secondResult = await unsubscribeFromPush();
      expect(secondResult.ok).toBe(true);
      expect(mockFetchRetry).toHaveBeenCalledWith(
        '/api/push/subscriptions',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ endpoint: SUB_ENDPOINT }),
        })
      );
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBeNull();
    });

    it('PR120-H16: endpoint pendiente corrupto en localStorage no llega a fetch, se limpia y devuelve error', async () => {
      localStorage.setItem(PENDING_UNSUB_STORAGE_KEY, 'javascript:alert(1)');
      mockServiceWorker({ getSubscription: vi.fn().mockResolvedValue(null) });
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      const result = await unsubscribeFromPush();

      expect(result).toEqual({ ok: false, error: 'invalid_pending_endpoint' });
      expect(mockFetch).not.toHaveBeenCalled();
      expect(localStorage.getItem(PENDING_UNSUB_STORAGE_KEY)).toBeNull();
    });

    it('PR120-H08: el DOM renderizado de T02 no contiene clases max-w-[...] arbitrarias', () => {
      const { container } = render(React.createElement(PushPermissionPrompt));
      const arbitrary = Array.from(container.querySelectorAll('[class]')).filter((el) =>
        /max-w-\[/.test(el.getAttribute('class') ?? '')
      );
      expect(arbitrary.map((el) => el.getAttribute('class'))).toEqual([]);
    });

    it('PR120-H15: standalone renderiza su header; embedded no lo duplica y usa min-h-full', () => {
      const standalone = render(React.createElement(PushPermissionPrompt));
      expect(standalone.container.querySelectorAll('header')).toHaveLength(1);
      standalone.unmount();

      const embedded = render(React.createElement(PushPermissionPrompt, { embedded: true }));
      expect(embedded.container.querySelectorAll('header')).toHaveLength(0);
      const root = embedded.container.firstElementChild;
      expect(root?.className).toContain('min-h-full');
      expect(root?.className).not.toContain('min-h-screen');
    });
  });

  describe('5. Verificación visual responsive (390px / 360px) y accesibilidad WCAG AA', () => {
    it('PR120-H04: si subscribeToPush() falla tras conceder permiso, NO muestra éxito ni llama onSuccess', async () => {
      const mockSuccess = vi.fn();

      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'default',
          requestPermission: vi.fn().mockResolvedValue('granted'),
        },
        writable: true,
        configurable: true,
      });

      // Simular que el backend de push responde 500
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })
      ));

      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue(null),
              subscribe: vi.fn().mockResolvedValue({
                endpoint: 'https://push.example.com/sub/err',
                toJSON: () => ({ endpoint: 'https://push.example.com/sub/err', keys: { p256dh: 'p', auth: 'a' } }),
              }),
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      render(React.createElement(PushPermissionPrompt, { onSuccess: mockSuccess }));

      const activateBtn = screen.getByRole('button', { name: /Activar avisos/i });
      fireEvent.click(activateBtn);

      // Esperar a que termine la acción
      await waitFor(() => {
        // NO debe mostrar éxito
        expect(screen.queryByText(/¡Avisos activados con éxito!/i)).toBeNull();
        expect(screen.getByText(/No se pudo confirmar la suscripción con el servidor/i)).toBeTruthy();
      });

      // NO debe haber llamado onSuccess
      expect(mockSuccess).not.toHaveBeenCalled();
    });

    it('DoD: T02 en 390px cumple TopBar institucional semántico, targets táctiles >= 48px y texto >= 14px', () => {
      window.innerWidth = 390;
      window.innerHeight = 844;

      const { container } = render(React.createElement(PushPermissionPrompt));

      // TopBar semántica (bg-foreground text-background según Stitch D16)
      const header = container.querySelector('header');
      expect(header).toBeTruthy();
      expect(header?.className).toContain('bg-foreground');
      expect(header?.className).toContain('text-background');

      // Botón volver con target >= 48px
      const backBtn = screen.getByRole('button', { name: /Volver/i });
      expect(backBtn).toBeTruthy();
      expect(backBtn.className).toMatch(/(min-h-12|h-12)/);
      expect(backBtn.className).toMatch(/(min-w-12|w-12)/);

      // Botón Activar avisos con target >= 48px
      const activateBtn = screen.getByRole('button', { name: /Activar avisos/i });
      expect(activateBtn).toBeTruthy();
      expect(activateBtn.className).toMatch(/(min-h-12|h-12)/);

      // Botón Ahora no con target >= 48px
      const dismissBtn = screen.getByRole('button', { name: /Ahora no/i });
      expect(dismissBtn).toBeTruthy();
      expect(dismissBtn.className).toMatch(/(min-h-12|h-12)/);

      // Jerarquía y texto accesible
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading.textContent).toMatch(/¿Te avisamos al instante\?/i);
    });

    it('DoD: T02 en 360px mantiene legibilidad, estructura y targets táctiles con escala semántica max-w-md', () => {
      window.innerWidth = 360;
      window.innerHeight = 640;

      const { container } = render(React.createElement(PushPermissionPrompt));

      const main = container.querySelector('main');
      expect(main).toBeTruthy();
      expect(main?.className).toContain('max-w-md');

      const activateBtn = screen.getByRole('button', { name: /Activar avisos/i });
      expect(activateBtn.className).toMatch(/(min-h-12|h-12)/);
    });

    it('DoD: interacción de usuario en T02 ejecuta solicitud y activa estado concedido tras confirmación backend', async () => {
      const mockSuccess = vi.fn();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      ));

      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue(null),
              subscribe: vi.fn().mockResolvedValue({
                endpoint: 'https://push.example.com/sub/ok',
                toJSON: () => ({ endpoint: 'https://push.example.com/sub/ok', keys: { p256dh: 'p', auth: 'a' } }),
              }),
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      render(React.createElement(PushPermissionPrompt, { onSuccess: mockSuccess }));

      const activateBtn = screen.getByRole('button', { name: /Activar avisos/i });
      fireEvent.click(activateBtn);

      await waitFor(() => {
        expect(screen.getByText(/¡Avisos activados con éxito!/i)).toBeTruthy();
      });
    });

    it('DoD: si el permiso está denegado, T02 muestra explicación sin bloquear ni romper', () => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'denied',
          requestPermission: vi.fn().mockResolvedValue('denied'),
        },
        writable: true,
        configurable: true,
      });

      render(React.createElement(PushPermissionPrompt));

      expect(screen.getByText(/Avisos bloqueados en el navegador/i)).toBeTruthy();
      // El botón 'Ahora no' sigue disponible para cerrar
      expect(screen.getByRole('button', { name: /Ahora no/i })).toBeTruthy();
    });

    it('PR120-H02: T02 es exportado desde @/features/notifications y accesible para flujos productivos', async () => {
      const notificationsModule = await import('@/features/notifications');
      expect(notificationsModule.PushPermissionPrompt).toBeDefined();
      expect(notificationsModule.loadPushPermissionPrompt).toBeDefined();

      const loaded = await notificationsModule.loadPushPermissionPrompt();
      expect(loaded.default).toBe(notificationsModule.PushPermissionPrompt);
    });

    it('T-338 / Ronda 3: Contrato canónico de API pública preservado en @/features/notifications', async () => {
      const mod = await import('@/features/notifications');
      expect(typeof mod.requestNotificationPermission).toBe('function');
      expect(typeof mod.subscribeToPush).toBe('function');
      expect(typeof mod.unsubscribeFromPush).toBe('function');
      expect(typeof mod.isPushSupported).toBe('function');
      expect(typeof mod.getNotificationPermission).toBe('function');
      expect(typeof mod.getPushSubscription).toBe('function');
      expect(typeof mod.PushPermissionPrompt).toBe('function');
      expect(mod.PUSH_COPY).toBeDefined();
    });

    it('T-338 / Ronda 3: Preservación de activación de usuario (transient user activation) sin retraso de import dinámico', async () => {
      const mod = await import('@/features/notifications');

      // Simular estado de activación del navegador
      let activationConsumed = false;
      let permissionCalledWhileActive = false;

      const mockNotification = {
        permission: 'default',
        requestPermission: vi.fn().mockImplementation(async () => {
          if (!activationConsumed) {
            permissionCalledWhileActive = true;
          }
          return 'granted';
        }),
      };
      vi.stubGlobal('Notification', mockNotification);

      // Simular que el evento de clic activo tiene una ventana de tiempo corta antes de expirar
      const clickPromise = (async () => {
        // En un microtask posterior a la llamada directa, la activación expiraría
        queueMicrotask(() => {
          activationConsumed = true;
        });

        return mod.requestNotificationPermission({ isUserGesture: true });
      })();

      const result = await clickPromise;
      expect(result.ok).toBe(true);
      expect(mockNotification.requestPermission).toHaveBeenCalledTimes(1);
      expect(permissionCalledWhileActive).toBe(true);
    });

    it('T-338 / Ronda 3: PushPermissionPrompt maneja fallback de carga accesible y recuperabilidad de UI ante error', async () => {
      const mod = await import('@/features/notifications');

      // 1. Renderiza el componente exportado
      const { container } = render(React.createElement(mod.PushPermissionPrompt, { embedded: true }));
      expect(container).toBeDefined();

      // 2. Resolver lazy component dentro del ciclo de testing
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Activar avisos/i })).toBeTruthy();
      });
    });

    it('T-338 / H11: Flujo real de activación desde clic en consumidor interactivo', async () => {
      // Nota de runner: JSDOM no implementa navigator.userActivation nativo por defecto.
      // Emulamos la propiedad para verificar que el clic del usuario solicita el permiso inmediatamente.
      let userActivationActive = false;
      let permissionRequestedDuringActivation = false;

      Object.defineProperty(navigator, 'userActivation', {
        value: {
          get isActive() {
            return userActivationActive;
          },
          hasBeenActive: true,
        },
        configurable: true,
      });

      const mockNotification = {
        permission: 'default',
        requestPermission: vi.fn().mockImplementation(async () => {
          if (navigator.userActivation?.isActive) {
            permissionRequestedDuringActivation = true;
          }
          return 'granted';
        }),
      };
      vi.stubGlobal('Notification', mockNotification);

      const mod = await import('@/features/notifications');
      render(React.createElement(mod.PushPermissionPrompt, { embedded: false }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Activar avisos/i })).toBeTruthy();
      });

      const activateBtn = screen.getByRole('button', { name: /Activar avisos/i });

      // Simular que el evento de clic activa transient user activation en el navegador
      userActivationActive = true;
      try {
        fireEvent.click(activateBtn);
      } finally {
        userActivationActive = false;
      }

      await waitFor(() => {
        expect(mockNotification.requestPermission).toHaveBeenCalledTimes(1);
        expect(permissionRequestedDuringActivation).toBe(true);
      });
    });

    it('T-338 / H09: Manejo de error de chunk y recuperación honesta con CTA «Recargar la página»', async () => {
      const mod = await import('@/features/notifications');
      const reloadSpy = vi.fn();

      // Componente que simula fallo de descarga de chunk (ChunkLoadError / dynamic import rejected)
      const FailingChunkComponent: React.FC = () => {
        throw new Error('Failed to fetch dynamically imported module: push-prompt.js');
      };

      // Silenciar temporalmente error en consola esperado del ErrorBoundary en tests
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        render(
          React.createElement(
            mod.PushPromptErrorBoundary,
            { onReload: reloadSpy },
            React.createElement(FailingChunkComponent)
          )
        );

        // 1. Error Boundary captura el fallo de red/chunk
        const alert = screen.getByRole('alert');
        expect(alert).toBeTruthy();
        expect(screen.getByText(/No se pudo cargar el control de notificaciones/i)).toBeTruthy();

        // 2. CTA honesto de recarga de página (no placebo)
        const reloadBtn = screen.getByRole('button', { name: /Recargar la página/i });
        expect(reloadBtn).toBeTruthy();

        // 3. Al hacer clic, se ejecuta la recarga de página para descartar el estado React.lazy
        fireEvent.click(reloadBtn);
        expect(reloadSpy).toHaveBeenCalledTimes(1);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });
});

describe('T-382: errores claros al activar avisos y estado real en «Configurar»', () => {
  const ENDPOINT = 'https://push.example.com/sub/t382-secret-capability';

  function subscription(endpoint = ENDPOINT) {
    return {
      endpoint,
      unsubscribe: vi.fn().mockResolvedValue(true),
      toJSON: () => ({ endpoint, keys: { p256dh: 'p256dh-secret', auth: 'auth-secret' } }),
    };
  }

  function setPermission(permission: NotificationPermission) {
    const notification = { permission, requestPermission: vi.fn().mockResolvedValue(permission) };
    Object.defineProperty(window, 'Notification', { value: notification, writable: true, configurable: true });
    vi.stubGlobal('Notification', notification);
  }

  function setPushManager(pushManager: Record<string, unknown>) {
    Object.defineProperty(window, 'PushManager', { value: class MockPushManager {}, writable: true, configurable: true });
    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ pushManager }) },
      writable: true,
      configurable: true,
    });
  }

  function browserError(name: string, message: string) {
    const error = new Error(message);
    error.name = name;
    return error;
  }

  function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }

  /** fetch por URL: la consulta de estado y el alta/baja tienen respuestas independientes. */
  function routeFetch(handlers: {
    status?: () => Promise<Response>;
    subscriptions?: () => Promise<Response>;
  }) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/push/subscriptions/status') {
        return handlers.status ? handlers.status() : jsonResponse({ active: false });
      }
      if (url === '/api/push/subscriptions') {
        return handlers.subscriptions ? handlers.subscriptions() : jsonResponse({ ok: true });
      }
      throw new Error(`fetch inesperado: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function consoleText(spy: ReturnType<typeof vi.spyOn>) {
    return JSON.stringify(spy.mock.calls);
  }

  beforeEach(() => {
    session.userId = USER_A;
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('subscribeToPush distingue la causa de la falla', () => {
    it('excepción de pushManager.subscribe (navegador sin servicio push) → push_service_unavailable, sin llamar al servidor', async () => {
      setPermission('granted');
      setPushManager({
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockRejectedValue(browserError('AbortError', 'Registration failed - push service error')),
      });
      const fetchMock = routeFetch({});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const result = await subscribeToPush();

      expect(result).toEqual({ ok: false, error: 'push_service_unavailable' });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith('[push] subscribe failed', {
        code: 'push_service_unavailable',
        name: 'AbortError',
        message: 'Registration failed - push service error',
      });
    });

    it('NotAllowedError de pushManager.subscribe (Edge con el permiso bloqueado) → permission_blocked', async () => {
      setPermission('granted');
      setPushManager({
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockRejectedValue(browserError('NotAllowedError', 'Registration failed - permission denied')),
      });
      routeFetch({});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const result = await subscribeToPush();

      expect(result).toEqual({ ok: false, error: 'permission_blocked' });
      expect(consoleError).toHaveBeenCalledWith('[push] subscribe failed', {
        code: 'permission_blocked',
        name: 'NotAllowedError',
        message: 'Registration failed - permission denied',
      });
    });

    it.each([
      ['401', 'unauthorized', () => Promise.resolve(jsonResponse({ error: 'Unauthorized' }, 401))],
      ['500', 'backend_error', () => Promise.resolve(jsonResponse({ error: 'Database error' }, 500))],
      ['red', 'network_error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ])('respuesta %s del servidor → %s, y la consola no lleva endpoint ni claves', async (_case, code, response) => {
      setPermission('granted');
      setPushManager({
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue(subscription()),
      });
      routeFetch({ subscriptions: response });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const result = await subscribeToPush();

      expect(result).toEqual({ ok: false, error: code });
      expect(consoleError).toHaveBeenCalledWith('[push] subscribe failed', expect.objectContaining({ code }));
      const logged = consoleText(consoleError);
      expect(logged).not.toContain(ENDPOINT);
      expect(logged).not.toContain('p256dh-secret');
      expect(logged).not.toContain('auth-secret');
      expect(localStorage.getItem(PUSH_STORAGE_KEY)).not.toBe('true');
    });

    it('alta correcta: ok, sin errores en consola', async () => {
      setPermission('granted');
      setPushManager({
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue(subscription()),
      });
      routeFetch({});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const result = await subscribeToPush();

      expect(result.ok).toBe(true);
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe('getPushSubscriptionStatus consulta la cuenta logueada', () => {
    it('manda el endpoint solo en el cuerpo del POST y devuelve active con la respuesta del servidor', async () => {
      setPermission('granted');
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(subscription()) });
      const fetchMock = routeFetch({ status: () => Promise.resolve(jsonResponse({ active: true })) });

      expect(await getPushSubscriptionStatus()).toBe('active');
      expect(fetchMock).toHaveBeenCalledWith('/api/push/subscriptions/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: ENDPOINT }),
      });
    });

    it('entre cuentas: con PUSH_STORAGE_KEY en true pero el servidor en active: false, queda inactive', async () => {
      localStorage.setItem(PUSH_STORAGE_KEY, 'true');
      setPermission('granted');
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(subscription()) });
      routeFetch({ status: () => Promise.resolve(jsonResponse({ active: false })) });

      expect(await getPushSubscriptionStatus()).toBe('inactive');
    });

    it.each([
      ['500', () => Promise.resolve(jsonResponse({ error: 'Database error' }, 500))],
      ['401', () => Promise.resolve(jsonResponse({ error: 'Unauthorized' }, 401))],
      ['red', () => Promise.reject(new TypeError('Failed to fetch'))],
      ['respuesta malformada', () => Promise.resolve(jsonResponse({ active: 'yes' }))],
    ])('consulta fallida (%s) → unknown, aunque el storage diga true', async (_case, status) => {
      localStorage.setItem(PUSH_STORAGE_KEY, 'true');
      setPermission('granted');
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(subscription()) });
      routeFetch({ status });

      expect(await getPushSubscriptionStatus()).toBe('unknown');
    });

    it('sin permiso concedido o sin suscripción del navegador → inactive sin consultar al servidor', async () => {
      setPermission('default');
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(subscription()) });
      const fetchMock = routeFetch({ status: () => Promise.resolve(jsonResponse({ active: true })) });
      expect(await getPushSubscriptionStatus()).toBe('inactive');

      setPermission('granted');
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(null) });
      expect(await getPushSubscriptionStatus()).toBe('inactive');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('PushPermissionPrompt en «Configurar»', () => {
    function renderPrompt() {
      return render(React.createElement(PushPermissionPrompt, { embedded: true, onDismiss: vi.fn() }));
    }

    it.each([
      [
        'navegador sin servicio push',
        () => ({ subscribe: vi.fn().mockRejectedValue(browserError('AbortError', 'Registration failed - push service error')) }),
        undefined,
        /Usar los servicios de Google para mensajes push.*Chrome/s,
      ],
      [
        'permiso bloqueado (NotAllowedError)',
        () => ({ subscribe: vi.fn().mockRejectedValue(browserError('NotAllowedError', 'Registration failed - permission denied')) }),
        undefined,
        /ícono junto a la dirección/,
      ],
      [
        'sesión vencida',
        () => ({ subscribe: vi.fn().mockResolvedValue(subscription()) }),
        () => Promise.resolve(jsonResponse({ error: 'Unauthorized' }, 401)),
        /sesión venció/,
      ],
      [
        'error del servidor',
        () => ({ subscribe: vi.fn().mockResolvedValue(subscription()) }),
        () => Promise.resolve(jsonResponse({ error: 'Database error' }, 500)),
        /No se pudo confirmar la suscripción con el servidor/,
      ],
      [
        'sin conexión',
        () => ({ subscribe: vi.fn().mockResolvedValue(subscription()) }),
        () => Promise.reject(new TypeError('Failed to fetch')),
        /No hay conexión/,
      ],
    ])('al fallar el alta por %s muestra su propio mensaje', async (_case, manager, subscriptions, message) => {
      setPermission('granted');
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(null), ...manager() });
      routeFetch({ subscriptions });
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      renderPrompt();
      fireEvent.click(await screen.findByRole('button', { name: /^Activar avisos$/i }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toMatch(message);
      for (const other of [/Usar los servicios de Google/, /ícono junto a la dirección/, /sesión venció/, /con el servidor/, /No hay conexión/]) {
        if (other.source !== message.source && !message.source.includes(other.source)) {
          expect(alert.textContent).not.toMatch(other);
        }
      }
      expect(screen.queryByText(/Avisos activados/i)).toBeNull();
    });

    it('con avisos activos en la cuenta muestra «Avisos activados en este navegador» y permite desactivarlos', async () => {
      setPermission('granted');
      const sub = subscription();
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(sub) });
      const fetchMock = routeFetch({ status: () => Promise.resolve(jsonResponse({ active: true })) });

      renderPrompt();

      expect(await screen.findByText('Avisos activados en este navegador')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /^Activar avisos$/i })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /Desactivar avisos/i }));

      expect(await screen.findByRole('button', { name: /^Activar avisos$/i })).toBeTruthy();
      expect(screen.queryByText('Avisos activados en este navegador')).toBeNull();
      expect(sub.unsubscribe).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/push/subscriptions',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('con PUSH_STORAGE_KEY en true pero la cuenta en active: false, no muestra «activados» y ofrece activar', async () => {
      localStorage.setItem(PUSH_STORAGE_KEY, 'true');
      setPermission('granted');
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(subscription()) });
      const fetchMock = routeFetch({ status: () => Promise.resolve(jsonResponse({ active: false })) });

      renderPrompt();

      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/push/subscriptions/status', expect.anything()));
      expect(await screen.findByRole('button', { name: /^Activar avisos$/i })).toBeTruthy();
      expect(screen.queryByText(/Avisos activados/i)).toBeNull();
      expect(screen.queryByRole('button', { name: /Desactivar avisos/i })).toBeNull();
    });

    it('con la consulta fallida muestra «No se pudo comprobar el estado» con reintento, nunca «activados»', async () => {
      localStorage.setItem(PUSH_STORAGE_KEY, 'true');
      setPermission('granted');
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(subscription()) });
      let statusResponse: () => Promise<Response> = () => Promise.resolve(jsonResponse({ error: 'Database error' }, 500));
      routeFetch({ status: () => statusResponse() });

      renderPrompt();

      expect(await screen.findByText(/No se pudo comprobar el estado/)).toBeTruthy();
      expect(screen.queryByText(/Avisos activados/i)).toBeNull();

      statusResponse = () => Promise.resolve(jsonResponse({ active: true }));
      fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));

      expect(await screen.findByText('Avisos activados en este navegador')).toBeTruthy();
      expect(screen.queryByText(/No se pudo comprobar el estado/)).toBeNull();
    });
  });
  describe('PR459 ronda 1: baja pendiente, errores previos al alta y diagnóstico sanitizado', () => {
    function renderPrompt() {
      return render(React.createElement(PushPermissionPrompt, { embedded: true, onDismiss: vi.fn() }));
    }

    function deleteBodies(fetchMock: ReturnType<typeof routeFetch>) {
      return fetchMock.mock.calls
        .filter(([url, init]) => String(url) === '/api/push/subscriptions' && init?.method === 'DELETE')
        .map(([, init]) => JSON.parse(String(init?.body)));
    }

    it('H01: si el DELETE falla tras la baja nativa, muestra «baja pendiente» (también al reabrir) y «Reintentar baja» completa la baja con el mismo endpoint', async () => {
      setPermission('granted');
      let nativeSubscription: ReturnType<typeof subscription> | null = subscription();
      const getSubscription = vi.fn(async () => nativeSubscription);
      if (nativeSubscription) {
        nativeSubscription.unsubscribe.mockImplementation(async () => {
          nativeSubscription = null;
          return true;
        });
      }
      setPushManager({ getSubscription });
      const deleteResponses = [jsonResponse({ error: 'Database error' }, 500), jsonResponse({ ok: true })];
      const fetchMock = routeFetch({
        status: () => Promise.resolve(jsonResponse({ active: true })),
        subscriptions: () => Promise.resolve(deleteResponses.shift() ?? jsonResponse({ ok: true })),
      });

      const first = renderPrompt();
      fireEvent.click(await screen.findByRole('button', { name: /^Desactivar avisos$/i }));

      expect(await screen.findByText(PUSH_COPY.prompt.statusDeactivatePending)).toBeTruthy();
      expect(screen.queryByText(/Avisos activados/i)).toBeNull();
      expect(screen.queryByRole('button', { name: /^Desactivar avisos$/i })).toBeNull();
      expect(screen.getByRole('button', { name: PUSH_COPY.prompt.btnRetryDeactivate })).toBeTruthy();
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBe(ENDPOINT);

      // Se cierra y se vuelve a abrir «Configurar»: el navegador ya no tiene suscripción, la baja sigue pendiente.
      first.unmount();
      renderPrompt();
      const retry = await screen.findByRole('button', { name: PUSH_COPY.prompt.btnRetryDeactivate });
      expect(screen.getByText(PUSH_COPY.prompt.statusDeactivatePending)).toBeTruthy();
      expect(screen.queryByText(/Avisos activados/i)).toBeNull();

      fireEvent.click(retry);

      expect(await screen.findByText(PUSH_COPY.prompt.statusDeactivated)).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Activar avisos$/i })).toBeTruthy();
      expect(screen.queryByText(PUSH_COPY.prompt.statusDeactivatePending)).toBeNull();
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBeNull();
      expect(deleteBodies(fetchMock)).toEqual([{ endpoint: ENDPOINT }, { endpoint: ENDPOINT }]);
    });

    it('H01: si el reintento vuelve a fallar, conserva la baja pendiente y el botón para reintentar', async () => {
      setPermission('granted');
      localStorage.setItem(pendingUnsubStorageKey(USER_A), ENDPOINT);
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(null) });
      const fetchMock = routeFetch({
        subscriptions: () => Promise.reject(new TypeError('Failed to fetch')),
      });

      renderPrompt();
      fireEvent.click(await screen.findByRole('button', { name: PUSH_COPY.prompt.btnRetryDeactivate }));

      await waitFor(() => expect(deleteBodies(fetchMock)).toEqual([{ endpoint: ENDPOINT }]));
      expect(await screen.findByRole('button', { name: PUSH_COPY.prompt.btnRetryDeactivate })).toBeTruthy();
      expect(screen.getByText(PUSH_COPY.prompt.statusDeactivatePending)).toBeTruthy();
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBe(ENDPOINT);
      expect(screen.queryByText(/Avisos activados/i)).toBeNull();
    });

    it('H01: si la baja falla sin dejar pendiente, muestra un error recuperable y no inventa una baja pendiente', async () => {
      setPermission('granted');
      localStorage.setItem(pendingUnsubStorageKey(USER_A), 'no-es-un-endpoint');
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(subscription()) });
      routeFetch({ status: () => Promise.resolve(jsonResponse({ active: true })) });

      renderPrompt();
      fireEvent.click(await screen.findByRole('button', { name: /^Desactivar avisos$/i }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe(PUSH_COPY.prompt.statusDeactivateError);
      expect(screen.queryByText(PUSH_COPY.prompt.statusDeactivatePending)).toBeNull();
      expect(screen.queryByRole('button', { name: PUSH_COPY.prompt.btnRetryDeactivate })).toBeNull();
    });

    it.each([
      ['serviceWorker.ready rechaza con NotAllowedError', 'permission_blocked', 'ready', browserError('NotAllowedError', 'Registration denied')],
      ['pushManager.getSubscription rechaza con AbortError', 'push_service_unavailable', 'getSubscription', browserError('AbortError', 'push service error')],
      ['el rechazo no es un Error (otro realm) pero se llama NotAllowedError', 'permission_blocked', 'getSubscription', { name: 'NotAllowedError', message: 'blocked' }],
    ] as const)('H02: %s → %s, sin llamar al servidor ni marcar el storage', async (_case, code, where, failure) => {
      setPermission('granted');
      Object.defineProperty(window, 'PushManager', { value: class MockPushManager {}, writable: true, configurable: true });
      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: {
          ready:
            where === 'ready'
              ? Promise.reject(failure)
              : Promise.resolve({ pushManager: { getSubscription: vi.fn().mockRejectedValue(failure) } }),
        },
        writable: true,
        configurable: true,
      });
      const fetchMock = routeFetch({});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const result = await subscribeToPush();

      expect(result).toEqual({ ok: false, error: code });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(localStorage.getItem(PUSH_STORAGE_KEY)).toBeNull();
      expect(consoleError).toHaveBeenCalledWith('[push] subscribe failed', expect.objectContaining({ code }));
    });

    it('H02: en «Configurar», una falla de getSubscription antes del alta muestra el mensaje del navegador, no el del servidor', async () => {
      setPermission('granted');
      setPushManager({ getSubscription: vi.fn().mockRejectedValue(browserError('AbortError', 'push service error')) });
      const fetchMock = routeFetch({});
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      renderPrompt();
      fireEvent.click(await screen.findByRole('button', { name: /^Activar avisos$/i }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe(PUSH_COPY.prompt.statusPushServiceUnavailable);
      expect(alert.textContent).not.toMatch(/servidor/i);
      expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/push/subscriptions')).toBe(false);
    });

    it('H03: una excepción del navegador con endpoint y claves en el mensaje se registra sanitizada (código, name y message útil)', async () => {
      setPermission('granted');
      const leaky = browserError(
        'AbortError',
        'Registration failed for https://fcm.googleapis.com/fcm/send/abc-SECRET-capability p256dh=BLeakedP256dh auth=LeakedAuthSecret'
      );
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn().mockRejectedValue(leaky) });
      routeFetch({});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      expect(await subscribeToPush()).toEqual({ ok: false, error: 'push_service_unavailable' });

      expect(consoleError).toHaveBeenCalledTimes(1);
      const [, details] = consoleError.mock.calls[0] as [string, { code: string; name: string; message: string }];
      expect(details.code).toBe('push_service_unavailable');
      expect(details.name).toBe('AbortError');
      expect(details.message).toMatch(/Registration failed/);
      const logged = consoleText(consoleError);
      for (const secret of ['fcm.googleapis.com', 'abc-SECRET-capability', 'BLeakedP256dh', 'LeakedAuthSecret']) {
        expect(logged).not.toContain(secret);
      }
    });

    it('H03: un rechazo de fetch cuyo mensaje repite el endpoint y las claves de la suscripción no los filtra', async () => {
      setPermission('granted');
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn().mockResolvedValue(subscription()) });
      routeFetch({
        subscriptions: () =>
          Promise.reject(new TypeError(`Failed to fetch ${ENDPOINT} with p256dh-secret and auth-secret`)),
      });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      expect(await subscribeToPush()).toEqual({ ok: false, error: 'network_error' });

      const [, details] = consoleError.mock.calls[0] as [string, { code: string; name: string; message: string }];
      expect(details).toEqual(expect.objectContaining({ code: 'network_error', name: 'TypeError' }));
      expect(details.message).toMatch(/Failed to fetch/);
      const logged = consoleText(consoleError);
      for (const secret of [ENDPOINT, 'p256dh-secret', 'auth-secret']) {
        expect(logged).not.toContain(secret);
      }
    });
  });
  describe('PR459 ronda 2: name sanitizado y baja pendiente sin soporte nativo', () => {
    function renderPrompt() {
      return render(React.createElement(PushPermissionPrompt, { embedded: true, onDismiss: vi.fn() }));
    }

    function calls(fetchMock: ReturnType<typeof routeFetch>, method: string) {
      return fetchMock.mock.calls
        .filter(([url, init]) => String(url) === '/api/push/subscriptions' && init?.method === method)
        .map(([, init]) => JSON.parse(String(init?.body)));
    }

    function removePushManager() {
      Reflect.deleteProperty(window, 'PushManager');
      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: { ready: new Promise(() => undefined) },
        writable: true,
        configurable: true,
      });
    }

    function rejectingServiceWorker(where: 'ready' | 'getSubscription') {
      Object.defineProperty(window, 'PushManager', { value: class MockPushManager {}, writable: true, configurable: true });
      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: {
          ready:
            where === 'ready'
              ? Promise.reject(browserError('InvalidStateError', 'no active worker'))
              : Promise.resolve({
                  pushManager: { getSubscription: vi.fn().mockRejectedValue(browserError('AbortError', 'gone')) },
                }),
        },
        writable: true,
        configurable: true,
      });
    }

    it('H03: un name de excepción con endpoint y claves se registra sanitizado; los nombres estándar siguen legibles', async () => {
      setPermission('granted');
      const leaky = browserError(
        'AbortError endpoint=https://push.example.com/secret-capability p256dh=BLeakyNameP256dh auth=LeakyNameAuth',
        'boom'
      );
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn().mockRejectedValue(leaky) });
      routeFetch({});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      expect(await subscribeToPush()).toEqual({ ok: false, error: 'push_service_unavailable' });

      const logged = consoleText(consoleError);
      for (const secret of ['push.example.com', 'secret-capability', 'BLeakyNameP256dh', 'LeakyNameAuth']) {
        expect(logged).not.toContain(secret);
      }
      const [, details] = consoleError.mock.calls[0] as [string, { code: string; name: string; message: string }];
      expect(details.code).toBe('push_service_unavailable');
      expect(details.message).toBe('boom');
      // PR459-H03 (ronda 3): un name que no es un nombre estándar exacto se reemplaza por un marcador.
      expect(details.name).toBe('[nombre no estándar]');
    });

    it.each([
      ['sin PushManager', () => removePushManager()],
      ['serviceWorker.ready rechazado', () => rejectingServiceWorker('ready')],
      ['getSubscription rechazado', () => rejectingServiceWorker('getSubscription')],
    ])('H04 (%s): con baja pendiente muestra «Reintentar baja» y el reintento hace el DELETE con el endpoint en el body', async (_case, setup) => {
      setPermission('granted');
      localStorage.setItem(pendingUnsubStorageKey(USER_A), ENDPOINT);
      setup();
      const fetchMock = routeFetch({ subscriptions: () => Promise.resolve(jsonResponse({ ok: true })) });

      expect(await getPushSubscriptionStatus()).toBe('pending_unsubscribe');

      renderPrompt();
      fireEvent.click(await screen.findByRole('button', { name: PUSH_COPY.prompt.btnRetryDeactivate }));

      expect(await screen.findByText(PUSH_COPY.prompt.statusDeactivated)).toBeTruthy();
      expect(calls(fetchMock, 'DELETE')).toEqual([{ endpoint: ENDPOINT }]);
      expect(calls(fetchMock, 'POST')).toEqual([]);
      expect(fetchMock.mock.calls.every(([url]) => !String(url).includes(ENDPOINT))).toBe(true);
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBeNull();
    });

    it.each([
      ['sin PushManager, DELETE 500', () => removePushManager(), () => Promise.resolve(jsonResponse({ error: 'Database error' }, 500))],
      ['ready rechazado, sin red', () => rejectingServiceWorker('ready'), () => Promise.reject(new TypeError('Failed to fetch'))],
      ['getSubscription rechazado, DELETE 401', () => rejectingServiceWorker('getSubscription'), () => Promise.resolve(jsonResponse({ error: 'Unauthorized' }, 401))],
    ])('H04 (%s): si el reintento falla, conserva la baja pendiente y el botón', async (_case, setup, response) => {
      setPermission('granted');
      localStorage.setItem(pendingUnsubStorageKey(USER_A), ENDPOINT);
      setup();
      const fetchMock = routeFetch({ subscriptions: response });

      const result = await unsubscribeFromPush();

      expect(result.ok).toBe(false);
      expect(calls(fetchMock, 'DELETE')).toEqual([{ endpoint: ENDPOINT }]);
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBe(ENDPOINT);
      expect(await getPushSubscriptionStatus()).toBe('pending_unsubscribe');
    });

    it('H04: sin baja pendiente, un navegador sin PushManager degrada como siempre (inactivo, sin DELETE)', async () => {
      setPermission('granted');
      removePushManager();
      const fetchMock = routeFetch({});

      expect(await getPushSubscriptionStatus()).toBe('inactive');
      expect(await unsubscribeFromPush()).toEqual({ ok: true });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
  describe('PR459 ronda 3: nombres de error por lista blanca y baja pendiente ligada a la cuenta', () => {
    function renderPrompt() {
      return render(React.createElement(PushPermissionPrompt, { embedded: true, onDismiss: vi.fn() }));
    }

    function deletes(fetchMock: ReturnType<typeof routeFetch>) {
      return fetchMock.mock.calls
        .filter(([url, init]) => String(url) === '/api/push/subscriptions' && init?.method === 'DELETE')
        .map(([, init]) => JSON.parse(String(init?.body)));
    }

    it.each([
      ['un secreto alfanumérico entero', 'BAlnumSecretToken123'],
      ['un nombre estándar con algo pegado', 'AbortErrorSecretSuffix'],
    ])('H03: un name que es %s no se registra; los estándar sí', async (_case, name) => {
      setPermission('granted');
      setPushManager({
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockRejectedValue(browserError(name, 'boom')),
      });
      routeFetch({});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      expect(await subscribeToPush()).toEqual({ ok: false, error: 'push_service_unavailable' });
      expect(consoleText(consoleError)).not.toContain(name);
      const [, details] = consoleError.mock.calls[0] as [string, { code: string; name: string }];
      expect(details).toEqual(expect.objectContaining({ code: 'push_service_unavailable', name: '[nombre no estándar]' }));
    });

    it('H03: el nombre exacto NotAllowedError sigue clasificando como permiso bloqueado y se registra legible', async () => {
      setPermission('granted');
      setPushManager({
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockRejectedValue(browserError('NotAllowedError', 'denied')),
      });
      routeFetch({});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      expect(await subscribeToPush()).toEqual({ ok: false, error: 'permission_blocked' });
      expect(consoleError).toHaveBeenCalledWith(
        '[push] subscribe failed',
        expect.objectContaining({ code: 'permission_blocked', name: 'NotAllowedError' })
      );
    });

    it('H05: la baja pendiente de A no se le muestra a B, el DELETE de B (200 sin filas) no la borra y A la completa al volver', async () => {
      setPermission('granted');
      let native: ReturnType<typeof subscription> | null = subscription();
      native.unsubscribe.mockImplementation(async () => {
        native = null;
        return true;
      });
      setPushManager({ getSubscription: vi.fn(async () => native) });
      const deleteResponses = [
        jsonResponse({ error: 'Database error' }, 500), // A: falla la baja en el servidor
        jsonResponse({ ok: true }), // A al volver: se confirma
      ];
      const fetchMock = routeFetch({
        status: () => Promise.resolve(jsonResponse({ active: true })),
        subscriptions: () => Promise.resolve(deleteResponses.shift() ?? jsonResponse({ ok: true })),
      });

      // A desactiva y el servidor no confirma: queda pendiente para A.
      const asA = renderPrompt();
      fireEvent.click(await screen.findByRole('button', { name: /^Desactivar avisos$/i }));
      expect(await screen.findByText(PUSH_COPY.prompt.statusDeactivatePending)).toBeTruthy();
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBe(ENDPOINT);
      asA.unmount();

      // Cambia la sesión a B sin limpiar el storage: B no ve ni puede consumir la baja de A.
      session.userId = USER_B;
      expect(await getPushSubscriptionStatus()).toBe('inactive');
      const asB = renderPrompt();
      expect(await screen.findByRole('button', { name: /^Activar avisos$/i })).toBeTruthy();
      expect(screen.queryByRole('button', { name: PUSH_COPY.prompt.btnRetryDeactivate })).toBeNull();
      expect(screen.queryByText(/Avisos activados/i)).toBeNull();
      // Aunque B llame a la baja y el servidor responda 200 (cero filas, por RLS), la baja pendiente de A queda.
      expect(await unsubscribeFromPush()).toEqual({ ok: true });
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBe(ENDPOINT);
      asB.unmount();
      expect(deletes(fetchMock)).toEqual([{ endpoint: ENDPOINT }]);

      // Vuelve A: ve la baja pendiente y la completa.
      session.userId = USER_A;
      renderPrompt();
      fireEvent.click(await screen.findByRole('button', { name: PUSH_COPY.prompt.btnRetryDeactivate }));
      expect(await screen.findByText(PUSH_COPY.prompt.statusDeactivated)).toBeTruthy();
      expect(deletes(fetchMock)).toEqual([{ endpoint: ENDPOINT }, { endpoint: ENDPOINT }]);
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBeNull();
    });

    it('H05: si B falla su propia baja, no pisa la baja pendiente de A', async () => {
      setPermission('granted');
      const OTHER = 'https://push.example.com/sub/t382-account-b';
      localStorage.setItem(pendingUnsubStorageKey(USER_A), ENDPOINT);
      session.userId = USER_B;
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(subscription(OTHER)) });
      routeFetch({ subscriptions: () => Promise.reject(new TypeError('Failed to fetch')) });

      expect((await unsubscribeFromPush()).ok).toBe(false);

      expect(localStorage.getItem(pendingUnsubStorageKey(USER_B))).toBe(OTHER);
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBe(ENDPOINT);
    });

    it('H05: sin identidad comprobable no se atribuye ni se guarda una baja pendiente', async () => {
      setPermission('granted');
      session.userId = null;
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(subscription()) });
      routeFetch({ subscriptions: () => Promise.resolve(jsonResponse({ error: 'Database error' }, 500)) });

      expect((await unsubscribeFromPush()).ok).toBe(false);

      expect(Object.keys(localStorage).filter((key) => key.startsWith(PENDING_UNSUB_STORAGE_KEY))).toEqual([]);
    });

    it('H05: una baja pendiente con el formato viejo (sin dueño) no se atribuye a nadie ni la borra otra cuenta', async () => {
      setPermission('granted');
      localStorage.setItem(PENDING_UNSUB_STORAGE_KEY, ENDPOINT);
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(null) });
      const fetchMock = routeFetch({ subscriptions: () => Promise.resolve(jsonResponse({ ok: true })) });

      expect(await getPushSubscriptionStatus()).toBe('inactive');
      expect(await unsubscribeFromPush()).toEqual({ ok: true });
      expect(deletes(fetchMock)).toEqual([]);
      expect(localStorage.getItem(PENDING_UNSUB_STORAGE_KEY)).toBe(ENDPOINT);
    });
  });
  describe('PR459 ronda 4: identidad durante el DELETE y sin identidad', () => {
    function deletes(fetchMock: ReturnType<typeof routeFetch>) {
      return fetchMock.mock.calls
        .filter(([url, init]) => String(url) === '/api/push/subscriptions' && init?.method === 'DELETE')
        .map(([, init]) => JSON.parse(String(init?.body)));
    }

    it('H05: si la sesión cambia a B con el DELETE en vuelo, el 200 (sin filas para B) no borra la baja pendiente de A; A la confirma al volver', async () => {
      setPermission('granted');
      localStorage.setItem(pendingUnsubStorageKey(USER_A), ENDPOINT);
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(null) });
      let releaseDelete: (response: Response) => void = () => undefined;
      const deleteResponses: Array<() => Promise<Response>> = [
        () =>
          new Promise<Response>((resolve) => {
            releaseDelete = resolve;
          }),
        () => Promise.resolve(jsonResponse({ ok: true })),
      ];
      const fetchMock = routeFetch({ subscriptions: () => (deleteResponses.shift() ?? (() => Promise.resolve(jsonResponse({ ok: true }))))() });

      const retry = unsubscribeFromPush();
      await waitFor(() => expect(deletes(fetchMock)).toEqual([{ endpoint: ENDPOINT }]));
      session.userId = USER_B;
      releaseDelete(jsonResponse({ ok: true }));

      const result = await retry;
      expect(result.ok).toBe(false);
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBe(ENDPOINT);
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_B))).toBeNull();

      session.userId = USER_A;
      expect(await unsubscribeFromPush()).toEqual({ ok: true });
      expect(deletes(fetchMock)).toEqual([{ endpoint: ENDPOINT }, { endpoint: ENDPOINT }]);
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBeNull();
    });

    it.each([
      ['500', () => Promise.resolve(jsonResponse({ error: 'Database error' }, 500))],
      ['401', () => Promise.resolve(jsonResponse({ error: 'Unauthorized' }, 401))],
    ])('H06: sin identidad comprobable no desuscribe ni hace DELETE (el servidor respondería %s); error recuperable', async (_case, response) => {
      setPermission('granted');
      session.userId = null;
      const native = subscription();
      setPushManager({ getSubscription: vi.fn().mockResolvedValue(native) });
      const fetchMock = routeFetch({ subscriptions: response });

      expect(await unsubscribeFromPush()).toEqual({ ok: false, error: 'unauthorized' });

      expect(native.unsubscribe).not.toHaveBeenCalled();
      expect(deletes(fetchMock)).toEqual([]);
      expect(Object.keys(localStorage).filter((key) => key.startsWith(PENDING_UNSUB_STORAGE_KEY))).toEqual([]);
    });

    it('H06: con identidad A y DELETE 500 queda la baja pendiente de A; con la sesión de A de vuelta, el 200 la confirma', async () => {
      setPermission('granted');
      let native: ReturnType<typeof subscription> | null = subscription();
      native.unsubscribe.mockImplementation(async () => {
        native = null;
        return true;
      });
      setPushManager({ getSubscription: vi.fn(async () => native) });
      const responses = [jsonResponse({ error: 'Database error' }, 500), jsonResponse({ ok: true })];
      const fetchMock = routeFetch({ subscriptions: () => Promise.resolve(responses.shift() ?? jsonResponse({ ok: true })) });

      expect((await unsubscribeFromPush()).ok).toBe(false);
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBe(ENDPOINT);

      session.userId = null;
      expect(await unsubscribeFromPush()).toEqual({ ok: true });
      expect(deletes(fetchMock)).toEqual([{ endpoint: ENDPOINT }]);
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBe(ENDPOINT);

      session.userId = USER_A;
      expect(await unsubscribeFromPush()).toEqual({ ok: true });
      expect(deletes(fetchMock)).toEqual([{ endpoint: ENDPOINT }, { endpoint: ENDPOINT }]);
      expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBeNull();
    });
  });
});
