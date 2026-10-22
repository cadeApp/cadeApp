import { describe, it, expect } from 'vitest';
import { INCIDENT_DECISIONS, INCIDENT_KINDS, incidentDecisionSchema, incidentKindSchema } from '@/domain';
import {
  incidentsInboxHref,
  parseIncidentsSearchParams,
  reportIncidentFormSchema,
  resolveIncidentFormSchema,
  resolveIncidentSchema,
  serializeIncidentsCursor,
} from './schemas';

const REQUEST_ID = 'd0000000-0000-4000-8000-000000000001';
const INCIDENT_ID = 'e0000000-0000-4000-8000-000000000002';
const COURIER_ID = 'c0000000-0000-4000-8000-000000000003';

describe('PR113-H04: reportIncidentFormSchema usa el contrato canónico de CC-012', () => {
  const valid = {
    requestId: REQUEST_ID,
    kind: 'damaged_goods',
    description: 'La caja llegó abierta y faltaba una docena de facturas.',
  };

  it('usa incidentKindSchema del dominio, sin una enum paralela', () => {
    expect(reportIncidentFormSchema.shape.kind).toBe(incidentKindSchema);
  });

  it.each(INCIDENT_KINDS)('acepta el tipo canónico %s', (kind) => {
    expect(reportIncidentFormSchema.safeParse({ ...valid, kind }).success).toBe(true);
  });

  it.each(['robbery', 'delay', '', 'DAMAGED_GOODS'])('rechaza el tipo no canónico «%s»', (kind) => {
    expect(reportIncidentFormSchema.safeParse({ ...valid, kind }).success).toBe(false);
  });

  it.each([
    { name: 'requestId inválido', patch: { requestId: 'no-uuid' } },
    { name: 'relato vacío', patch: { description: '   ' } },
    { name: 'relato de 4 caracteres', patch: { description: 'Mal.' } },
    { name: 'relato de 1001 caracteres', patch: { description: 'a'.repeat(1001) } },
    { name: 'relato con teléfono', patch: { description: 'Llamame al 3865 44-1122 para ver qué pasó.' } },
    { name: 'relato con +54', patch: { description: 'El cliente atiende en +54 9 3865 441122 siempre.' } },
    { name: 'relato con correo', patch: { description: 'Escribime a juan.perez@correo.com por el reclamo.' } },
  ])('rechaza $name', ({ patch }) => {
    expect(reportIncidentFormSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it('acepta montos y recorta el relato', () => {
    const parsed = reportIncidentFormSchema.safeParse({
      ...valid,
      kind: 'payment_issue',
      description: '  Pagó con $ 2.000 y no tenía cambio para $ 500 del envío.  ',
    });
    expect(parsed.success && parsed.data.description).toBe(
      'Pagó con $ 2.000 y no tenía cambio para $ 500 del envío.'
    );
  });
});

describe('PR113-H03/H04: resolveIncidentSchema es { incidentId, decision, reason } sin courierId', () => {
  const valid = { incidentId: INCIDENT_ID, decision: 'warning', reason: 'Primera advertencia.' };

  it('usa incidentDecisionSchema del dominio', () => {
    expect(resolveIncidentSchema.shape.decision).toBe(incidentDecisionSchema);
    expect(Object.keys(resolveIncidentSchema.shape).sort()).toEqual(['decision', 'incidentId', 'reason']);
  });

  it.each(INCIDENT_DECISIONS)('acepta la decisión canónica %s', (decision) => {
    expect(resolveIncidentSchema.safeParse({ ...valid, decision }).data).toEqual({ ...valid, decision });
  });

  it('rechaza un courierId enviado por el cliente', () => {
    expect(resolveIncidentSchema.safeParse({ ...valid, courierId: COURIER_ID }).success).toBe(false);
  });

  it.each([
    { name: 'decisión desconocida', patch: { decision: 'ban_forever' } },
    { name: 'sin motivo', patch: { reason: '   ' } },
    { name: 'motivo de 501 caracteres', patch: { reason: 'a'.repeat(501) } },
    { name: 'incidentId inválido', patch: { incidentId: 'x' } },
  ])('rechaza $name', ({ patch }) => {
    expect(resolveIncidentSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it('el formulario del Dialog valida solo el motivo con la misma regla', () => {
    expect(Object.keys(resolveIncidentFormSchema.shape)).toEqual(['reason']);
    expect(resolveIncidentFormSchema.safeParse({ reason: '' }).success).toBe(false);
    expect(resolveIncidentFormSchema.safeParse({ reason: 'Motivo válido' }).success).toBe(true);
  });
});

describe('PR113-H04/H06: parseIncidentsSearchParams valida pestaña y cursor compuesto', () => {
  const cursor = { createdAt: '2026-09-27T12:00:00.123456Z', id: INCIDENT_ID };

  it('sin parámetros abre la pestaña de abiertos, primera página', () => {
    expect(parseIncidentsSearchParams({})).toEqual({ tab: 'open' });
  });

  it('acepta la pestaña cerrados y un cursor { createdAt, id } con microsegundos', () => {
    expect(
      parseIncidentsSearchParams({ tab: 'closed', cursor: serializeIncidentsCursor(cursor) })
    ).toEqual({ tab: 'closed', cursor });
  });

  it.each(['resolved', 'OPEN', '', ['open', 'closed']])('una pestaña inválida (%s) vuelve a abiertos', (tab) => {
    expect(parseIncidentsSearchParams({ tab })).toEqual({ tab: 'open' });
  });

  it.each([
    ['timestamp solo (sin id)', '2026-09-27T12:00:00.123456Z'],
    ['id solo', INCIDENT_ID],
    ['fecha inválida', `ayer_${INCIDENT_ID}`],
    ['id inválido', '2026-09-27T12:00:00.123456Z_no-uuid'],
    ['partes de más', `2026-09-27T12:00:00Z_${INCIDENT_ID}_x`],
    ['inyección', "1' or '1'='1"],
    ['arreglo', [serializeIncidentsCursor(cursor)]],
  ])('descarta el cursor inválido (%s) sin afectar la pestaña', (_name, raw) => {
    expect(parseIncidentsSearchParams({ tab: 'closed', cursor: raw })).toEqual({ tab: 'closed' });
  });

  it('el link de la bandeja conserva pestaña y cursor completo', () => {
    const href = incidentsInboxHref('closed', cursor);
    const url = new URL(href, 'http://localhost');
    expect(url.pathname).toBe('/admin/incidents');
    expect(
      parseIncidentsSearchParams({
        tab: url.searchParams.get('tab'),
        cursor: url.searchParams.get('cursor'),
      })
    ).toEqual({ tab: 'closed', cursor });
    expect(incidentsInboxHref('open')).toBe('/admin/incidents');
  });
});
