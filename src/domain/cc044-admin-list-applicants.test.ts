import { describe, expect, it } from 'vitest';
import { ALL_RPC_NAMES, RPC_CONTRACTS } from './index';
import {
  type FakePlatformSettings,
  type FakeSeedCourier,
  createFakeRpcClient,
  normalizeApplicantSearch,
} from './testing/rpc-fake';

const item = {
  id: '00000000-0000-4000-8000-000000440001',
  displayName: 'José Pérez',
  phone: '+549386500441',
  vehicleType: 'bike',
  status: 'pending',
  hasDni: true,
  docLevel: 0,
  licenseStatus: 'none',
  insuranceStatus: 'none',
  createdAt: '2026-11-04T12:00:00.000000Z',
  submittedAt: '2026-11-04T12:30:00.000000Z',
  documents: { dniFront: true, dniBack: true, selfie: true, license: false, insurance: false },
};

describe('CC-044: contrato de admin_list_applicants', () => {
  const contract = RPC_CONTRACTS.admin_list_applicants;

  it('está registrado con los errores canónicos de las RPC admin', () => {
    expect(ALL_RPC_NAMES).toContain('admin_list_applicants');
    expect(contract.errorCodes).toEqual(['UNAUTHENTICATED', 'UNAUTHORIZED_ACTOR', 'AAL2_REQUIRED', 'VALIDATION_ERROR']);
  });

  it('acepta estado, búsqueda, cursor, dirección y límite', () => {
    expect(contract.inputSchema.safeParse({ status: 'pending' }).success).toBe(true);
    expect(
      contract.inputSchema.safeParse({
        status: 'approved',
        query: 'jose',
        cursor: { createdAt: item.createdAt, id: item.id },
        direction: 'prev',
        limit: 50,
      }).success
    ).toBe(true);
  });

  it('rechaza estados, términos, cursores, direcciones y límites inválidos', () => {
    expect(contract.inputSchema.safeParse({ status: 'draft' }).success).toBe(false);
    expect(contract.inputSchema.safeParse({ status: 'pending', query: 'a'.repeat(81) }).success).toBe(false);
    expect(contract.inputSchema.safeParse({ status: 'pending', query: ` ${'a'.repeat(80)} ` }).success).toBe(true);
    expect(contract.inputSchema.safeParse({ status: 'pending', cursor: { id: item.id } }).success).toBe(false);
    expect(contract.inputSchema.safeParse({ status: 'pending', direction: 'back' }).success).toBe(false);
    expect(contract.inputSchema.safeParse({ status: 'pending', direction: 'prev' }).success).toBe(false);
    expect(contract.inputSchema.safeParse({ status: 'pending', limit: 0 }).success).toBe(false);
    expect(contract.inputSchema.safeParse({ status: 'pending', limit: 51 }).success).toBe(false);
  });

  it('parsea la salida con total y los dos cursores', () => {
    const cursor = { createdAt: item.createdAt, id: item.id };
    expect(
      contract.outputSchema.safeParse({ items: [item], total: 1, nextCursor: cursor, prevCursor: null }).success
    ).toBe(true);
    expect(contract.outputSchema.safeParse({ items: [], total: 0, nextCursor: null, prevCursor: null }).success).toBe(
      true
    );
    expect(contract.outputSchema.safeParse({ items: [], nextCursor: null, prevCursor: null }).success).toBe(false);
  });

  it('es estricto: el hash del DNI, una ruta o un dato bancario invalidan la salida', () => {
    for (const extra of ['dniHmac', 'storagePath', 'cbu', 'alias', 'email']) {
      expect(
        contract.outputSchema.safeParse({
          items: [{ ...item, [extra]: 'x' }],
          total: 1,
          nextCursor: null,
          prevCursor: null,
        }).success,
        extra
      ).toBe(false);
    }
    expect(
      contract.outputSchema.safeParse({
        items: [{ ...item, documents: { ...item.documents, storagePath: 'courier/x' } }],
        total: 1,
        nextCursor: null,
        prevCursor: null,
      }).success
    ).toBe(false);
  });
});

describe('CC-044: normalización de la búsqueda', () => {
  it('ignora tildes, diéresis, la virgulilla de la ñ, mayúsculas y espacios de más', () => {
    expect(normalizeApplicantSearch('José')).toBe('jose');
    expect(normalizeApplicantSearch('  JOSÉ  ')).toBe('jose');
    expect(normalizeApplicantSearch('Núñez')).toBe('nunez');
    expect(normalizeApplicantSearch('Álvaro   Güemes')).toBe('alvaro guemes');
  });

  it('no iguala letras que no se descomponen', () => {
    expect(normalizeApplicantSearch('Łukasz')).not.toBe('lukasz');
  });
});

const SETTINGS: FakePlatformSettings = {
  minOfferArs: 1200,
  maxOffersPerMin: 10,
  maxRequestPublicationsPerMin: 10,
  maxIncidentsPerMin: 5,
  requestTtlMinutes: 25,
  pilotActive: true,
  pilotTermsVersion: 'v1.0',
  subscriptionGraceDays: 3,
};

const ADMIN = '90000000-0000-4000-8000-000000000001';
const p = (n: number) => `40000000-0000-4000-8000-00000000000${n}`;
const T0 = '2026-11-04T12:00:00.000000Z';
const H1 = '2026-11-04T11:00:00.000000Z';
const H2 = '2026-11-04T10:00:00.000000Z';
const H3 = '2026-11-04T09:00:00.000000Z';
const pending = (n: number, displayName: string, createdAt: string, extra: Partial<FakeSeedCourier> = {}) => ({
  courierId: p(n),
  status: 'pending' as const,
  available: false,
  displayName,
  createdAt,
  applicationSubmitted: true,
  submittedAt: '2026-11-04T12:30:00.000000Z',
  vehicleType: 'bike' as const,
  ...extra,
});

// p1 y p2 empatan en T0; p4 y p5 en H2. p5 es histórico sin fecha; p7 no envió; p8 está aprobado.
const COURIERS: FakeSeedCourier[] = [
  pending(1, 'José Pérez', T0, { hasDni: true }),
  pending(2, 'Lucía Pereyra', T0),
  pending(3, 'Martín  Núñez', H1),
  pending(4, 'Álvaro Gómez', H2),
  pending(5, 'Ana Histórica', H2, { submittedAt: null }),
  pending(6, 'Josefina Ruiz', H3),
  pending(7, 'José Sin Envío', H3, { applicationSubmitted: false, submittedAt: null, vehicleType: null }),
  { ...pending(8, 'José Aprobado', H3), status: 'approved' },
];

function applicantsFake() {
  return createFakeRpcClient({
    settings: SETTINGS,
    now: () => new Date('2026-11-04T13:00:00.000Z'),
    initialActor: { userId: ADMIN, role: 'admin', aal: 'aal2' },
    initialCouriers: COURIERS,
    initialDocuments: [
      { documentId: '50000000-0000-4000-8000-000000000001', courierId: p(1), kind: 'license', status: 'submitted' },
    ],
  });
}

type Fake = ReturnType<typeof applicantsFake>;
type ListInput = Parameters<Fake['admin_list_applicants']>[0];

async function list(fake: Fake, input: ListInput) {
  const result = await fake.admin_list_applicants(input);
  if (!result.ok) throw new Error(result.code);
  return result.data;
}
const ids = (data: { items: readonly { id: string }[] }) => data.items.map((i) => i.id);
const [tieHigh, tieLow] = [p(1), p(2)].sort().reverse();
const [tie2High, tie2Low] = [p(4), p(5)].sort().reverse();

describe('CC-044: admin_list_applicants en el fake del dominio', () => {
  it('pending: solo postulaciones enviadas, en orden de alta con desempate por id', async () => {
    const data = await list(applicantsFake(), { status: 'pending', limit: 50 });
    expect(ids(data)).toEqual([tieHigh, tieLow, p(3), tie2High, tie2Low, p(6)]);
    expect(data.total).toBe(6);
    expect(ids(data)).not.toContain(p(7));
  });

  it('los demás estados filtran solo por estado', async () => {
    expect(ids(await list(applicantsFake(), { status: 'approved' }))).toEqual([p(8)]);
  });

  it('busca sin tildes ni mayúsculas, respeta el estado y el total sigue la búsqueda', async () => {
    const fake = applicantsFake();
    for (const query of ['jose', 'JOSE', ' José ']) {
      const data = await list(fake, { status: 'pending', query });
      expect(ids(data), query).toEqual([p(1), p(6)]);
      expect(data.total, query).toBe(2);
    }
    expect(ids(await list(fake, { status: 'pending', query: 'nunez' }))).toEqual([p(3)]);
    expect(ids(await list(fake, { status: 'pending', query: 'martin nunez' }))).toEqual([p(3)]);
    expect(ids(await list(fake, { status: 'pending', query: 'alvaro' }))).toEqual([p(4)]);
    expect(ids(await list(fake, { status: 'pending', query: 'perez' }))).toEqual([p(1)]);
    expect(ids(await list(fake, { status: 'pending', query: 'jos%' }))).toEqual([]);
    expect(ids(await list(fake, { status: 'approved', query: 'jose' }))).toEqual([p(8)]);
  });

  it('pagina hacia adelante y hacia atrás con los mismos ítems y el mismo total', async () => {
    const fake = applicantsFake();
    const page1 = await list(fake, { status: 'pending', limit: 2 });
    expect(page1.prevCursor).toBeNull();
    if (!page1.nextCursor) throw new Error('falta nextCursor');
    const page2 = await list(fake, { status: 'pending', limit: 2, cursor: page1.nextCursor });
    if (!page2.nextCursor || !page2.prevCursor) throw new Error('faltan cursores en la página 2');
    const page3 = await list(fake, { status: 'pending', limit: 2, cursor: page2.nextCursor });
    expect(page3.nextCursor).toBeNull();
    expect([...ids(page1), ...ids(page2), ...ids(page3)]).toEqual([tieHigh, tieLow, p(3), tie2High, tie2Low, p(6)]);
    expect([page1.total, page2.total, page3.total]).toEqual([6, 6, 6]);

    if (!page3.prevCursor) throw new Error('falta prevCursor en la página 3');
    const back2 = await list(fake, { status: 'pending', limit: 2, cursor: page3.prevCursor, direction: 'prev' });
    expect(ids(back2)).toEqual(ids(page2));
    if (!back2.prevCursor) throw new Error('falta prevCursor al volver');
    const back1 = await list(fake, { status: 'pending', limit: 2, cursor: back2.prevCursor, direction: 'prev' });
    expect(ids(back1)).toEqual(ids(page1));
    expect(back1.prevCursor).toBeNull();
  });

  it('con búsqueda, las dos direcciones respetan el filtro', async () => {
    const fake = applicantsFake();
    const first = await list(fake, { status: 'pending', query: 'jose', limit: 1 });
    expect(ids(first)).toEqual([p(1)]);
    if (!first.nextCursor) throw new Error('falta nextCursor');
    const second = await list(fake, { status: 'pending', query: 'jose', limit: 1, cursor: first.nextCursor });
    expect(ids(second)).toEqual([p(6)]);
    expect(second.nextCursor).toBeNull();
    if (!second.prevCursor) throw new Error('falta prevCursor');
    const back = await list(fake, {
      status: 'pending',
      query: 'jose',
      limit: 1,
      cursor: second.prevCursor,
      direction: 'prev',
    });
    expect(ids(back)).toEqual([p(1)]);
  });

  it('devuelve hasDni, documentos vigentes y submittedAt (null en un histórico)', async () => {
    const data = await list(applicantsFake(), { status: 'pending', limit: 50 });
    const byId = new Map(data.items.map((i) => [i.id, i]));
    expect(byId.get(p(1))).toMatchObject({
      hasDni: true,
      submittedAt: '2026-11-04T12:30:00.000000Z',
      documents: { dniFront: false, dniBack: false, selfie: false, license: true, insurance: false },
    });
    expect(byId.get(p(2))?.hasDni).toBe(false);
    expect(byId.get(p(5))?.submittedAt).toBeNull();
  });

  it('solo el admin con aal2 la usa', async () => {
    const fake = applicantsFake();
    fake.setActor({ aal: 'aal1' });
    expect(await fake.admin_list_applicants({ status: 'pending' })).toMatchObject({ ok: false, code: 'AAL2_REQUIRED' });
    fake.setActor({ userId: p(1), role: 'courier', aal: 'aal2' });
    expect(await fake.admin_list_applicants({ status: 'pending' })).toMatchObject({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
  });
});
