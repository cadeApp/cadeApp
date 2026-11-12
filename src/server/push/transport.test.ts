import { createECDH, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PUSH_TIMEOUT_MS,
  sendPushNotification,
  WebPushTransport,
  type PushDatabaseClient,
  type PushHttpRequest,
  type PushSubscriptionRecord,
  type WebPushClient,
} from './sender';

vi.mock('@/server/env', () => ({
  serverEnv: { VAPID_PRIVATE_KEY: 'test-private-key', VAPID_SUBJECT: 'mailto:test@cadeapp.com' },
}));
vi.mock('@/lib/env.public', () => ({ publicEnv: { NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'test-public-key' } }));

const require = createRequire(import.meta.url);
const webpush = require('web-push') as WebPushClient & {
  generateVAPIDKeys: () => { publicKey: string; privateKey: string };
};
const VAPID = { subject: 'mailto:test@cadeapp.com', ...webpush.generateVAPIDKeys() };

function subscription(endpoint: string): PushSubscriptionRecord {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    id: 'sub-1',
    userId: '00000000-0000-4000-8000-000000000001',
    endpoint,
    p256dh: ecdh.getPublicKey().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  };
}

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void;
const servers: http.Server[] = [];

async function startServer(handler: Handler): Promise<{ url: string; port: number; closed: () => number }> {
  let closedSockets = 0;
  const server = http.createServer(handler);
  server.on('connection', (socket) => socket.on('close', () => (closedSockets += 1)));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/push/abc`, port, closed: () => closedSockets };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((resolve) => {
          s.closeAllConnections();
          s.close(() => resolve());
        })
    )
  );
});

function transport(timeoutMs = 150, request: PushHttpRequest = http.request) {
  return new WebPushTransport(webpush, { vapid: VAPID, request, timeoutMs });
}

describe('CC-049 (D4-B) — WebPushTransport contra un servidor local', () => {
  it('el plazo de producción es 5000 ms', () => {
    expect(PUSH_TIMEOUT_MS).toBe(5000);
  });

  it.each([201, 404, 410, 429, 500])('devuelve el status HTTP %i', async (status) => {
    const server = await startServer((_req, res) => {
      res.writeHead(status);
      res.end();
    });
    await expect(transport().send(subscription(server.url), '{"t":1}')).resolves.toEqual({ status });
  });

  it('envía POST con el cuerpo cifrado y los headers de VAPID', async () => {
    let seen: { method?: string; auth?: string; encoding?: string; bytes: number } = { bytes: 0 };
    const server = await startServer((req, res) => {
      let bytes = 0;
      req.on('data', (chunk: Buffer) => (bytes += chunk.length));
      req.on('end', () => {
        seen = {
          method: req.method,
          auth: req.headers.authorization,
          encoding: req.headers['content-encoding'] as string | undefined,
          bytes,
        };
        res.writeHead(201);
        res.end();
      });
    });
    await transport().send(subscription(server.url), '{"t":1}');
    expect(seen.method).toBe('POST');
    expect(seen.auth).toMatch(/^vapid t=/);
    expect(seen.encoding).toBe('aes128gcm');
    expect(seen.bytes).toBeGreaterThan(0);
  });

  it('un 3xx es un fallo con su código y no se pide la URL de Location', async () => {
    let redirectedHits = 0;
    const server = await startServer((req, res) => {
      if (req.url === '/redirected') {
        redirectedHits += 1;
        res.writeHead(201);
        res.end();
        return;
      }
      res.writeHead(302, { Location: '/redirected' });
      res.end();
    });
    await expect(transport().send(subscription(server.url), '{"t":1}')).resolves.toEqual({ status: 302 });
    expect(redirectedHits).toBe(0);
  });

  it('aborta al vencer el plazo una respuesta que gotea aunque el socket nunca quede inactivo', async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(201);
      const drip = setInterval(() => res.write('x'), 10);
      res.on('close', () => clearInterval(drip));
    });
    const started = Date.now();
    const result = await transport(150).send(subscription(server.url), '{"t":1}');
    expect(result).toEqual({ status: 0, error: 'PUSH_TIMEOUT' });
    expect(Date.now() - started).toBeLessThan(1000);
    await vi.waitFor(() => expect(server.closed()).toBeGreaterThan(0));
  });

  it('aborta al vencer el plazo una conexión que nunca responde', async () => {
    const server = await startServer(() => {
      // nunca responde
    });
    const started = Date.now();
    const result = await transport(150).send(subscription(server.url), '{"t":1}');
    expect(result).toEqual({ status: 0, error: 'PUSH_TIMEOUT' });
    expect(Date.now() - started).toBeLessThan(1000);
    await vi.waitFor(() => expect(server.closed()).toBeGreaterThan(0));
  });

  it('limpia el temporizador al resolver y al fallar por error de red', async () => {
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    const server = await startServer((_req, res) => {
      res.writeHead(201);
      res.end();
    });
    await transport(5000).send(subscription(server.url), '{"t":1}');
    expect(clear).toHaveBeenCalledTimes(1);

    const { port } = server;
    await new Promise<void>((resolve) => {
      servers.splice(servers.length - 1)[0]?.close(() => resolve());
    });
    const failed = await transport(5000).send(subscription(`http://127.0.0.1:${port}/push/abc`), '{"t":1}');
    expect(failed.status).toBe(500);
    expect(failed.error).toBeTruthy();
    expect(clear).toHaveBeenCalledTimes(2);
  });
});

describe('CC-049 — sendPushNotification con el transporte real', () => {
  const USER = '00000000-0000-4000-8000-000000000001';
  const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/cc049';

  function db(sub: PushSubscriptionRecord): PushDatabaseClient {
    return {
      getSubscriptionsForUsers: vi.fn().mockResolvedValue([sub]),
      deleteSubscriptionByEndpoint: vi.fn().mockResolvedValue(undefined),
    };
  }

  // El endpoint permitido se redirige al servidor local: la request llega con la URL que arma web-push.
  function routedTo(port: number, seenUrls: string[]): PushHttpRequest {
    return (url, options, callback) => {
      seenUrls.push(url);
      return http.request(`http://127.0.0.1:${port}/push/abc`, options, callback);
    };
  }

  it('borra la suscripción ante un 410 del servicio', async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(410);
      res.end();
    });
    const seen: string[] = [];
    const database = db(subscription(ENDPOINT));
    const result = await sendPushNotification([USER], { event: 'request_published', requestId: USER }, {
      db: database,
      transport: transport(150, routedTo(server.port, seen)),
    });
    expect(seen).toEqual([ENDPOINT]);
    expect(result.failedCount).toBe(1);
    expect(database.deleteSubscriptionByEndpoint).toHaveBeenCalledWith(ENDPOINT);
  });

  it('un abort por plazo es un fallo que no borra la suscripción', async () => {
    const server = await startServer(() => {
      // nunca responde
    });
    const database = db(subscription(ENDPOINT));
    const result = await sendPushNotification([USER], { event: 'request_published', requestId: USER }, {
      db: database,
      transport: transport(150, routedTo(server.port, [])),
    });
    expect(result.failedCount).toBe(1);
    expect(result.attempts).toEqual([{ outcome: 'sent', endpoint: ENDPOINT, status: 0, error: 'PUSH_TIMEOUT' }]);
    expect(database.deleteSubscriptionByEndpoint).not.toHaveBeenCalled();
  });
});

describe('PR91-H08: configuración VAPID de WebPushTransport', () => {
  function client(): WebPushClient {
    return {
      setVapidDetails: vi.fn(),
      generateRequestDetails: vi.fn(() => {
        throw new Error('stop');
      }),
    };
  }

  it('configura VAPID con subject y claves del entorno una sola vez', async () => {
    const mock = client();
    const t = new WebPushTransport(mock);
    await t.send(subscription(ENDPOINT_PLACEHOLDER), '{}');
    await t.send(subscription(ENDPOINT_PLACEHOLDER), '{}');
    expect(mock.setVapidDetails).toHaveBeenCalledTimes(1);
    expect(mock.setVapidDetails).toHaveBeenCalledWith('mailto:test@cadeapp.com', 'test-public-key', 'test-private-key');
    expect(mock.generateRequestDetails).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['la clave pública', { publicKey: '', privateKey: 'test-private-key' }, /NEXT_PUBLIC_VAPID_PUBLIC_KEY/],
    ['la clave privada', { publicKey: 'test-public-key', privateKey: '' }, /VAPID_PRIVATE_KEY/],
    ['ambas claves', { publicKey: '', privateKey: '' }, /VAPID credentials missing/],
  ])('si falta %s devuelve 500 y no arma la request', async (_name, vapid, message) => {
    const mock = client();
    const res = await new WebPushTransport(mock, { vapid }).send(subscription(ENDPOINT_PLACEHOLDER), '{}');
    expect(res.status).toBe(500);
    expect(res.error).toMatch(message);
    expect(mock.setVapidDetails).not.toHaveBeenCalled();
    expect(mock.generateRequestDetails).not.toHaveBeenCalled();
  });
});

const ENDPOINT_PLACEHOLDER = 'https://fcm.googleapis.com/fcm/send/vapid';
