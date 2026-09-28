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
} from './push';

describe('T-202: Cliente de push y Soft Prompt T02 (DoD Fase RED)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
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

    it('DoD: alta de suscripción es idempotente si ya existe suscripción activa', async () => {
      const existingSubscription = {
        endpoint: 'https://push.example.com/sub/existing',
        toJSON: () => ({
          endpoint: 'https://push.example.com/sub/existing',
          keys: { p256dh: 'p256', auth: 'auth' },
        }),
      };

      const mockGetSubscription = vi.fn().mockResolvedValue(existingSubscription);
      const mockSubscribe = vi.fn();

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
    });
  });
});
