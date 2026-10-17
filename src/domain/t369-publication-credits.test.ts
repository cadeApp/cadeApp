import { describe, expect, it } from 'vitest';
import { DOMAIN_ERROR_CODES } from './errors';
import { PLATFORM_SETTING_KEYS } from './schemas';
import {
  adminUpdateSettingInputSchema,
  adminUpsertPublicationPlanInputSchema,
  ALL_RPC_NAMES,
  publicationBalanceSchema,
  RPC_CONTRACTS,
  type RpcInput,
} from './rpc-contracts';
import { createFakeRpcClient, type FakePlatformSettings } from './testing/rpc-fake';

// T-369 / CC-029: contrato de créditos de publicación y réplica del fake de la máquina de estados SQL.

const MERCHANT = '20000000-0000-4000-8000-000000000369';
const COURIER = '10000000-0000-4000-8000-000000000369';
const ADMIN = '00000000-0000-4000-8000-000000000369';
const ZONE = '00000000-0000-4000-8000-0000000003a1';

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

const requestId = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const key = (n: number) => `60000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function payload(id: string, drops: number): RpcInput<'create_and_publish_multi_drop'> {
  return {
    requestId: id,
    pickupZoneId: ZONE,
    pickupAddress: 'Av Mitre 369',
    pickupLat: null,
    pickupLng: null,
    fixedPriceArs: null,
    autoAssign: false,
    drops: Array.from({ length: drops }, (_, index) => ({
      dropoffZoneId: ZONE,
      dropoffAddress: `Alberdi ${index + 1}`,
      dropoffLat: null,
      dropoffLng: null,
      recipientName: `Destinatario ${index + 1}`,
      recipientPhone: `3865369${String(index + 1).padStart(3, '0')}`,
      recipientConsentDeclared: true,
      packageType: 'chico' as const,
      recipientPaymentMethod: 'transfer' as const,
      needsChange: false,
      cashChangeAmount: null,
      notes: null,
    })) as RpcInput<'create_and_publish_multi_drop'>['drops'],
  };
}

function setup(options: { pilotActive?: boolean; settings?: Partial<FakePlatformSettings> } = {}) {
  let nowMs = Date.parse('2026-11-10T15:00:00.000Z');
  let merchantStatus: 'pilot' | 'active' | 'expired' | 'cancelled' = 'pilot';
  let merchantPaidUntil: string | null = null;
  const fake = createFakeRpcClient({
    settings: { ...SETTINGS, pilotActive: options.pilotActive ?? false, ...options.settings },
    now: () => new Date(nowMs),
    initialActor: { userId: MERCHANT, role: 'merchant', consentStatus: 'active', merchantSubscriptionStatus: merchantStatus },
    initialCouriers: [{ courierId: COURIER, status: 'approved', available: true }],
  });
  const asMerchant = () =>
    fake.setActor({
      userId: MERCHANT,
      role: 'merchant',
      aal: 'aal1',
      merchantSubscriptionStatus: merchantStatus,
      merchantPaidUntil,
    });
  const asCourier = () => fake.setActor({ userId: COURIER, role: 'courier', aal: 'aal1' });
  const asAdmin = (aal: 'aal1' | 'aal2' = 'aal2') => fake.setActor({ userId: ADMIN, role: 'admin', aal });
  return {
    fake,
    asMerchant,
    asCourier,
    asAdmin,
    advance: (ms: number) => {
      nowMs += ms;
    },
    setMerchant: (status: typeof merchantStatus, paidUntil: string | null = null) => {
      merchantStatus = status;
      merchantPaidUntil = paidUntil;
    },
    async grant(credits: number, n: number, source: 'purchase' | 'adjustment' = 'adjustment') {
      asAdmin();
      const result = await fake.admin_grant_publication_credits({ merchantId: MERCHANT, credits, source, operationKey: key(n) });
      asMerchant();
      return result;
    },
    async balance() {
      asMerchant();
      const result = await fake.get_my_publication_balance({});
      if (!result.ok) throw new Error(result.code);
      return result.data;
    },
    async publish(id: string, drops = 1) {
      asMerchant();
      return fake.create_and_publish_multi_drop(payload(id, drops));
    },
    async match(id: string) {
      asCourier();
      const offer = await fake.submit_offer({ requestId: id, amountArs: 1500, etaMinutes: 15 });
      if (!offer.ok) throw new Error(offer.code);
      asMerchant();
      return fake.accept_offer({ offerId: offer.data.offerId });
    },
    current: (id: string) => fake.getPublicationCharges(id).find((charge) => charge.isCurrent),
  };
}

describe('T-369 / CC-029 — contratos', () => {
  it('registra las cinco RPC nuevas con sus códigos y los cuatro códigos de dominio', () => {
    for (const name of [
      'admin_upsert_publication_plan',
      'admin_grant_publication_credits',
      'admin_register_plan_period',
      'admin_get_merchant_publication_credits',
      'get_my_publication_balance',
    ] as const) {
      expect(ALL_RPC_NAMES).toContain(name);
    }
    expect(DOMAIN_ERROR_CODES).toEqual(
      expect.arrayContaining(['PUBLICATION_CREDITS_EXHAUSTED', 'PLAN_INACTIVE', 'PLAN_IN_USE', 'IDEMPOTENCY_CONFLICT'])
    );
    for (const name of ['publish_request', 'republish_request', 'create_and_publish_multi_drop'] as const) {
      expect(RPC_CONTRACTS[name].errorCodes).toContain('PUBLICATION_CREDITS_EXHAUSTED');
    }
    expect(RPC_CONTRACTS.admin_set_subscription.errorCodes).toContain('INVALID_STATE_TRANSITION');
    expect(RPC_CONTRACTS.admin_register_plan_period.errorCodes).toEqual(
      expect.arrayContaining(['AAL2_REQUIRED', 'PLAN_INACTIVE', 'IDEMPOTENCY_CONFLICT'])
    );
  });

  it('valida catálogo y parámetros nuevos', () => {
    const base = { planId: null, code: 'plan-40', name: 'Plan 40', kind: 'quota' as const, monthlyCredits: 40, referencePriceArs: 1000, active: true, sort: 1 };
    expect(adminUpsertPublicationPlanInputSchema.safeParse(base).success).toBe(true);
    expect(adminUpsertPublicationPlanInputSchema.safeParse({ ...base, kind: 'unlimited' }).success).toBe(false);
    expect(adminUpsertPublicationPlanInputSchema.safeParse({ ...base, monthlyCredits: null }).success).toBe(false);
    expect(adminUpsertPublicationPlanInputSchema.safeParse({ ...base, code: 'X' }).success).toBe(false);

    expect(PLATFORM_SETTING_KEYS).toEqual(
      expect.arrayContaining(['publication_drops_per_credit', 'carryover_base_pct', 'carryover_cap_pct', 'launch_discount_pct'])
    );
    expect(adminUpdateSettingInputSchema.safeParse({ key: 'publication_drops_per_credit', value: 0 }).success).toBe(false);
    expect(adminUpdateSettingInputSchema.safeParse({ key: 'launch_discount_pct', value: 101 }).success).toBe(false);
    expect(adminUpdateSettingInputSchema.safeParse({ key: 'carryover_step_pct', value: 5 }).success).toBe(true);
  });
});

describe('T-369 / CC-029 — fake de créditos', () => {
  it('con el piloto encendido no crea cargos ni pide créditos', async () => {
    const t = setup({ pilotActive: true });
    expect((await t.publish(requestId(1))).ok).toBe(true);
    expect(t.fake.getPublicationCharges(requestId(1))).toHaveLength(0);
  });

  it('sin créditos ni plan rechaza con PUBLICATION_CREDITS_EXHAUSTED y no crea la solicitud', async () => {
    const t = setup();
    expect(await t.publish(requestId(1))).toEqual({ ok: false, code: 'PUBLICATION_CREDITS_EXHAUSTED' });
    expect(t.fake.getRequest(requestId(1))).toBeUndefined();
    t.setMerchant('cancelled');
    await t.grant(5, 1);
    expect(await t.publish(requestId(2))).toEqual({ ok: false, code: 'SUBSCRIPTION_INACTIVE' });
  });

  it('acreditación: permisos AAL2, idempotencia y conflicto', async () => {
    const t = setup();
    t.asMerchant();
    expect(
      await t.fake.admin_grant_publication_credits({ merchantId: MERCHANT, credits: 5, source: 'purchase', operationKey: key(1) })
    ).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    t.asAdmin('aal1');
    expect(
      await t.fake.admin_grant_publication_credits({ merchantId: MERCHANT, credits: 5, source: 'purchase', operationKey: key(1) })
    ).toEqual({ ok: false, code: 'AAL2_REQUIRED' });
    const first = await t.grant(5, 1);
    const retry = await t.grant(5, 1);
    expect(first.ok && first.data.idempotent).toBe(false);
    expect(retry.ok && retry.data.idempotent).toBe(true);
    expect(await t.grant(6, 1)).toEqual({ ok: false, code: 'IDEMPOTENCY_CONFLICT' });
    expect((await t.balance()).available).toBe(5);
  });

  it('costo híbrido con N = 2: 1/2/3/5 entregas cuestan 1/1/2/4', async () => {
    const t = setup();
    await t.grant(10, 1);
    const costs: number[] = [];
    for (const [index, drops] of [1, 2, 3, 5].entries()) {
      expect((await t.publish(requestId(index + 1), drops)).ok).toBe(true);
      costs.push(t.current(requestId(index + 1))?.cost ?? -1);
    }
    expect(costs).toEqual([1, 1, 2, 4]);
    expect((await t.balance()).available).toBe(2);
  });

  it('reserva → match consume → no_show vuelve a reserva → vence y libera → republicar reserva de nuevo', async () => {
    const t = setup();
    await t.grant(3, 1);
    expect((await t.publish(requestId(1))).ok).toBe(true);
    const charge = t.current(requestId(1));
    expect(charge?.state).toBe('reserved');
    expect((await t.match(requestId(1))).ok).toBe(true);
    expect(t.current(requestId(1))?.state).toBe('consumed');

    t.asMerchant();
    expect((await t.fake.report_no_show({ requestId: requestId(1), republish: true })).ok).toBe(true);
    expect(t.current(requestId(1))).toMatchObject({ id: charge?.id, state: 'reserved' });
    expect((await t.balance()).available).toBe(2);

    t.advance(31 * 60_000);
    t.asMerchant();
    expect((await t.fake.reconcile_expired_requests({})).ok).toBe(true);
    expect(t.current(requestId(1))).toBeUndefined();
    expect((await t.balance()).available).toBe(3);

    t.asMerchant();
    expect((await t.fake.republish_request({ requestId: requestId(1) })).ok).toBe(true);
    expect(t.fake.getPublicationCharges(requestId(1))).toHaveLength(2);
    expect((await t.balance()).available).toBe(2);
  });

  it('D-C2a: sacar al repartidor deja el consumo histórico y reserva otro crédito', async () => {
    const t = setup();
    await t.grant(3, 1);
    await t.publish(requestId(1));
    await t.match(requestId(1));
    const consumed = t.current(requestId(1));
    t.asMerchant();
    expect((await t.fake.republish_request({ requestId: requestId(1), reason: 'No contesta' })).ok).toBe(true);
    const charges = t.fake.getPublicationCharges(requestId(1));
    expect(charges.find((c) => c.id === consumed?.id)).toMatchObject({ state: 'consumed', isCurrent: false });
    expect(charges.filter((c) => c.isCurrent)).toHaveLength(1);
    expect((await t.balance()).available).toBe(1);
  });

  it('un tope por ventana después de reservar deshace la reserva', async () => {
    const t = setup({ settings: { maxRequestPublicationsPerMin: 1 } });
    await t.grant(3, 1);
    expect((await t.publish(requestId(1))).ok).toBe(true);
    expect(await t.publish(requestId(2))).toEqual({ ok: false, code: 'RATE_LIMITED' });
    expect(t.fake.getPublicationCharges(requestId(2))).toHaveLength(0);
    expect((await t.balance()).available).toBe(2);
  });

  it('legacy_paid e ilimitado publican sin reservar; plan antes que sueltos', async () => {
    const legacy = setup();
    legacy.setMerchant('active', '2026-11-30');
    await legacy.grant(2, 1);
    await legacy.publish(requestId(1));
    expect(legacy.current(requestId(1))).toMatchObject({ mode: 'legacy_paid', cost: 0 });
    expect((await legacy.balance()).available).toBe(2);

    const t = setup();
    t.asAdmin();
    const quota = await t.fake.admin_upsert_publication_plan({ planId: null, code: 'plan-5', name: 'Plan 5', kind: 'quota', monthlyCredits: 5, referencePriceArs: null, active: true, sort: 1 });
    const unlimited = await t.fake.admin_upsert_publication_plan({ planId: null, code: 'ilimitado', name: 'Ilimitado', kind: 'unlimited', monthlyCredits: null, referencePriceArs: null, active: true, sort: 2 });
    if (!quota.ok || !unlimited.ok) throw new Error('catálogo');
    await t.grant(2, 1);
    t.asAdmin();
    await t.fake.admin_register_plan_period({ merchantId: MERCHANT, planId: quota.data.planId, isPurchase: true, operationKey: key(2) });
    await t.publish(requestId(1), 5);
    const planLot = (await t.balance()).lots.find((lot) => lot.kind === 'plan');
    expect(planLot?.available).toBe(1);
    await t.publish(requestId(2), 3);
    expect(t.current(requestId(2))?.parts.map((p) => p.amount).sort()).toEqual([1, 1]);

    t.asAdmin();
    const scheduled = await t.fake.admin_register_plan_period({ merchantId: MERCHANT, planId: unlimited.data.planId, isPurchase: true, operationKey: key(3) });
    if (!scheduled.ok) throw new Error(scheduled.code);
    expect(scheduled.data.streak).toBe(2);
    expect((await t.balance()).nextPeriod?.planKind).toBe('unlimited');
  });

  it('fidelidad: renovación tardía dentro de la gracia arrastra 5% del cupo al corte, una sola vez', async () => {
    const t = setup();
    t.asAdmin();
    const plan = await t.fake.admin_upsert_publication_plan({ planId: null, code: 'plan-40', name: 'Plan 40', kind: 'quota', monthlyCredits: 40, referencePriceArs: null, active: true, sort: 1 });
    if (!plan.ok) throw new Error(plan.code);
    const first = await t.fake.admin_register_plan_period({ merchantId: MERCHANT, planId: plan.data.planId, isPurchase: true, operationKey: key(1) });
    if (!first.ok) throw new Error(first.code);
    await t.publish(requestId(1));
    await t.match(requestId(1));

    t.advance(Date.parse(first.data.endsAt) - Date.parse(first.data.startsAt) + 86_400_000);
    t.asAdmin();
    const renewal = await t.fake.admin_register_plan_period({ merchantId: MERCHANT, planId: plan.data.planId, isPurchase: true, operationKey: key(2) });
    if (!renewal.ok) throw new Error(renewal.code);
    expect(renewal.data).toMatchObject({ streak: 2, carryoverPct: 5 });
    const balance = await t.balance();
    expect(balance.lots.filter((lot) => lot.kind === 'carryover').map((lot) => lot.granted)).toEqual([2]);
    await t.balance();
    expect((await t.balance()).lots.filter((lot) => lot.kind === 'carryover')).toHaveLength(1);
    expect(publicationBalanceSchema.safeParse(balance).success).toBe(true);
  });

  it('descuento de lanzamiento solo en la primera compra y 2-A sin superponer legacy', async () => {
    const t = setup({ settings: { launchDiscountPct: 20 } });
    const adjustment = await t.grant(1, 1, 'adjustment');
    const firstPurchase = await t.grant(1, 2, 'purchase');
    const secondPurchase = await t.grant(1, 3, 'purchase');
    expect(adjustment.ok && adjustment.data.launchDiscountPct).toBeNull();
    expect(firstPurchase.ok && firstPurchase.data.launchDiscountPct).toBe(20);
    expect(secondPurchase.ok && secondPurchase.data.launchDiscountPct).toBeNull();

    t.asAdmin();
    const plan = await t.fake.admin_upsert_publication_plan({ planId: null, code: 'plan-5', name: 'Plan 5', kind: 'quota', monthlyCredits: 5, referencePriceArs: null, active: true, sort: 1 });
    if (!plan.ok) throw new Error(plan.code);
    await t.fake.admin_register_plan_period({ merchantId: MERCHANT, planId: plan.data.planId, isPurchase: false, operationKey: key(4) });
    expect(
      await t.fake.admin_set_subscription({ merchantId: MERCHANT, subscriptionStatus: 'active', paidUntil: '2026-12-31' })
    ).toEqual({ ok: false, code: 'INVALID_STATE_TRANSITION' });
  });
});

describe('T-369 / CC-029 — fake: administración y bordes', () => {
  const quota = (code: string, monthlyCredits = 5, active = true) => ({
    planId: null,
    code,
    name: code,
    kind: 'quota' as const,
    monthlyCredits,
    referencePriceArs: null,
    active,
    sort: 1,
  });

  it('parámetros nuevos: se guardan y base/tope se validan entre sí', async () => {
    const t = setup();
    t.asAdmin();
    for (const [settingKey, value] of [
      ['publication_drops_per_credit', 3],
      ['carryover_base_pct', 10],
      ['carryover_step_pct', 2],
      ['carryover_cap_pct', 20],
      ['launch_discount_pct', 15],
      ['loose_credit_reference_price_ars', 900],
    ] as const) {
      expect((await t.fake.admin_update_setting({ key: settingKey, value })).ok).toBe(true);
    }
    expect(await t.fake.admin_update_setting({ key: 'carryover_base_pct', value: 21 })).toEqual({ ok: false, code: 'INVALID_SETTING_VALUE' });
    expect(await t.fake.admin_update_setting({ key: 'carryover_cap_pct', value: 9 })).toEqual({ ok: false, code: 'INVALID_SETTING_VALUE' });

    await t.grant(5, 1);
    await t.publish(requestId(1), 4);
    expect(t.current(requestId(1))?.cost).toBe(2);
    t.asAdmin();
    const first = await t.fake.admin_grant_publication_credits({ merchantId: MERCHANT, credits: 1, source: 'purchase', operationKey: key(2) });
    expect(first.ok && first.data.launchDiscountPct).toBe(15);
  });

  it('catálogo: código duplicado, inexistente, cambio de cupo en uso y desactivación', async () => {
    const t = setup();
    t.asAdmin();
    const plan = await t.fake.admin_upsert_publication_plan(quota('plan-a'));
    if (!plan.ok) throw new Error(plan.code);
    expect(await t.fake.admin_upsert_publication_plan(quota('plan-a'))).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expect(await t.fake.admin_upsert_publication_plan({ ...quota('plan-b'), planId: key(99) })).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect((await t.fake.admin_upsert_publication_plan({ ...quota('plan-a', 8), planId: plan.data.planId })).ok).toBe(true);

    await t.fake.admin_register_plan_period({ merchantId: MERCHANT, planId: plan.data.planId, isPurchase: false, operationKey: key(1) });
    expect(await t.fake.admin_upsert_publication_plan({ ...quota('plan-a', 10), planId: plan.data.planId })).toEqual({ ok: false, code: 'PLAN_IN_USE' });
    const renamed = await t.fake.admin_upsert_publication_plan({ ...quota('plan-a', 8, false), name: 'Plan A', planId: plan.data.planId });
    expect(renamed.ok && renamed.data).toMatchObject({ name: 'Plan A', active: false });
    expect(
      await t.fake.admin_register_plan_period({ merchantId: MERCHANT, planId: plan.data.planId, isPurchase: false, operationKey: key(2) })
    ).toEqual({ ok: false, code: 'PLAN_INACTIVE' });
  });

  it('registro de período: inexistentes, reintento idempotente y conflicto', async () => {
    const t = setup();
    t.asAdmin();
    const plan = await t.fake.admin_upsert_publication_plan(quota('plan-a'));
    if (!plan.ok) throw new Error(plan.code);
    expect(
      await t.fake.admin_grant_publication_credits({ merchantId: COURIER, credits: 1, source: 'adjustment', operationKey: key(1) })
    ).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(
      await t.fake.admin_register_plan_period({ merchantId: COURIER, planId: plan.data.planId, isPurchase: false, operationKey: key(1) })
    ).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(
      await t.fake.admin_register_plan_period({ merchantId: MERCHANT, planId: key(98), isPurchase: false, operationKey: key(1) })
    ).toEqual({ ok: false, code: 'NOT_FOUND' });
    const input = { merchantId: MERCHANT, planId: plan.data.planId, isPurchase: false, operationKey: key(2) };
    const created = await t.fake.admin_register_plan_period(input);
    const retry = await t.fake.admin_register_plan_period(input);
    expect(created.ok && retry.ok && retry.data.periodId === created.data.periodId && retry.data.idempotent).toBe(true);
    expect(await t.fake.admin_register_plan_period({ ...input, isPurchase: true })).toEqual({ ok: false, code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('fuera de la gracia la racha vuelve a 1 y 2-A arranca al terminar el derecho legacy', async () => {
    const t = setup();
    t.asAdmin();
    const plan = await t.fake.admin_upsert_publication_plan(quota('plan-a'));
    if (!plan.ok) throw new Error(plan.code);
    const first = await t.fake.admin_register_plan_period({ merchantId: MERCHANT, planId: plan.data.planId, isPurchase: false, operationKey: key(1) });
    if (!first.ok) throw new Error(first.code);
    t.advance(Date.parse(first.data.endsAt) - Date.parse(first.data.startsAt) + 4 * 86_400_000);
    t.asAdmin();
    const late = await t.fake.admin_register_plan_period({ merchantId: MERCHANT, planId: plan.data.planId, isPurchase: false, operationKey: key(2) });
    expect(late.ok && late.data).toMatchObject({ streak: 1, carryoverPct: 0 });

    const legacy = setup();
    legacy.setMerchant('active', '2026-11-30');
    legacy.asMerchant();
    legacy.asAdmin();
    const legacyPlan = await legacy.fake.admin_upsert_publication_plan(quota('plan-a'));
    if (!legacyPlan.ok) throw new Error(legacyPlan.code);
    const scheduled = await legacy.fake.admin_register_plan_period({ merchantId: MERCHANT, planId: legacyPlan.data.planId, isPurchase: false, operationKey: key(3) });
    expect(scheduled.ok && scheduled.data.startsAt).toBe('2026-12-04T03:00:00.000Z');
    expect((await legacy.balance()).scheduled).toBe(5);
    legacy.asAdmin();
    expect(
      await legacy.fake.admin_set_subscription({ merchantId: MERCHANT, subscriptionStatus: 'active', paidUntil: '2026-12-15' })
    ).toEqual({ ok: false, code: 'INVALID_STATE_TRANSITION' });
    expect((await legacy.fake.admin_set_subscription({ merchantId: MERCHANT, subscriptionStatus: 'expired', paidUntil: null })).ok).toBe(true);
  });

  it('lecturas: paginado del ledger, comercio inexistente y saldo solo para comercios', async () => {
    const t = setup();
    for (let n = 1; n <= 3; n += 1) await t.grant(1, n);
    t.asAdmin();
    const firstPage = await t.fake.admin_get_merchant_publication_credits({ merchantId: MERCHANT, limit: 2 });
    if (!firstPage.ok) throw new Error(firstPage.code);
    expect(firstPage.data.movements).toHaveLength(2);
    expect(firstPage.data.nextCursor).not.toBeNull();
    const secondPage = await t.fake.admin_get_merchant_publication_credits({ merchantId: MERCHANT, limit: 2, beforeId: firstPage.data.nextCursor });
    expect(secondPage.ok && secondPage.data.movements.length === 1 && secondPage.data.nextCursor === null).toBe(true);
    expect(await t.fake.admin_get_merchant_publication_credits({ merchantId: COURIER })).toEqual({ ok: false, code: 'NOT_FOUND' });
    t.asCourier();
    expect(await t.fake.get_my_publication_balance({})).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
  });

  it('saldo con piloto encendido refleja piloto, legacy y vencido', async () => {
    const t = setup({ pilotActive: true });
    expect(await t.balance()).toMatchObject({ mode: 'pilot', canPublish: true });
    t.setMerchant('active', '2026-11-30');
    expect(await t.balance()).toMatchObject({ mode: 'legacy_paid', canPublish: true });
    t.setMerchant('expired');
    expect(await t.balance()).toMatchObject({ mode: 'credits', canPublish: false });
  });

  it('cancelar antes del match libera y la cancelación del repartidor devuelve el consumo a reserva', async () => {
    const t = setup();
    await t.grant(2, 1);
    await t.publish(requestId(1));
    t.asMerchant();
    expect((await t.fake.cancel_request({ requestId: requestId(1), reason: null })).ok).toBe(true);
    expect(t.fake.getPublicationCharges(requestId(1))[0]?.state).toBe('released');
    expect((await t.balance()).available).toBe(2);

    await t.publish(requestId(2));
    await t.match(requestId(2));
    t.asCourier();
    expect((await t.fake.courier_cancel_match({ requestId: requestId(2), reason: 'Se me pinchó la rueda' })).ok).toBe(true);
    expect(t.current(requestId(2))?.state).toBe('reserved');
    expect((await t.balance()).reserved).toBe(1);
  });

  it('D-C7: liberar una reserva de un lote ya vencido la convierte en un crédito suelto, una vez', async () => {
    const t = setup();
    t.asAdmin();
    const plan = await t.fake.admin_upsert_publication_plan(quota('plan-a', 1));
    if (!plan.ok) throw new Error(plan.code);
    const period = await t.fake.admin_register_plan_period({ merchantId: MERCHANT, planId: plan.data.planId, isPurchase: false, operationKey: key(1) });
    if (!period.ok) throw new Error(period.code);
    t.advance(Date.parse(period.data.endsAt) - Date.parse(period.data.startsAt) - 10 * 60_000);
    expect((await t.publish(requestId(1))).ok).toBe(true);
    t.advance(31 * 60_000);
    const balance = await t.balance();
    expect(balance.available).toBe(1);
    expect(balance.lots).toEqual([expect.objectContaining({ kind: 'loose', available: 1 })]);
    expect((await t.balance()).lots).toHaveLength(1);
  });
});
