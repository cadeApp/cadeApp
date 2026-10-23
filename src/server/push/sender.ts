import 'server-only';
import { createRequire } from 'node:module';
import { z } from 'zod';
import { createAdminClient } from '@/server/supabase/admin';
import { serverEnv } from '@/server/env';
import { publicEnv } from '@/lib/env.public';
import type { AnnouncementAudience, AnnouncementCta } from '@/domain';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload?: string | Buffer | null,
    options?: { TTL?: number }
  ) => Promise<{ statusCode: number }>;
};


// CC-040: destinos posibles de una novedad. El service worker (public/sw.js) acepta solo esta lista.
export const ANNOUNCEMENT_PUSH_URLS = [
  '/merchant/plan',
  '/merchant/requests/new',
  '/merchant/dashboard',
  '/courier/feed',
  '/login',
] as const;
export type AnnouncementPushUrl = (typeof ANNOUNCEMENT_PUSH_URLS)[number];

/** CC-040: la acción lleva a su pantalla; sin acción, a la home del público (`/login` redirige a la de cada rol). */
export function announcementPushUrl(audience: AnnouncementAudience, cta: AnnouncementCta): AnnouncementPushUrl {
  switch (cta) {
    case 'merchant_plan':
      return '/merchant/plan';
    case 'merchant_new_request':
      return '/merchant/requests/new';
    case 'courier_feed':
      return '/courier/feed';
    case 'none':
      if (audience === 'merchants') return '/merchant/dashboard';
      return audience === 'couriers' ? '/courier/feed' : '/login';
  }
}

/** CC-040: novedad del admin. Va aparte de `PushEvent` (eventos de solicitudes, que siempre llevan `requestId`). */
export interface AnnouncementPushEvent {
  event: 'announcement';
  announcementId: string;
  title: string;
  body: string;
  url: AnnouncementPushUrl;
}

export type PushEvent =
  | { event: 'request_published'; requestId: string }
  | { event: 'offer_submitted'; requestId: string; offerId: string }
  | { event: 'offer_accepted'; requestId: string; offerId: string }
  | { event: 'request_cancelled'; requestId: string }
  | { event: 'request_expired'; requestId: string };

export const pushPayloadSchema = z.discriminatedUnion('event', [
  // CC-040: el texto lo escribe el admin y es público; no lleva datos personales.
  z
    .object({
      event: z.literal('announcement'),
      announcementId: z.string().uuid(),
      title: z.string().min(1).max(60),
      body: z.string().min(1).max(140),
      url: z.enum(ANNOUNCEMENT_PUSH_URLS),
    })
    .strict(),
  z
    .object({
      event: z.literal('request_published'),
      requestId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      event: z.literal('offer_submitted'),
      requestId: z.string().uuid(),
      offerId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      event: z.literal('offer_accepted'),
      requestId: z.string().uuid(),
      offerId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      event: z.literal('request_cancelled'),
      requestId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      event: z.literal('request_expired'),
      requestId: z.string().uuid(),
    })
    .strict(),
]);

export type PushPayload = z.infer<typeof pushPayloadSchema>;

export function buildPushPayload(event: PushEvent | AnnouncementPushEvent): PushPayload {
  return pushPayloadSchema.parse(event);
}

export function validatePushPayload(data: unknown): PushPayload {
  return pushPayloadSchema.parse(data);
}

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform?: string | null;
}

export interface PushDatabaseClient {
  getSubscriptionsForUsers(userIds: string[]): Promise<PushSubscriptionRecord[]>;
  deleteSubscriptionByEndpoint(endpoint: string): Promise<void>;
}

export interface PushAttemptRecord {
  endpoint: string;
  status: number;
  error?: string;
}

export interface PushTransport {
  send(subscription: PushSubscriptionRecord, payload: string): Promise<{ status: number; error?: string }>;
}

export interface SendPushResult {
  totalSubscriptions: number;
  sentCount: number;
  failedCount: number;
  deletedSubscriptions: string[];
  attempts: PushAttemptRecord[];
  errors: Error[];
}

export class DefaultPushDatabaseClient implements PushDatabaseClient {
  async getSubscriptionsForUsers(userIds: string[]): Promise<PushSubscriptionRecord[]> {
    if (userIds.length === 0) return [];
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, platform')
      .in('user_id', userIds);

    if (error || !data) {
      throw new Error(`Failed to query push_subscriptions: ${error?.message ?? 'No data'}`);
    }

    return data.map((row) => ({
      id: row.id,
      userId: row.user_id,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
      platform: row.platform ?? null,
    }));
  }

  async deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    if (error) {
      throw new Error(`Failed to delete expired push subscription: ${error.message}`);
    }
  }
}

export interface WebPushClient {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload?: string | Buffer | null,
    options?: { TTL?: number }
  ) => Promise<{ statusCode: number }>;
}

export interface WebPushOptions {
  vapid?: {
    subject?: string;
    publicKey?: string;
    privateKey?: string;
  };
}

export class WebPushTransport implements PushTransport {
  private vapidConfigured = false;
  private client: WebPushClient;
  private vapidOptions?: WebPushOptions['vapid'];

  constructor(client: WebPushClient = webpush, options?: WebPushOptions) {
    this.client = client;
    this.vapidOptions = options?.vapid;
  }

  private configureVapid(): void {
    if (this.vapidConfigured) return;
    const publicKey = this.vapidOptions?.publicKey !== undefined ? this.vapidOptions.publicKey : publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = this.vapidOptions?.privateKey !== undefined ? this.vapidOptions.privateKey : serverEnv.VAPID_PRIVATE_KEY;
    const subject = this.vapidOptions?.subject !== undefined ? this.vapidOptions.subject : (serverEnv.VAPID_SUBJECT || 'mailto:admin@cadeapp.com');

    const cleanPublic = publicKey?.trim();
    const cleanPrivate = privateKey?.trim();

    if (!cleanPublic || !cleanPrivate) {
      throw new Error('VAPID credentials missing: NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required');
    }

    this.client.setVapidDetails(subject, cleanPublic, cleanPrivate);
    this.vapidConfigured = true;
  }

  async send(subscription: PushSubscriptionRecord, payload: string): Promise<{ status: number; error?: string }> {
    try {
      this.configureVapid();
      const res = await this.client.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload,
        {
          TTL: 300,
        }
      );
      return { status: res.statusCode };
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'statusCode' in err && typeof err.statusCode === 'number') {
        return { status: err.statusCode };
      }
      return { status: 500, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

const PUSH_BATCH_SIZE = 10;

export async function sendPushNotification(
  userIds: string[],
  event: PushEvent | AnnouncementPushEvent,
  options?: {
    db?: PushDatabaseClient;
    transport?: PushTransport;
  }
): Promise<SendPushResult> {
  const db = options?.db ?? new DefaultPushDatabaseClient();
  const transport = options?.transport ?? new WebPushTransport();

  const result: SendPushResult = {
    totalSubscriptions: 0,
    sentCount: 0,
    failedCount: 0,
    deletedSubscriptions: [],
    attempts: [],
    errors: [],
  };

  if (userIds.length === 0) {
    return result;
  }

  let payloadStr: string;
  try {
    const payload = buildPushPayload(event);
    payloadStr = JSON.stringify(payload);
  } catch (err) {
    result.errors.push(err instanceof Error ? err : new Error(String(err)));
    return result;
  }

  let subscriptions: PushSubscriptionRecord[] = [];
  try {
    subscriptions = await db.getSubscriptionsForUsers(userIds);
  } catch (err) {
    result.errors.push(err instanceof Error ? err : new Error(String(err)));
    return result;
  }

  result.totalSubscriptions = subscriptions.length;

  // CC-040: tandas de PUSH_BATCH_SIZE envíos en paralelo, para no exceder el tiempo de la función con muchos
  // destinatarios.
  const deliver = async (sub: PushSubscriptionRecord): Promise<void> => {
    try {
      const { status, error } = await transport.send(sub, payloadStr);
      result.attempts.push({
        endpoint: sub.endpoint,
        status,
        ...(error ? { error } : {}),
      });

      if (status >= 200 && status < 300) {
        result.sentCount += 1;
      } else if (status === 410 || status === 404) {
        // Expired or unregistered subscription (410 Gone / 404 Not Found)
        result.failedCount += 1;
        try {
          await db.deleteSubscriptionByEndpoint(sub.endpoint);
          result.deletedSubscriptions.push(sub.endpoint);
        } catch (delErr) {
          result.errors.push(delErr instanceof Error ? delErr : new Error(String(delErr)));
        }
      } else {
        result.failedCount += 1;
      }
    } catch (err) {
      result.failedCount += 1;
      const errorMsg = err instanceof Error ? err.message : String(err);
      result.attempts.push({
        endpoint: sub.endpoint,
        status: 500,
        error: errorMsg,
      });
      result.errors.push(err instanceof Error ? err : new Error(errorMsg));
    }
  };

  for (let index = 0; index < subscriptions.length; index += PUSH_BATCH_SIZE) {
    await Promise.all(subscriptions.slice(index, index + PUSH_BATCH_SIZE).map(deliver));
  }

  return result;
}

export async function safeNotifyPostTransition(
  userIds: string[],
  event: PushEvent,
  options?: {
    db?: PushDatabaseClient;
    transport?: PushTransport;
  }
): Promise<SendPushResult> {
  try {
    return await sendPushNotification(userIds, event, options);
  } catch (err) {
    // Best effort invariant: pushing never fails or reverts the business transaction
    console.error('[Push] safeNotifyPostTransition encountered an unexpected error:', err);
    return {
      totalSubscriptions: 0,
      sentCount: 0,
      failedCount: 0,
      deletedSubscriptions: [],
      attempts: [],
      errors: [err instanceof Error ? err : new Error(String(err))],
    };
  }
}

/**
 * CC-040: destinatarios del push de una novedad (público con `push_promotions = true`). La RPC solo la ejecuta
 * `service_role`, por eso va con el cliente de servicio, igual que la lectura de `push_subscriptions`.
 */
export async function getAnnouncementPushRecipients(announcementId: string): Promise<string[]> {
  const { data, error } = await createAdminClient().rpc('announcement_push_recipients', {
    p_announcement_id: announcementId,
  });
  if (error) {
    throw new Error(`Failed to query announcement_push_recipients: ${error.message}`);
  }
  return z.array(z.string().uuid()).parse(data);
}
