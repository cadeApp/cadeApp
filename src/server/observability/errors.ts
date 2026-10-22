import 'server-only';
import { scrubPii } from './scrubber';
import { sendCriticalAlert } from './alerts';

export interface CaptureErrorResult {
  handled: boolean;
  sanitizedMessage: string;
  dispatched: boolean;
  eventId?: string;
}

/**
 * Captura excepciones en el servidor y las despacha a Discord con PII sanitizada.
 * Discord es el destino operativo oficial de errores para T-310 (reemplaza a Sentry en runtime).
 * Las variables de Sentry/DSN quedan reservadas para integraciones futuras y no se consumen aquí.
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

    const alertResult = await sendCriticalAlert({
      type: 'application_error',
      severity: 'error',
      message: sanitizedMessage,
      details: {
        ...(sanitizedContext ?? {}),
        errorName: error instanceof Error ? error.name : 'UnknownError',
        stack: error instanceof Error && error.stack ? scrubPii(error.stack) : undefined,
      },
    });

    return {
      handled: true,
      sanitizedMessage,
      dispatched: alertResult.ok,
    };
  } catch {
    return {
      handled: true,
      sanitizedMessage: '[ERROR_CAPTURING_FAILED]',
      dispatched: false,
    };
  }
}
