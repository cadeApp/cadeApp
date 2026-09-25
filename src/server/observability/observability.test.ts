import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  scrubPii,
  captureError,
  sendCriticalAlert,
  sendTestAlert,
  checkUptimeHealth,
  type AlertPayload,
} from './index';

describe('T-310: Observabilidad, Sentry sin PII, Alertas y Runbooks de Backups', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.DISCORD_ERROR_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token';
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://sentry.io/api/test/store';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Sanitización de Datos Personales (PII Scrubber)', () => {
    it('debe anonimizar direcciones de email en strings y objetos', () => {
      const text = 'Error al notificar al usuario comerciante@ejemplo.com en su bandeja';
      const cleaned = scrubPii(text);
      expect(cleaned).not.toContain('comerciante@ejemplo.com');
      expect(cleaned).toContain('[REDACTED_EMAIL]');

      const obj = { user: 'cliente@dominio.ar', details: { contact: 'soporte@cadeapp.com' } };
      const cleanedObj = scrubPii(obj);
      expect(cleanedObj.user).toBe('[REDACTED_EMAIL]');
      expect(cleanedObj.details.contact).toBe('[REDACTED_EMAIL]');
    });

    it('debe anonimizar números de teléfono de Argentina (Aguilares / Tucumán / móvil nacional)', () => {
      const text = 'Contacto destinatario: +5493865123456 o fijo 03865-481234 o 3814998877';
      const cleaned = scrubPii(text);
      expect(cleaned).not.toContain('3865123456');
      expect(cleaned).not.toContain('3865-481234');
      expect(cleaned).not.toContain('3814998877');
      expect(cleaned).toContain('[REDACTED_PHONE]');
    });

    it('debe anonimizar números de DNI (7 u 8 dígitos) en mensajes y campos sensibles', () => {
      const text = 'Documento de identidad courier DNI 38123456 para verificación';
      const cleaned = scrubPii(text);
      expect(cleaned).not.toContain('38123456');
      expect(cleaned).toContain('[REDACTED_DNI]');

      const data = { dni: '40123987', courier_id: 'c-123' };
      const cleanedData = scrubPii(data);
      expect(cleanedData.dni).toBe('[REDACTED_DNI]');
      expect(cleanedData.courier_id).toBe('c-123');
    });

    it('debe anonimizar tokens JWT, Bearer tokens y claves de acceso', () => {
      const sampleJwt = ['eyJ' + 'hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'payload', 'sig'].join('.');
      const text = `Authorization: Bearer ${sampleJwt} y clave service_role`;
      const cleaned = scrubPii(text);
      expect(cleaned).not.toContain(sampleJwt);
      expect(cleaned).toContain('[REDACTED_TOKEN]');
    });

    it('debe proteger campos reservados del destinatario (notes, address, recipient)', () => {
      const sensitiveContext = {
        recipient_name: 'Juan Perez',
        recipient_phone: '+5493865998877',
        delivery_address: 'Av. Mitre 1234, Aguilares',
        notes: 'Dejar en la puerta lateral, timbre roto',
        request_id: 'req-abc-123',
      };
      const cleaned = scrubPii(sensitiveContext);
      expect(cleaned.recipient_name).toBe('[REDACTED_PII]');
      expect(cleaned.recipient_phone).toBe('[REDACTED_PHONE]');
      expect(cleaned.delivery_address).toBe('[REDACTED_PII]');
      expect(cleaned.notes).toBe('[REDACTED_PII]');
      expect(cleaned.request_id).toBe('req-abc-123');
    });

    it('H01: debe redactar pickup_address, dropoff_address y coordenadas numéricas exactas (pickup/dropoff_lat/lng)', () => {
      const raw = {
        pickup_address: 'San Martín 123',
        dropoff_address: 'Belgrano 456',
        pickup_lat: -27.4332,
        pickup_lng: -65.6141,
        dropoff_lat: -27.441,
        dropoff_lng: -65.607,
      };
      const cleaned = scrubPii(raw);
      const jsonStr = JSON.stringify(cleaned);

      expect(jsonStr).not.toContain('San Martín 123');
      expect(jsonStr).not.toContain('Belgrano 456');
      expect(jsonStr).not.toContain('-27.4332');
      expect(jsonStr).not.toContain('-65.6141');
      expect(jsonStr).not.toContain('-27.441');
      expect(jsonStr).not.toContain('-65.607');
    });
  });

  describe('2. Captura de Errores (Discord como Sink de Observabilidad sin PII — H13)', () => {
    it('H13: debe despachar errores sanitizados a Discord y NUNCA enviar a Sentry DSN en runtime', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
        text: async () => '',
      } as Response);

      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://example.invalid/sentry';
      process.env.DISCORD_ERROR_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token';

      const errorWithPii = new Error(
        'Fallo procesando pedido para juan@gmail.com con tel 3865445566'
      );
      const result = await captureError(errorWithPii, {
        context: 'payment_webhook',
        userEmail: 'juan@gmail.com',
        pickup_address: 'Alberdi 100, Aguilares',
        pickup_lat: -27.435,
      });

      expect(result.handled).toBe(true);
      expect(result.sanitizedMessage).toContain('[REDACTED_EMAIL]');
      expect(result.sanitizedMessage).toContain('[REDACTED_PHONE]');

      // H13: Debe haber llamado a Discord, NO al DSN de Sentry
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('discord.com/api/webhooks/'),
        expect.any(Object)
      );
      expect(fetchSpy).not.toHaveBeenCalledWith(
        'https://example.invalid/sentry',
        expect.anything()
      );

      // H02: Inspección del payload REAL enviado a la red
      const discordCall = fetchSpy.mock.calls.find((call) =>
        String(call[0]).includes('discord.com')
      );
      expect(discordCall).toBeDefined();
      const sentBody = String(discordCall![1]?.body);
      expect(sentBody).not.toContain('juan@gmail.com');
      expect(sentBody).not.toContain('3865445566');
      expect(sentBody).not.toContain('Alberdi 100');
      expect(sentBody).not.toContain('-27.435');

      fetchSpy.mockRestore();
    });

    it('debe degradar limpiamente y no lanzar error si el webhook de Discord falla', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

      const result = await captureError(new Error('Simulated crash'), {
        context: 'test_context',
      });

      expect(result.handled).toBe(true);
      expect(result.dispatched).toBe(false);
    });
  });

  describe('3. Alertas Críticas (Webhook Discord / Alerta al Admin)', () => {
    it('H03: no debe reportar éxito en sendTestAlert ni sendCriticalAlert si no hay webhook configurado', async () => {
      delete process.env.DISCORD_ERROR_WEBHOOK_URL;

      const testAlertResult = await sendTestAlert({ environment: 'staging' });
      expect(testAlertResult.ok).toBe(false);
      expect(testAlertResult.message).toMatch(/no configurad|error|fall/i);

      const criticalAlertResult = await sendCriticalAlert({
        type: 'test_alert',
        severity: 'critical',
        message: 'Alerta sin webhook',
      });
      expect(criticalAlertResult.ok).toBe(false);
      expect(criticalAlertResult.error).toBeDefined();
    });

    it('H02: debe enviar una alerta de prueba válida y el payload no debe contener datos sin sanitizar', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
        text: async () => '',
      } as Response);

      const response = await sendTestAlert({
        environment: 'staging',
        triggeredBy: 'Lautaro073',
      });

      expect(response.ok).toBe(true);
      expect(response.message).toContain('Alerta de prueba');
      expect(fetchSpy).toHaveBeenCalled();

      // H02: Inspección de body enviado
      const callArgs = fetchSpy.mock.calls[0];
      const body = JSON.parse(callArgs![1]?.body as string);
      expect(body.content).toContain('CRITICAL ALERT');
      fetchSpy.mockRestore();
    });

    it('H14: debe abortar por timeout si el webhook de Discord queda colgado y devolver ok: false sin lanzar', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          if (signal) {
            if (signal.aborted) {
              const err = new Error('The operation was aborted due to timeout');
              err.name = 'TimeoutError';
              reject(err);
              return;
            }
            signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted due to timeout');
              err.name = 'TimeoutError';
              reject(err);
            });
          }
        });
      });

      const startTime = Date.now();
      const result = await sendCriticalAlert(
        {
          type: 'test_alert',
          severity: 'critical',
          message: 'Alerta con webhook lento',
        },
        { timeoutMs: 50 }
      );
      const elapsed = Date.now() - startTime;

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/timeout|abort/i);
      expect(elapsed).toBeLessThan(1000);
    });

    it('H02: debe disparar alerta crítica cuando falla la publicación de solicitud y sanitizar coordenadas y direcciones', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
        text: async () => '',
      } as Response);

      const alertPayload: AlertPayload = {
        type: 'publish_request_failed',
        severity: 'critical',
        message: 'Error en RPC publish_request: base de datos bloqueada para cliente contacto@comercio.com',
        details: {
          merchantId: 'm-123',
          requestId: 'req-456',
          pickup_address: 'Av. Mitre 500',
          dropoff_address: 'Gorriti 120',
          pickup_lat: -27.431,
          pickup_lng: -65.612,
        },
      };

      const result = await sendCriticalAlert(alertPayload);
      expect(result.ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalled();

      const callArgs = fetchSpy.mock.calls[0];
      expect(callArgs).toBeDefined();
      const sentRawBody = callArgs![1]?.body as string;
      expect(sentRawBody).not.toContain('contacto@comercio.com');
      expect(sentRawBody).not.toContain('Av. Mitre 500');
      expect(sentRawBody).not.toContain('Gorriti 120');
      expect(sentRawBody).not.toContain('-27.431');
      expect(sentRawBody).not.toContain('-65.612');

      const sentBody = JSON.parse(sentRawBody);
      expect(sentBody.content ?? JSON.stringify(sentBody)).toMatch(/CRITICAL|publish_request_failed/);
      fetchSpy.mockRestore();
    });

    it('H01: debe redactar la matriz PII completa del esquema real (merchants, profiles, couriers, storage_path) y objetos anidados en el body de Discord', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
        text: async () => '',
      } as Response);

      const nestedDetails = {
        merchant: {
          default_pickup_address: 'San Martín 777',
          default_pickup_lat: -27.434,
          default_pickup_lng: -65.615,
        },
        profile: {
          display_name: 'Persona Prueba',
          phone: '(03865) 481-234',
        },
        courier: {
          vehicle_plate: 'AB123CD',
        },
        document: {
          storage_path: 'courier-uuid/dni_front.jpg',
        },
      };

      const result = await sendCriticalAlert({
        type: 'test_alert',
        severity: 'critical',
        message: 'Alerta con datos del esquema real',
        details: nestedDetails,
      });

      expect(result.ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalled();

      const callArgs = fetchSpy.mock.calls[0];
      const body = String(callArgs?.[1]?.body);

      expect(body).not.toContain('San Martín 777');
      expect(body).not.toContain('-27.434');
      expect(body).not.toContain('-65.615');
      expect(body).not.toContain('Persona Prueba');
      expect(body).not.toContain('481-234');
      expect(body).not.toContain('AB123CD');
      expect(body).not.toContain('courier-uuid/dni_front.jpg');

      fetchSpy.mockRestore();
    });

    it('debe disparar alerta crítica ante fallos en ofertas, aceptación o cron sweep', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
        text: async () => '',
      } as Response);

      const criticalTypes: AlertPayload['type'][] = [
        'submit_offer_failed',
        'accept_offer_failed',
        'cron_sweep_failed',
      ];

      for (const type of criticalTypes) {
        const result = await sendCriticalAlert({
          type,
          severity: 'critical',
          message: `Fallo crítico en operación: ${type}`,
          details: { error: 'Deadlock detectado' },
        });
        expect(result.ok).toBe(true);
      }

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      fetchSpy.mockRestore();
    });
  });

  describe('4. Monitor de Disponibilidad y Uptime (/api/health)', () => {
    it('debe verificar la disponibilidad de /api/health reportando status y latencia', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      } as Response);

      const health = await checkUptimeHealth('http://localhost:3000');
      expect(health.healthy).toBe(true);
      expect(health.status).toBe(200);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('H05: debe reportar estado unhealthy y emitir alerta uptime_unhealthy si /api/health no responde o retorna 500', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/api/health')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error',
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 204,
          text: async () => '',
        } as Response);
      });

      const health = await checkUptimeHealth('http://localhost:3000');
      expect(health.healthy).toBe(false);
      expect(health.status).toBe(500);

      // H05: Exigir que se haya despachado la alerta uptime_unhealthy a Discord
      const discordCall = fetchSpy.mock.calls.find(([url]) =>
        typeof url === 'string' && url.includes('discord.com')
      );
      expect(discordCall).toBeDefined();
      const discordBody = JSON.parse(discordCall![1]?.body as string);
      expect(discordBody.content).toContain('uptime_unhealthy');
      fetchSpy.mockRestore();
    });

    it('H05 / H06: debe abortar por timeout, reportar unhealthy y despachar alerta uptime_unhealthy si /api/health queda colgado sin responder', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
        if (typeof url === 'string' && url.includes('/api/health')) {
          return new Promise((_resolve, reject) => {
            const signal = init?.signal as AbortSignal | undefined;
            if (signal) {
              if (signal.aborted) {
                const err = new Error('The operation was aborted due to timeout');
                err.name = 'TimeoutError';
                reject(err);
                return;
              }
              signal.addEventListener('abort', () => {
                const err = new Error('The operation was aborted due to timeout');
                err.name = 'TimeoutError';
                reject(err);
              });
            }
          });
        }
        return Promise.resolve({
          ok: true,
          status: 204,
          text: async () => '',
        } as Response);
      });

      const health = await checkUptimeHealth('http://localhost:3000', 50);
      expect(health.healthy).toBe(false);
      expect(health.status).toBe(0);
      expect(health.error).toMatch(/abort|timeout/i);

      // H05: Exigir que se haya despachado la alerta uptime_unhealthy a Discord por timeout
      const discordCall = fetchSpy.mock.calls.find(([url]) =>
        typeof url === 'string' && url.includes('discord.com')
      );
      expect(discordCall).toBeDefined();
      const discordBody = JSON.parse(discordCall![1]?.body as string);
      expect(discordBody.content).toContain('uptime_unhealthy');
      fetchSpy.mockRestore();
    });
  });

  describe('5. Verificación de Documentación, Runbooks y Acta de Simulacro', () => {
    it('debe existir el runbook de backups y recuperación ante desastres con exclusión de courier-docs', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const runbookPath = path.resolve('docs/runbooks/backups-and-disaster-recovery.md');

      expect(fs.existsSync(runbookPath)).toBe(true);
      const content = fs.readFileSync(runbookPath, 'utf-8');

      expect(content).toContain('Point-in-Time Recovery');
      expect(content).toContain('courier-docs');
      expect(content).toContain('staging');
      expect(content).toContain('RPO');
      expect(content).toContain('RTO');
    });

    it('debe existir el acta de simulacro de restauración en staging documentando protocolo y estado', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const actaPath = path.resolve('docs/runbooks/acta-simulacro-restauracion-staging.md');

      expect(fs.existsSync(actaPath)).toBe(true);
      const content = fs.readFileSync(actaPath, 'utf-8');

      expect(content).toContain('Acta de Simulacro de Restauración');
      expect(content).toContain('staging');
      expect(content).toContain('Lautaro073');
      expect(content).toContain('courier-docs');
      expect(content).toMatch(/PENDIENTE|NO VERIFICADO|APROBADO|EXITOSO/i);
    });
  });
});
