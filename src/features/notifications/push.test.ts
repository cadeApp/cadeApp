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
  getNotificationDataForEvent,
} from './push';

vi.mock('@/lib/env.public', () => ({
  publicEnv: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY:
      'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',
  },
}));

describe('T-202: Cliente de push y Soft Prompt T02 (DoD Fase RED)', () => {
  beforeEach(() => {
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
      expect(localStorage.getItem('cadeapp_pending_unsub_endpoint')).toBe(targetEndpoint);

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
      expect(localStorage.getItem('cadeapp_pending_unsub_endpoint')).toBeNull();
    });
  });

  describe('4. Mapeo estricto de eventos de Push sin PII (sw-handlers)', () => {
    it('DoD: mapea eventos de negocio a URLs canónicas sin filtrar datos personales', () => {
      const origin = 'https://cadeapp.ar';

      // 1. request_published -> /courier/feed
      const published = getNotificationDataForEvent(
        { event: 'request_published', requestId: '11111111-1111-4111-8111-111111111111' },
        origin
      );
      expect(published.data.url).toBe('https://cadeapp.ar/courier/feed');
      expect(published.title).toMatch(/solicitud/i);
      expect(JSON.stringify(published)).not.toMatch(/dni|teléfono|phone|address|calle|nombre/i);

      // 2. offer_submitted -> /merchant/requests/[id]
      const submitted = getNotificationDataForEvent(
        { event: 'offer_submitted', requestId: '11111111-1111-4111-8111-111111111111', offerId: '22222222-2222-4222-8222-222222222222' },
        origin
      );
      expect(submitted.data.url).toBe('https://cadeapp.ar/merchant/requests/11111111-1111-4111-8111-111111111111');
      expect(submitted.title).toMatch(/oferta/i);
      expect(JSON.stringify(submitted)).not.toMatch(/dni|teléfono|phone|address|calle|nombre/i);

      // 3. offer_accepted -> /trips/[id]
      const accepted = getNotificationDataForEvent(
        { event: 'offer_accepted', requestId: '11111111-1111-4111-8111-111111111111', offerId: '22222222-2222-4222-8222-222222222222' },
        origin
      );
      expect(accepted.data.url).toBe('https://cadeapp.ar/trips/11111111-1111-4111-8111-111111111111');
      expect(accepted.title).toMatch(/aceptada/i);
      expect(JSON.stringify(accepted)).not.toMatch(/dni|teléfono|phone|address|calle|nombre/i);

      // 4. request_cancelled -> /courier/feed
      const cancelled = getNotificationDataForEvent(
        { event: 'request_cancelled', requestId: '11111111-1111-4111-8111-111111111111' },
        origin
      );
      expect(cancelled.data.url).toBe('https://cadeapp.ar/courier/feed');
      expect(cancelled.title).toMatch(/cancelada/i);

      // 5. request_expired -> /courier/feed
      const expired = getNotificationDataForEvent(
        { event: 'request_expired', requestId: '11111111-1111-4111-8111-111111111111' },
        origin
      );
      expect(expired.data.url).toBe('https://cadeapp.ar/courier/feed');
      expect(expired.title).toMatch(/vencida/i);

      // 6. Payload nulo o desconocido -> fallback seguro
      const unknown = getNotificationDataForEvent(null, origin);
      expect(unknown.data.url).toBe('https://cadeapp.ar/');
      expect(unknown.title).toBe('cadeApp');
    });

    it('PR120-H11: inyección deliberada de PII en payload es rechazada/descartada sin llegar a título, cuerpo ni datos', () => {
      const origin = 'https://cadeapp.ar';
      const poisonedPayload = {
        event: 'request_published',
        requestId: '11111111-1111-4111-8111-111111111111',
        recipient_name: 'Santiago Benítez',
        phone: '+54 9 3865 123456',
        street_address: 'Av. San Martín 450, Piso 3',
        dni: '38999888',
        delivery_notes: 'Dejar en la reja negra',
      };

      const result = getNotificationDataForEvent(poisonedPayload, origin);
      const serialized = JSON.stringify(result);

      expect(serialized).not.toMatch(/santiago|ben[ií]tez|3865|123456|mart[ií]n|450|38999888|reja/i);
      expect(result.title).toBe('Nueva solicitud disponible');
      expect(result.data.url).toBe('https://cadeapp.ar/courier/feed');
      // Aseguramos que data solo contiene las propiedades autorizadas
      expect(Object.keys(result.data).sort()).toEqual(['event', 'requestId', 'url'].sort());
    });

    it('PR120-H06: payload con UUID inválido es rechazado por schema y degrada al fallback seguro', () => {
      const origin = 'https://cadeapp.ar';
      const invalidPayload = {
        event: 'request_published',
        requestId: 'not-a-valid-uuid',
      };

      const result = getNotificationDataForEvent(invalidPayload, origin);
      expect(result.title).toBe('cadeApp');
      expect(result.data.url).toBe('https://cadeapp.ar/');
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
  });
});

