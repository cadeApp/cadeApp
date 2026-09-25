import 'server-only';
import { serverEnv } from '@/server/env';
import { scrubPii } from './scrubber';

export interface AlertPayload {
  type:
    | 'publish_request_failed'
    | 'submit_offer_failed'
    | 'accept_offer_failed'
    | 'cron_sweep_failed'
    | 'uptime_unhealthy'
    | 'test_alert'
    | string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

export interface AlertResult {
  ok: boolean;
  message?: string;
  error?: string;
}

export interface AlertOptions {
  timeoutMs?: number;
}

export const DEFAULT_DISCORD_TIMEOUT_MS = 2500;

/**
 * Envía una alerta crítica al canal de operaciones (Discord Webhook o fallback)
 * garantizando que los datos incluidos pasen previamente por sanitización PII
 * y con timeout explícito para no bloquear el camino de ejecución ante caídas del webhook.
 */
export async function sendCriticalAlert(
  payload: AlertPayload,
  options?: AlertOptions
): Promise<AlertResult> {
  const sanitizedPayload: AlertPayload = {
    ...payload,
    message: scrubPii(payload.message),
    details: payload.details ? scrubPii(payload.details) : undefined,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  };

  let webhookUrl: string | undefined;
  let nodeEnv = 'development';

  try {
    webhookUrl = serverEnv.DISCORD_ERROR_WEBHOOK_URL || undefined;
    nodeEnv = serverEnv.NODE_ENV || 'development';
  } catch {
    webhookUrl = process.env.DISCORD_ERROR_WEBHOOK_URL || undefined;
    nodeEnv = process.env.NODE_ENV || 'development';
  }

  // Si no hay webhook configurado, no se puede informar entrega exitosa (H03)
  if (!webhookUrl) {
    if (nodeEnv !== 'test') {
      console.warn(
        `[ALERT-SIN-WEBHOOK] [${sanitizedPayload.severity.toUpperCase()}] ${sanitizedPayload.type}: ${sanitizedPayload.message}`,
        sanitizedPayload.details
      );
    }
    return {
      ok: false,
      error: 'DISCORD_ERROR_WEBHOOK_URL no está configurada; alerta no entregada a Discord',
    };
  }

  const colorMap: Record<string, number> = {
    info: 0x3498db, // Azul
    warning: 0xf39c12, // Amarillo
    error: 0xe74c3c, // Rojo
    critical: 0x9b59b6, // Púrpura / Alerta Máxima
  };

  const discordBody = {
    content: `🚨 **[CRITICAL ALERT - ${sanitizedPayload.severity.toUpperCase()}]** \`${sanitizedPayload.type}\``,
    embeds: [
      {
        title: sanitizedPayload.message.slice(0, 250),
        color: colorMap[sanitizedPayload.severity] ?? 0xe74c3c,
        fields: sanitizedPayload.details
          ? Object.entries(sanitizedPayload.details).map(([key, val]) => ({
              name: key,
              value: String(typeof val === 'object' ? JSON.stringify(val) : val).slice(0, 1024),
              inline: true,
            }))
          : [],
        footer: {
          text: `cadeApp · ${nodeEnv} · ${sanitizedPayload.timestamp}`,
        },
      },
    ],
  };

  const timeoutMs = options?.timeoutMs ?? DEFAULT_DISCORD_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Timeout superado al contactar Discord webhook (${timeoutMs}ms)`));
  }, timeoutMs);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok && res.status !== 204) {
      return { ok: false, error: `Webhook respondió con status ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout =
      controller.signal.aborted ||
      (err instanceof Error &&
        (err.name === 'TimeoutError' ||
          err.name === 'AbortError' ||
          err.message.toLowerCase().includes('timeout') ||
          err.message.toLowerCase().includes('aborted')));

    const errorMsg = isTimeout
      ? `Timeout superado al contactar Discord webhook (${timeoutMs}ms)`
      : err instanceof Error
        ? err.message
        : String(err);

    return { ok: false, error: errorMsg };
  }
}

/**
 * Envía una alerta de prueba para validar que el canal de alertas críticas esté activo y operativo.
 * Cumple con el requisito del DoD de T-310: "alerta de prueba recibida".
 */
export async function sendTestAlert(options?: {
  environment?: string;
  triggeredBy?: string;
}): Promise<AlertResult> {
  let defaultEnv = 'development';
  try {
    defaultEnv = serverEnv.NODE_ENV || 'development';
  } catch {
    defaultEnv = process.env.NODE_ENV || 'development';
  }
  const env = options?.environment ?? defaultEnv;
  const operator = options?.triggeredBy ?? 'Operador';

  const result = await sendCriticalAlert({
    type: 'test_alert',
    severity: 'info',
    message: `Alerta de prueba recibida exitosamente en el entorno ${env}`,
    details: {
      operador: operator,
      canal: 'Discord Webhook / Notificaciones Operativas',
      simulacro: 'T-310 Backups y Observabilidad',
    },
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      message: `Fallo al despachar alerta de prueba a Discord: ${result.error}`,
    };
  }

  return {
    ok: true,
    message: `Alerta de prueba recibida exitosamente en Discord (${env})`,
  };
}
