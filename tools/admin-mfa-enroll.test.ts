import { describe, expect, it, vi } from 'vitest';
import { enrollAdminMfa, qrSvgFromDataUri } from './admin-mfa-enroll.mjs';

/**
 * T-317: el primer factor TOTP del admin lo enrola el operador con una herramienta local. Estas pruebas
 * usan un cliente Supabase simulado; la corrida real contra staging es evidencia manual de la ficha.
 */

const PASSWORD = 'contraseña-de-prueba-9f3';
const CODE = '482913';
const QR = 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';

type Factor = { id: string; factor_type: string; status: 'verified' | 'unverified' };

function setup({
  role = 'admin',
  factors = [] as Factor[],
  verifyError = null as null | { message: string },
  level = 'aal2',
  code = CODE,
} = {}) {
  const calls: string[] = [];
  const auth = {
    signInWithPassword: vi.fn(async () => {
      calls.push('signIn');
      return { data: { user: { id: 'user-1' } }, error: null };
    }),
    signOut: vi.fn(async () => {
      calls.push('signOut');
      return { error: null };
    }),
    mfa: {
      listFactors: vi.fn(async () => ({
        data: { all: factors, totp: factors.filter((f) => f.status === 'verified') },
        error: null,
      })),
      unenroll: vi.fn(async ({ factorId }: { factorId: string }) => {
        calls.push(`unenroll:${factorId}`);
        return { data: { id: factorId }, error: null };
      }),
      enroll: vi.fn(async () => {
        calls.push('enroll');
        return {
          data: {
            id: 'factor-new',
            totp: { qr_code: QR, secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://x' },
          },
          error: null,
        };
      }),
      challengeAndVerify: vi.fn(async () => {
        calls.push('verify');
        return { data: verifyError ? null : {}, error: verifyError };
      }),
      getAuthenticatorAssuranceLevel: vi.fn(async () => ({
        data: { currentLevel: level, nextLevel: level },
        error: null,
      })),
    },
  };
  const client = {
    auth,
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: role ? { role } : null, error: null }),
        }),
      }),
    })),
  };
  const output: string[] = [];
  const written: string[] = [];
  const removed: string[] = [];
  const deps = {
    client,
    prompt: vi.fn(async (question: string) =>
      question.includes('Email') ? 'admin@cadeapp.test' : code
    ),
    promptSecret: vi.fn(async () => PASSWORD),
    print: (line: string) => {
      output.push(line);
    },
    writeQr: vi.fn(async (svg: string) => {
      written.push(svg);
      return '/tmp/cadeapp-mfa-qr.svg';
    }),
    removeFile: vi.fn(async (file: string) => {
      removed.push(file);
    }),
  };
  return { deps, calls, output, written, removed, auth };
}

describe('T-317: enrolamiento del primer factor TOTP del admin', () => {
  it('un perfil que no es admin no enrola y cierra sesión', async () => {
    const t = setup({ role: 'merchant' });
    const result = await enrollAdminMfa(t.deps);
    expect(result).toEqual({ ok: false, reason: 'NOT_ADMIN' });
    expect(t.auth.mfa.enroll).not.toHaveBeenCalled();
    expect(t.calls.at(-1)).toBe('signOut');
  });

  it('con un factor TOTP ya verificado no enrola otro', async () => {
    const t = setup({ factors: [{ id: 'f-ok', factor_type: 'totp', status: 'verified' }] });
    const result = await enrollAdminMfa(t.deps);
    expect(result).toEqual({ ok: false, reason: 'ALREADY_ENROLLED' });
    expect(t.auth.mfa.enroll).not.toHaveBeenCalled();
    expect(t.auth.mfa.unenroll).not.toHaveBeenCalled();
  });

  it('borra los factores TOTP no verificados de intentos previos antes de enrolar', async () => {
    const t = setup({
      factors: [
        { id: 'f-old-1', factor_type: 'totp', status: 'unverified' },
        { id: 'f-old-2', factor_type: 'totp', status: 'unverified' },
      ],
    });
    const result = await enrollAdminMfa(t.deps);
    expect(result).toEqual({ ok: true });
    expect(t.calls.indexOf('unenroll:f-old-1')).toBeGreaterThan(-1);
    expect(t.calls.indexOf('unenroll:f-old-2')).toBeGreaterThan(-1);
    expect(t.calls.indexOf('unenroll:f-old-2')).toBeLessThan(t.calls.indexOf('enroll'));
  });

  it('camino feliz: enrola, verifica el código, queda aal2, borra el QR y cierra sesión', async () => {
    const t = setup();
    const result = await enrollAdminMfa(t.deps);
    expect(result).toEqual({ ok: true });
    expect(t.auth.mfa.enroll).toHaveBeenCalledWith(expect.objectContaining({ factorType: 'totp' }));
    expect(t.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({
      factorId: 'factor-new',
      code: CODE,
    });
    expect(t.written).toEqual([QR]);
    expect(t.removed).toEqual(['/tmp/cadeapp-mfa-qr.svg']);
    expect(t.calls.at(-1)).toBe('signOut');
    expect(t.output.join('\n')).toContain('/tmp/cadeapp-mfa-qr.svg');
  });

  it('código inválido: error visible, sin aal2, QR borrado y sesión cerrada', async () => {
    const t = setup({ verifyError: { message: 'Invalid TOTP code entered' } });
    const result = await enrollAdminMfa(t.deps);
    expect(result).toEqual({ ok: false, reason: 'INVALID_CODE' });
    expect(t.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
    expect(t.removed).toEqual(['/tmp/cadeapp-mfa-qr.svg']);
    expect(t.calls.at(-1)).toBe('signOut');
  });

  it('un código que no son 6 dígitos no llega a Supabase', async () => {
    const t = setup({ code: '12ab' });
    const result = await enrollAdminMfa(t.deps);
    expect(result).toEqual({ ok: false, reason: 'INVALID_CODE' });
    expect(t.auth.mfa.challengeAndVerify).not.toHaveBeenCalled();
    expect(t.removed).toEqual(['/tmp/cadeapp-mfa-qr.svg']);
  });

  it('si después de verificar no hay aal2, falla', async () => {
    const t = setup({ level: 'aal1' });
    const result = await enrollAdminMfa(t.deps);
    expect(result).toEqual({ ok: false, reason: 'NOT_AAL2' });
  });

  it('la contraseña y el código nunca aparecen en la salida', async () => {
    for (const t of [setup(), setup({ verifyError: { message: 'Invalid TOTP code entered' } })]) {
      await enrollAdminMfa(t.deps);
      const all = t.output.join('\n');
      expect(all).not.toContain(PASSWORD);
      expect(all).not.toContain(CODE);
    }
  });

  it('la contraseña se pide sin eco', async () => {
    const t = setup();
    await enrollAdminMfa(t.deps);
    expect(t.deps.promptSecret).toHaveBeenCalledTimes(1);
    expect(t.deps.prompt).not.toHaveBeenCalledWith(expect.stringMatching(/contraseña/i));
  });
});

describe('T-317: QR de mfa.enroll()', () => {
  it('extrae el SVG de un data URI utf-8', () => {
    expect(qrSvgFromDataUri(QR)).toBe('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
  });

  it('extrae el SVG de un data URI base64', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    expect(qrSvgFromDataUri(uri)).toBe(svg);
  });

  it('acepta un SVG crudo', () => {
    expect(qrSvgFromDataUri('<svg></svg>')).toBe('<svg></svg>');
  });
});
