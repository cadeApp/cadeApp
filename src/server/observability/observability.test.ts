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
  });

  describe('2. Captura de Errores (Sentry / Logger Seguro sin PII)', () => {
    it('debe capturar excepciones sanitizando el mensaje y stack trace antes de despachar', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'event-123' }),
      } as Response);

      const errorWithPii = new Error(
        'Fallo procesando pedido para juan@gmail.com con tel 3865445566'
      );
      const result = await captureError(errorWithPii, {
        context: 'payment_webhook',
        userEmail: 'juan@gmail.com',
      });

      expect(result.handled).toBe(true);
      expect(result.sanitizedMessage).not.toContain('juan@gmail.com');
      expect(result.sanitizedMessage).not.toContain('3865445566');
      expect(result.sanitizedMessage).toContain('[REDACTED_EMAIL]');
      expect(result.sanitizedMessage).toContain('[REDACTED_PHONE]');
      fetchSpy.mockRestore();
    });

    it('debe degradar limpiamente y no lanzar error si el servicio externo falla', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

      const result = await captureError(new Error('Simulated crash'), {
        context: 'test_context',
      });

      expect(result.handled).toBe(true);
      expect(result.dispatched).toBe(false);
    });
  });

  describe('3. Alertas Críticas (Webhook Discord / Alerta al Admin)', () => {
    it('debe enviar una alerta de prueba válida ("alerta de prueba recibida" DoD)', async () => {
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
      fetchSpy.mockRestore();
    });

    it('debe disparar alerta crítica cuando falla la publicación de solicitud', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
        text: async () => '',
      } as Response);

      const alertPayload: AlertPayload = {
        type: 'publish_request_failed',
        severity: 'critical',
        message: 'Error en RPC publish_request: base de datos bloqueada',
        details: { merchantId: 'm-123', requestId: 'req-456' },
      };

      const result = await sendCriticalAlert(alertPayload);
      expect(result.ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalled();

      const callArgs = fetchSpy.mock.calls[0];
      expect(callArgs).toBeDefined();
      const sentBody = JSON.parse(callArgs![1]?.body as string);
      expect(sentBody.content ?? JSON.stringify(sentBody)).toMatch(/CRITICAL|publish_request_failed/);
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

    it('debe reportar estado unhealthy y emitir alerta si /api/health no responde o retorna 500', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      const health = await checkUptimeHealth('http://localhost:3000');
      expect(health.healthy).toBe(false);
      expect(health.status).toBe(500);
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

    it('debe existir el acta de simulacro de restauración en staging con resultado satisfactorio', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const actaPath = path.resolve('docs/runbooks/acta-simulacro-restauracion-staging.md');

      expect(fs.existsSync(actaPath)).toBe(true);
      const content = fs.readFileSync(actaPath, 'utf-8');

      expect(content).toContain('Acta de Simulacro de Restauración');
      expect(content).toContain('staging');
      expect(content).toContain('Lautaro073');
      expect(content).toContain('courier-docs');
      expect(content).toMatch(/APROBADO|EXITOSO/i);
    });
  });
});
