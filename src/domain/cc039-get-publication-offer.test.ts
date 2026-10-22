import { describe, expect, it } from 'vitest';
import { ALL_RPC_NAMES, RPC_CONTRACTS } from './rpc-contracts';
import { createFakeRpcClient, type FakePlatformSettings } from './testing/rpc-fake';

// CC-039 (T-412): oferta comercial para el comercio. Los casos siguen al pgTAP
// `supabase/tests/cc039_get_publication_offer.sql`.

const ADMIN = '00000000-0000-4000-8000-0000000390a1';
const MERCHANT = '00000000-0000-4000-8000-0000000390b1';
const OTHER_MERCHANT = '00000000-0000-4000-8000-0000000390b2';
const COURIER = '00000000-0000-4000-8000-0000000390c1';

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

const plan = {
  planId: '00000000-0000-4000-8000-000000390001',
  name: 'Plan 40',
  kind: 'quota',
  monthlyCredits: 40,
  referencePriceArs: 20000,
};

describe('CC-039: contrato de get_publication_offer', () => {
  const contract = RPC_CONTRACTS.get_publication_offer;

  it('está registrado con los errores de una lectura del comercio', () => {
    expect(ALL_RPC_NAMES).toContain('get_publication_offer');
    expect(contract.errorCodes).toEqual(['UNAUTHENTICATED', 'UNAUTHORIZED_ACTOR', 'INTERNAL_ERROR']);
    expect(contract.inputSchema.safeParse({}).success).toBe(true);
    expect(contract.inputSchema.safeParse({ extra: 1 }).success).toBe(false);
  });

  it('la salida es estricta: un plan con code o un campo de más no pasa', () => {
    const offer = { plans: [plan], looseCreditReferencePriceArs: 900, launchDiscountPct: 15 };
    expect(contract.outputSchema.safeParse(offer).success).toBe(true);
    expect(contract.outputSchema.safeParse({ ...offer, plans: [{ ...plan, code: 'plan-40' }] }).success).toBe(false);
    expect(contract.outputSchema.safeParse({ ...offer, extra: true }).success).toBe(false);
    expect(
      contract.outputSchema.safeParse({ ...offer, looseCreditReferencePriceArs: null, launchDiscountPct: null }).success
    ).toBe(true);
    expect(contract.outputSchema.safeParse({ ...offer, launchDiscountPct: 0 }).success).toBe(false);
  });
});

describe('CC-039: el fake devuelve la oferta como la base', () => {
  function setup(settings: Partial<FakePlatformSettings> = {}) {
    const fake = createFakeRpcClient({
      settings: { ...SETTINGS, ...settings },
      initialActor: { userId: ADMIN, role: 'admin', aal: 'aal2', consentStatus: 'active' },
      initialMerchants: [
        { merchantId: MERCHANT, subscriptionStatus: 'active' },
        { merchantId: OTHER_MERCHANT, subscriptionStatus: 'active' },
      ],
    });
    const asAdmin = () => fake.setActor({ userId: ADMIN, role: 'admin', aal: 'aal2', consentStatus: 'active' });
    const asMerchant = (userId = MERCHANT, consentStatus: 'active' | 'pending' = 'active') =>
      fake.setActor({ userId, role: 'merchant', aal: 'aal1', consentStatus });
    return { fake, asAdmin, asMerchant };
  }

  async function createPlan(
    t: ReturnType<typeof setup>,
    name: string,
    sort: number,
    active = true,
    kind: 'quota' | 'unlimited' = 'quota'
  ) {
    t.asAdmin();
    const result = await t.fake.admin_upsert_publication_plan({
      planId: null,
      name,
      kind,
      monthlyCredits: kind === 'quota' ? 10 : null,
      referencePriceArs: kind === 'quota' ? 5000 : null,
      active,
      sort,
    });
    if (!result.ok) throw new Error(result.code);
    return result.data.planId;
  }

  it('solo el comercio activo con alta la lee', async () => {
    const t = setup();
    t.fake.setActor({ userId: COURIER, role: 'courier', aal: 'aal1', consentStatus: 'active' });
    expect(await t.fake.get_publication_offer({})).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    t.asAdmin();
    expect(await t.fake.get_publication_offer({})).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    t.asMerchant(MERCHANT, 'pending');
    expect(await t.fake.get_publication_offer({})).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    // setActor siembra el comercio; sin su fila en merchants, la base responde UNAUTHORIZED_ACTOR.
    t.asMerchant('00000000-0000-4000-8000-0000000390b9');
    t.fake.deleteMerchant('00000000-0000-4000-8000-0000000390b9');
    expect(await t.fake.get_publication_offer({})).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
  });

  it('solo planes activos, en orden sort e id, sin código', async () => {
    const t = setup();
    const plan40 = await createPlan(t, 'Plan 40', 2);
    const unlimited = await createPlan(t, 'Ilimitado', 1, true, 'unlimited');
    await createPlan(t, 'Inactivo', 0, false);
    const plan10 = await createPlan(t, 'Plan 10', 1);

    t.asMerchant();
    const result = await t.fake.get_publication_offer({});
    if (!result.ok) throw new Error(result.code);
    const sortOne = [unlimited, plan10].sort();
    expect(result.data.plans.map((p) => p.planId)).toEqual([...sortOne, plan40]);
    expect(result.data.plans.find((p) => p.planId === plan40)).toEqual({
      planId: plan40,
      name: 'Plan 40',
      kind: 'quota',
      monthlyCredits: 10,
      referencePriceArs: 5000,
    });
    expect(result.data.plans.find((p) => p.planId === unlimited)).toMatchObject({
      kind: 'unlimited',
      monthlyCredits: null,
      referencePriceArs: null,
    });
  });

  it('devuelve como mucho 50 planes', async () => {
    const t = setup();
    for (let n = 0; n < 55; n += 1) await createPlan(t, `Plan ${n}`, 1);
    t.asMerchant();
    const result = await t.fake.get_publication_offer({});
    expect(result.ok && result.data.plans.length).toBe(50);
  });

  it('precio del crédito suelto: null sin cargar y su valor si está', async () => {
    const t = setup();
    t.asMerchant();
    const empty = await t.fake.get_publication_offer({});
    expect(empty.ok && empty.data.looseCreditReferencePriceArs).toBeNull();

    const priced = setup({ looseCreditReferencePriceArs: 900 });
    priced.asMerchant();
    const result = await priced.fake.get_publication_offer({});
    expect(result.ok && result.data.looseCreditReferencePriceArs).toBe(900);
  });

  it('descuento: null con 0 %, el porcentaje sin primera compra y null después de comprar', async () => {
    const zero = setup();
    zero.asMerchant();
    const none = await zero.fake.get_publication_offer({});
    expect(none.ok && none.data.launchDiscountPct).toBeNull();

    const t = setup({ launchDiscountPct: 15 });
    t.asMerchant();
    const before = await t.fake.get_publication_offer({});
    expect(before.ok && before.data.launchDiscountPct).toBe(15);

    t.asAdmin();
    const grant = await t.fake.admin_grant_publication_credits({
      merchantId: MERCHANT,
      credits: 1,
      source: 'purchase',
      operationKey: '00000000-0000-4000-8000-0000000391a1',
    });
    expect(grant.ok).toBe(true);

    t.asMerchant();
    const after = await t.fake.get_publication_offer({});
    expect(after.ok && after.data.launchDiscountPct).toBeNull();
    t.asMerchant(OTHER_MERCHANT);
    const other = await t.fake.get_publication_offer({});
    expect(other.ok && other.data.launchDiscountPct).toBe(15);
  });
});
