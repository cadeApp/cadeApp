import 'server-only';
import { createRequire } from 'node:module';
import { z } from 'zod';
import { createAdminClient } from '@/server/supabase/admin';
import { serverEnv } from '@/server/env';
import { publicEnv } from '@/lib/env.public';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload?: string | Buffer | null,
    options?: { TTL?: number }
  ) => Promise<{ statusCode: number }>;
};


export type PushEvent =
  | { event: 'request_published'; requestId: string }
  | { event: 'offer_submitted'; requestId: string; offerId: string }
  | { event: 'offer_accepted'; requestId: string; offerId: string }
  | { event: 'request_cancelled'; requestId: string }
  | { event: 'request_expired'; requestId: string };

export const pushPayloadSchema = z.discriminatedUnion('event', [
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

export function buildPushPayload(event: PushEvent): PushPayload {
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

export async function sendPushNotification(
  userIds: string[],
  event: PushEvent,
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

  for (const sub of subscriptions) {
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
