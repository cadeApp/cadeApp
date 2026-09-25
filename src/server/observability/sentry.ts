import 'server-only';
import { serverEnv } from '@/server/env';
import { publicEnv } from '@/lib/env.public';
import { scrubPii } from './scrubber';

export interface CaptureErrorResult {
  handled: boolean;
  sanitizedMessage: string;
  dispatched: boolean;
  eventId?: string;
}

/**
 * Captura excepciones en el servidor y las reporta a Sentry o al servicio de observabilidad configurado,
 * asegurando mediante `scrubPii` que ningún dato sensible o PII (direcciones, teléfonos, destinatarios, DNI)
 * llegue a los servidores de observabilidad.
 */
export async function captureError(
  error: unknown,
  context?: Record<string, unknown>
): Promise<CaptureErrorResult> {
  try {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const sanitizedError = scrubPii(error instanceof Error ? error : new Error(rawMessage));
    const sanitizedContext = context ? scrubPii(context) : undefined;
    const sanitizedMessage = sanitizedError.message;

    let dsn: string | undefined;
    let nodeEnv = 'development';

    try {
      dsn = publicEnv.NEXT_PUBLIC_SENTRY_DSN || undefined;
    } catch {
      dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;
    }

    try {
      nodeEnv = serverEnv.NODE_ENV || 'development';
    } catch {
      nodeEnv = process.env.NODE_ENV || 'development';
    }

    let dispatched = false;
    let eventId: string | undefined;

    if (dsn && dsn.startsWith('http')) {
      try {
        // Enviar evento estructurado a Sentry Store API / Ingest
        const payload = {
          message: sanitizedMessage,
          level: 'error',
          platform: 'node',
          environment: nodeEnv,
          extra: sanitizedContext,
          timestamp: new Date().toISOString(),
        };

        const res = await fetch(dsn, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          dispatched = true;
          const data = (await res.json().catch(() => ({}))) as { id?: string };
          eventId = data.id ?? 'sent';
        }
      } catch {
        // Si la red falla hacia Sentry, la observabilidad no debe tumbar la aplicación
        dispatched = false;
      }
    } else {
      // Sin DSN configurado, el error sanitizado queda registrado de forma segura
      if (nodeEnv !== 'test') {
        console.error('[OBSERVABILITY-LOCAL]', sanitizedMessage, sanitizedContext);
      }
      dispatched = true;
    }

    return {
      handled: true,
      sanitizedMessage,
      dispatched,
      eventId,
    };
  } catch {
    // Garantía absoluta de fail-safe
    return {
      handled: true,
      sanitizedMessage: '[ERROR_CAPTURING_FAILED]',
      dispatched: false,
    };
  }
}
