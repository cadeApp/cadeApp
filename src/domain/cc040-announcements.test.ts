import { describe, expect, it } from 'vitest';
import { ALL_RPC_NAMES, RPC_CONTRACTS, isAnnouncementCtaAllowed } from './rpc-contracts';
import { createFakeRpcClient, type FakePlatformSettings } from './testing/rpc-fake';

// CC-040 (T-414): novedades del admin. Los casos siguen al pgTAP `supabase/tests/cc040_announcements.sql`.

const ADMIN = '00000000-0000-4000-8000-000000400001';
const MERCHANT_A = '00000000-0000-4000-8000-000000400002';
const MERCHANT_B = '00000000-0000-4000-8000-000000400003';
const COURIER_A = '00000000-0000-4000-8000-000000400005';
const COURIER_B = '00000000-0000-4000-8000-000000400006';
const COURIER_PENDING = '00000000-0000-4000-8000-000000400007';
const UNKNOWN = '00000000-0000-4000-8000-0000004099ff';

const SETTINGS: FakePlatformSettings = {
  minOfferArs: 1000,
  maxOffersPerMin: 100,
  maxRequestPublicationsPerMin: 100,
  maxIncidentsPerMin: 5,
  requestTtlMinutes: 30,
  pilotActive: false,
  pilotTermsVersion: 'v1.0',
  subscriptionGraceDays: 3,
  maxDropsPerRequest: 5,
};

const ADMIN_ERRORS = ['UNAUTHENTICATED', 'UNAUTHORIZED_ACTOR', 'AAL2_REQUIRED', 'VALIDATION_ERROR'];

describe('CC-040: contratos', () => {
  it('las siete RPC están registradas con sus errores', () => {
    for (const name of [
      'admin_count_announcement_audience',
      'admin_create_announcement',
      'admin_record_announcement_push',
      'admin_list_announcements',
      'get_my_announcement',
      'dismiss_announcement',
      'set_promotions_opt_in',
    ] as const) {
      expect(ALL_RPC_NAMES).toContain(name);
    }
    expect(RPC_CONTRACTS.admin_count_announcement_audience.errorCodes).toEqual(ADMIN_ERRORS);
    expect(RPC_CONTRACTS.admin_create_announcement.errorCodes).toEqual([...ADMIN_ERRORS, 'RATE_LIMITED']);
    expect(RPC_CONTRACTS.admin_record_announcement_push.errorCodes).toEqual([
      ...ADMIN_ERRORS,
      'NOT_FOUND',
      'INVALID_STATE_TRANSITION',
    ]);
    expect(RPC_CONTRACTS.admin_list_announcements.errorCodes).toEqual(ADMIN_ERRORS);
    expect(RPC_CONTRACTS.get_my_announcement.errorCodes).toEqual(['UNAUTHENTICATED', 'UNAUTHORIZED_ACTOR']);
    expect(RPC_CONTRACTS.dismiss_announcement.errorCodes).toEqual([
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'VALIDATION_ERROR',
      'NOT_FOUND',
    ]);
    expect(RPC_CONTRACTS.set_promotions_opt_in.errorCodes).toEqual([
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'VALIDATION_ERROR',
    ]);
  });

  it('la acción tiene que existir para todo el público', () => {
    expect(isAnnouncementCtaAllowed('merchants', 'merchant_plan')).toBe(true);
    expect(isAnnouncementCtaAllowed('merchants', 'courier_feed')).toBe(false);
    expect(isAnnouncementCtaAllowed('couriers', 'courier_feed')).toBe(true);
    expect(isAnnouncementCtaAllowed('couriers', 'merchant_new_request')).toBe(false);
    expect(isAnnouncementCtaAllowed('all', 'none')).toBe(true);
    expect(isAnnouncementCtaAllowed('all', 'merchant_plan')).toBe(false);
  });

  it('el alta valida longitudes, acción por público y días', () => {
    const schema = RPC_CONTRACTS.admin_create_announcement.inputSchema;
    const base = { audience: 'merchants', title: 'Promo', body: 'Texto', cta: 'merchant_plan', visibleDays: 7 };
    expect(schema.safeParse(base).success).toBe(true);
    expect(schema.safeParse({ ...base, title: '   ' }).success).toBe(false);
    expect(schema.safeParse({ ...base, title: 'x'.repeat(61) }).success).toBe(false);
    expect(schema.safeParse({ ...base, body: 'y'.repeat(141) }).success).toBe(false);
    expect(schema.safeParse({ ...base, cta: 'courier_feed' }).success).toBe(false);
    expect(schema.safeParse({ ...base, visibleDays: 0 }).success).toBe(false);
    expect(schema.safeParse({ ...base, visibleDays: 31 }).success).toBe(false);
    expect(schema.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });

  it('el registro del push no admite más enviados y fallidos que destinatarios', () => {
    const schema = RPC_CONTRACTS.admin_record_announcement_push.inputSchema;
    const base = { announcementId: UNKNOWN, targets: 3, sent: 2, failed: 1 };
    expect(schema.safeParse(base).success).toBe(true);
    expect(schema.safeParse({ ...base, sent: 3 }).success).toBe(false);
    expect(schema.safeParse({ ...base, failed: -1 }).success).toBe(false);
  });

  it('el banner expone solo id, title, body y cta', () => {
    const schema = RPC_CONTRACTS.get_my_announcement.outputSchema;
    const announcement = { id: UNKNOWN, title: 'T', body: 'B', cta: 'none' };
    expect(schema.safeParse({ announcement }).success).toBe(true);
    expect(schema.safeParse({ announcement: null }).success).toBe(true);
    expect(schema.safeParse({ announcement: { ...announcement, audience: 'all' } }).success).toBe(false);
  });
});

describe('CC-040: el fake se comporta como la base', () => {
  let clock = Date.parse('2026-10-22T12:00:00.000Z');

  function setup() {
    clock = Date.parse('2026-10-22T12:00:00.000Z');
    const fake = createFakeRpcClient({
      settings: SETTINGS,
      now: () => new Date(clock),
      initialActor: { userId: ADMIN, role: 'admin', aal: 'aal2', consentStatus: 'active' },
      initialMerchants: [
        { merchantId: MERCHANT_A, subscriptionStatus: 'active' },
        { merchantId: MERCHANT_B, subscriptionStatus: 'active' },
      ],
      initialCouriers: [
        { courierId: COURIER_A, status: 'approved', available: true },
        { courierId: COURIER_B, status: 'approved', available: true },
        { courierId: COURIER_PENDING, status: 'pending', available: false },
      ],
    });
    const as = (userId: string, role: 'admin' | 'merchant' | 'courier', aal: 'aal1' | 'aal2' = 'aal1') =>
      fake.setActor({ userId, role, aal, consentStatus: 'active' });
    async function create(
      audience: 'merchants' | 'couriers' | 'all',
      title: string,
      cta: 'none' | 'merchant_plan' | 'merchant_new_request' | 'courier_feed' = 'none'
    ) {
      as(ADMIN, 'admin', 'aal2');
      const result = await fake.admin_create_announcement({ audience, title, body: `Texto ${title}`, cta, visibleDays: 7 });
      if (!result.ok) throw new Error(result.code);
      clock += 60_000;
      return result.data.announcementId;
    }
    return { fake, as, create };
  }

  it('autorización: el admin con aal2 administra; comercio y repartidor leen su banner', async () => {
    const t = setup();
    t.as(MERCHANT_A, 'merchant');
    expect(await t.fake.admin_count_announcement_audience({ audience: 'merchants' })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
    t.as(ADMIN, 'admin', 'aal1');
    expect(await t.fake.admin_list_announcements({})).toEqual({ ok: false, code: 'AAL2_REQUIRED' });
    expect(await t.fake.get_my_announcement({})).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    t.fake.setActor({ userId: MERCHANT_A, role: 'merchant', aal: 'aal1', consentStatus: 'pending' });
    expect(await t.fake.get_my_announcement({})).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    expect(await t.fake.set_promotions_opt_in({ enabled: false })).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
  });

  it('público estimado: comercios activos y repartidores aprobados; push solo con aceptación y suscripción', async () => {
    const t = setup();
    t.as(MERCHANT_A, 'merchant');
    await t.fake.set_promotions_opt_in({ enabled: true });
    const subscription = await t.fake.register_push_subscription({
      endpoint: 'https://push.example.test/cc040-a',
      p256dh: 'BCC040p256dhKeyForAnnouncementsTest0000000000000000000000000000000000000000000000000000',
      auth: 'cc040authKey00000000',
    });
    expect(subscription.ok).toBe(true);
    t.as(COURIER_A, 'courier');
    await t.fake.set_promotions_opt_in({ enabled: false });
    t.as(COURIER_B, 'courier');
    await t.fake.set_promotions_opt_in({ enabled: true });

    t.as(ADMIN, 'admin', 'aal2');
    expect(await t.fake.admin_count_announcement_audience({ audience: 'merchants' })).toEqual({
      ok: true,
      data: { recipients: 2, pushRecipients: 1 },
    });
    expect(await t.fake.admin_count_announcement_audience({ audience: 'couriers' })).toEqual({
      ok: true,
      data: { recipients: 1, pushRecipients: 0 },
    });
    expect(await t.fake.admin_count_announcement_audience({ audience: 'all' })).toEqual({
      ok: true,
      data: { recipients: 3, pushRecipients: 1 },
    });
  });

  it('tope de 5 en 24 h y el registro único del push', async () => {
    const t = setup();
    const ids = [];
    for (let n = 1; n <= 5; n += 1) ids.push(await t.create('merchants', `A${n}`));
    t.as(ADMIN, 'admin', 'aal2');
    expect(
      await t.fake.admin_create_announcement({ audience: 'all', title: 'A6', body: 'B', cta: 'none', visibleDays: 1 })
    ).toEqual({ ok: false, code: 'RATE_LIMITED' });
    clock += 24 * 60 * 60 * 1000;
    expect(
      (await t.fake.admin_create_announcement({ audience: 'all', title: 'A6', body: 'B', cta: 'none', visibleDays: 1 }))
        .ok
    ).toBe(true);

    const first = ids[0] ?? UNKNOWN;
    expect(
      await t.fake.admin_record_announcement_push({ announcementId: first, targets: 3, sent: 2, failed: 1 })
    ).toEqual({ ok: true, data: { announcementId: first } });
    expect(
      await t.fake.admin_record_announcement_push({ announcementId: first, targets: 3, sent: 2, failed: 1 })
    ).toEqual({ ok: false, code: 'INVALID_STATE_TRANSITION' });
    expect(
      await t.fake.admin_record_announcement_push({ announcementId: UNKNOWN, targets: 0, sent: 0, failed: 0 })
    ).toEqual({ ok: false, code: 'NOT_FOUND' });
  });

  it('banner: la vigente más reciente del público, cierre por cuenta, baja y vencimiento', async () => {
    const t = setup();
    const a1 = await t.create('merchants', 'A1', 'merchant_plan');
    const a2 = await t.create('couriers', 'A2', 'courier_feed');
    const a3 = await t.create('all', 'A3');

    t.as(MERCHANT_A, 'merchant');
    expect(await t.fake.get_my_announcement({})).toEqual({
      ok: true,
      data: { announcement: { id: a3, title: 'A3', body: 'Texto A3', cta: 'none' } },
    });
    expect(await t.fake.dismiss_announcement({ announcementId: a3 })).toEqual({ ok: true, data: { dismissed: true } });
    expect(await t.fake.dismiss_announcement({ announcementId: a3 })).toEqual({ ok: true, data: { dismissed: true } });
    const afterDismiss = await t.fake.get_my_announcement({});
    expect(afterDismiss.ok && afterDismiss.data.announcement?.id).toBe(a1);
    expect(await t.fake.dismiss_announcement({ announcementId: a2 })).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(await t.fake.dismiss_announcement({ announcementId: UNKNOWN })).toEqual({ ok: false, code: 'NOT_FOUND' });

    t.as(MERCHANT_B, 'merchant');
    const other = await t.fake.get_my_announcement({});
    expect(other.ok && other.data.announcement?.id).toBe(a3);
    expect(await t.fake.set_promotions_opt_in({ enabled: false })).toEqual({ ok: true, data: { enabled: false } });
    expect(await t.fake.get_my_announcement({})).toEqual({ ok: true, data: { announcement: null } });

    t.as(COURIER_B, 'courier');
    const courier = await t.fake.get_my_announcement({});
    expect(courier.ok && courier.data.announcement?.id).toBe(a3);
    t.fake.setActor({ userId: COURIER_PENDING, role: 'courier', aal: 'aal1', consentStatus: 'active', courierStatus: 'pending' });
    expect(await t.fake.get_my_announcement({})).toEqual({ ok: true, data: { announcement: null } });

    clock += 8 * 24 * 60 * 60 * 1000;
    t.as(MERCHANT_A, 'merchant');
    expect(await t.fake.get_my_announcement({})).toEqual({ ok: true, data: { announcement: null } });
  });

  it('historial por keyset, de la más reciente a la más vieja', async () => {
    const t = setup();
    const ids = [];
    for (let n = 1; n <= 3; n += 1) ids.push(await t.create('merchants', `A${n}`));
    t.as(ADMIN, 'admin', 'aal2');
    const page1 = await t.fake.admin_list_announcements({ limit: 2 });
    if (!page1.ok) throw new Error(page1.code);
    expect(page1.data.items.map((item) => item.id)).toEqual([ids[2], ids[1]]);
    expect(page1.data.items[0]).toMatchObject({ audience: 'merchants', title: 'A3', pushSent: null });
    const cursor = page1.data.nextCursor;
    if (!cursor) throw new Error('falta cursor');
    const page2 = await t.fake.admin_list_announcements({ cursor, limit: 2 });
    expect(page2.ok && page2.data).toEqual({
      items: [expect.objectContaining({ id: ids[0] })],
      nextCursor: null,
    });
  });
});
