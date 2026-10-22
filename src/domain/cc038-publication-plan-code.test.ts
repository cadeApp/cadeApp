import { describe, expect, it } from 'vitest';
import { adminUpsertPublicationPlanInputSchema, type RpcInput } from './rpc-contracts';
import { createFakeRpcClient, type FakePlatformSettings } from './testing/rpc-fake';

// CC-038 (T-411): el código del plan lo genera la RPC desde el nombre y no cambia al editar. Los ejemplos son los del
// pgTAP `supabase/tests/cc038_publication_plan_code.sql`.

const ADMIN = '00000000-0000-4000-8000-0000000380a1';

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

function plan(name: string, planId: string | null = null): RpcInput<'admin_upsert_publication_plan'> {
  return { planId, name, kind: 'quota', monthlyCredits: 5, referencePriceArs: null, active: true, sort: 1 };
}

function setup() {
  const fake = createFakeRpcClient({
    settings: SETTINGS,
    initialActor: { userId: ADMIN, role: 'admin', aal: 'aal2', consentStatus: 'active' },
  });
  return {
    async create(name: string) {
      const result = await fake.admin_upsert_publication_plan(plan(name));
      if (!result.ok) throw new Error(result.code);
      return result.data;
    },
    edit: (planId: string, name: string) => fake.admin_upsert_publication_plan(plan(name, planId)),
  };
}

describe('CC-038: contrato de admin_upsert_publication_plan', () => {
  it('el input no lleva código: una clave code extra se descarta', () => {
    const parsed = adminUpsertPublicationPlanInputSchema.safeParse({ ...plan('Plan 40'), code: 'X' });
    expect(parsed.success).toBe(true);
    expect(parsed.success && 'code' in parsed.data).toBe(false);
  });
});

describe('CC-038: el fake genera el código como la base', () => {
  it('minúsculas, sin tildes ni ñ, con guiones y sin símbolos', async () => {
    const t = setup();
    expect((await t.create('CC038 Básico 20')).code).toBe('cc038-basico-20');
    expect((await t.create('Ñandú  Premium!!')).code).toBe('nandu-premium');
    expect((await t.create('  ÁÉÍÓÚ üç  ')).code).toBe('aeiou-uc');
    expect((await t.create('¡¡')).code).toBe('plan');
  });

  it('un nombre largo da un código de hasta 32 caracteres sin guion final', async () => {
    const t = setup();
    expect((await t.create(`CC038 ${'Ab '.repeat(24)}`.trim())).code).toBe('cc038-ab-ab-ab-ab-ab-ab-ab-ab-ab');
  });

  it('el mismo nombre lleva -2 y -3, y sigue al mayor sufijo existente', async () => {
    const t = setup();
    expect((await t.create('CC038 Básico 20')).code).toBe('cc038-basico-20');
    expect((await t.create('CC038 Básico 20')).code).toBe('cc038-basico-20-2');
    expect((await t.create('CC038 Básico 20')).code).toBe('cc038-basico-20-3');

    expect((await t.create('CC038 Salto')).code).toBe('cc038-salto');
    expect((await t.create('CC038 Salto 7')).code).toBe('cc038-salto-7');
    expect((await t.create('CC038 Salto')).code).toBe('cc038-salto-8');
  });

  it('una base libre se usa sin sufijo aunque exista base-2', async () => {
    const t = setup();
    expect((await t.create('CC038 Libre 2')).code).toBe('cc038-libre-2');
    expect((await t.create('CC038 Libre')).code).toBe('cc038-libre');
  });

  it('al editar, el nombre cambia y el código queda fijo', async () => {
    const t = setup();
    const created = await t.create('CC038 Básico 20');
    const edited = await t.edit(created.planId, 'CC038 Renombrado');
    expect(edited.ok && edited.data).toMatchObject({ planId: created.planId, code: 'cc038-basico-20', name: 'CC038 Renombrado' });
    expect((await t.create('CC038 Renombrado')).code).toBe('cc038-renombrado');
  });
});
