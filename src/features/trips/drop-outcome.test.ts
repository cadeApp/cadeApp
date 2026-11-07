import { describe, expect, it } from 'vitest';
import { summarizeDropOutcome, toDropOutcomeStatus, type DropOutcomeStatus } from './drop-outcome';

const drops = (...statuses: DropOutcomeStatus[]) => statuses.map((status) => ({ status }));

describe('T-393: summarizeDropOutcome', () => {
  it('todas las entregas entregadas: all_delivered', () => {
    expect(summarizeDropOutcome(drops('delivered', 'delivered'), 'delivered')).toEqual({
      outcome: 'all_delivered',
      total: 2,
      delivered: 2,
      failed: 0,
      pending: 0,
    });
  });

  it('una entregada y otra no: partial, aunque la solicitud cerró en delivered (CC-022 §6)', () => {
    expect(summarizeDropOutcome(drops('delivered', 'failed'), 'delivered')).toEqual({
      outcome: 'partial',
      total: 2,
      delivered: 1,
      failed: 1,
      pending: 0,
    });
  });

  it('ninguna entregada: none_delivered', () => {
    expect(summarizeDropOutcome(drops('failed', 'failed', 'failed'), 'delivered')).toEqual({
      outcome: 'none_delivered',
      total: 3,
      delivered: 0,
      failed: 3,
      pending: 0,
    });
  });

  it('viaje sin cerrar: in_progress, con los conteos reales', () => {
    expect(summarizeDropOutcome(drops('delivered', 'pending', 'failed'), 'in_transit')).toEqual({
      outcome: 'in_progress',
      total: 3,
      delivered: 1,
      failed: 1,
      pending: 1,
    });
    expect(summarizeDropOutcome(drops('pending'), 'matched').outcome).toBe('in_progress');
  });

  it('una sola entrega entregada: all_delivered', () => {
    expect(summarizeDropOutcome(drops('delivered'), 'delivered')).toEqual({
      outcome: 'all_delivered',
      total: 1,
      delivered: 1,
      failed: 0,
      pending: 0,
    });
  });

  it('D02-B: una sola entrega no realizada es none_delivered (se usa el estado real de la entrega)', () => {
    expect(summarizeDropOutcome(drops('failed'), 'delivered')).toEqual({
      outcome: 'none_delivered',
      total: 1,
      delivered: 0,
      failed: 1,
      pending: 0,
    });
  });

  it('legacy sin drops: el resultado sale del estado de la solicitud', () => {
    expect(summarizeDropOutcome([], 'delivered')).toEqual({
      outcome: 'all_delivered',
      total: 1,
      delivered: 1,
      failed: 0,
      pending: 0,
    });
    expect(summarizeDropOutcome(undefined, 'in_transit')).toEqual({
      outcome: 'in_progress',
      total: 1,
      delivered: 0,
      failed: 0,
      pending: 1,
    });
  });
});

describe('T-393: toDropOutcomeStatus', () => {
  it('lee delivered y failed, y cualquier otro valor cuenta como pendiente', () => {
    expect(toDropOutcomeStatus('delivered')).toBe('delivered');
    expect(toDropOutcomeStatus('failed')).toBe('failed');
    expect(toDropOutcomeStatus('pending')).toBe('pending');
    expect(toDropOutcomeStatus(undefined)).toBe('pending');
    expect(toDropOutcomeStatus('otro')).toBe('pending');
  });
});
