import 'server-only';
import { sendCriticalAlert } from './alerts';

export interface HealthCheckResult {
  healthy: boolean;
  status: number;
  latencyMs: number;
  error?: string;
}

/**
 * Chequea la disponibilidad del endpoint de uptime `/api/health`.
 * Si el endpoint responde no-200 o sufre timeout, despacha una alerta crítica.
 */
export async function checkUptimeHealth(
  baseUrl: string,
  timeoutMs: number = 5000
): Promise<HealthCheckResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/health`;
  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Timeout superado (${timeoutMs}ms)`));
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;
    const isOk = res.ok && res.status === 200;

    if (!isOk) {
      await sendCriticalAlert({
        type: 'uptime_unhealthy',
        severity: 'critical',
        message: `Endpoint de disponibilidad /api/health reportó error HTTP ${res.status}`,
        details: { url, status: res.status, latencyMs },
      });

      return {
        healthy: false,
        status: res.status,
        latencyMs,
        error: `HTTP ${res.status}`,
      };
    }

    return {
      healthy: true,
      status: 200,
      latencyMs,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const isTimeout =
      controller.signal.aborted ||
      (err instanceof Error &&
        (err.name === 'TimeoutError' ||
          err.name === 'AbortError' ||
          err.message.toLowerCase().includes('timeout') ||
          err.message.toLowerCase().includes('aborted')));
    const errorMsg = isTimeout
      ? `Timeout superado (${timeoutMs}ms)`
      : err instanceof Error
        ? err.message
        : String(err);

    await sendCriticalAlert({
      type: 'uptime_unhealthy',
      severity: 'critical',
      message: `Fallo de conexión al verificar uptime /api/health: ${errorMsg}`,
      details: { url, latencyMs, error: errorMsg, timeoutMs },
    });

    return {
      healthy: false,
      status: 0,
      latencyMs,
      error: errorMsg,
    };
  }
}
