import { describe, it, expect } from 'vitest';
import { parseAdminApplicantsSearchParams } from './schemas';

describe('parseAdminApplicantsSearchParams (PR106-H07)', () => {
  it('retorna tab pending y page 1 para un objeto vacío {}', () => {
    const parsed = parseAdminApplicantsSearchParams({});
    expect(parsed).toEqual({ tab: 'pending', page: 1 });
  });

  it('retorna tab approved y page 2 para { tab: "approved", page: "2" }', () => {
    const parsed = parseAdminApplicantsSearchParams({ tab: 'approved', page: '2' });
    expect(parsed).toEqual({ tab: 'approved', page: 2 });
  });

  it('retorna tab pending cuando recibe tab desconocido "ghost"', () => {
    const parsed = parseAdminApplicantsSearchParams({ tab: 'ghost' });
    expect(parsed.tab).toBe('pending');
  });

  it('retorna page 1 cuando recibe page "-1"', () => {
    const parsed = parseAdminApplicantsSearchParams({ page: '-1' });
    expect(parsed.page).toBe(1);
  });

  it('retorna page 1 cuando recibe page "0"', () => {
    const parsed = parseAdminApplicantsSearchParams({ page: '0' });
    expect(parsed.page).toBe(1);
  });

  it('retorna page 1 cuando recibe page "1.5"', () => {
    const parsed = parseAdminApplicantsSearchParams({ page: '1.5' });
    expect(parsed.page).toBe(1);
  });

  it('retorna page 1 cuando recibe page "Infinity"', () => {
    const parsed = parseAdminApplicantsSearchParams({ page: 'Infinity' });
    expect(parsed.page).toBe(1);
  });

  it('retorna page 1 cuando recibe string no numérico "abc"', () => {
    const parsed = parseAdminApplicantsSearchParams({ page: 'abc' });
    expect(parsed.page).toBe(1);
  });
});
