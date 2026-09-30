import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OperatorError,
  createEnrollClient,
  enrollAdminMfa,
  qrSvgFromDataUri,
  readSecret,
} from './admin-mfa-enroll.mjs';

/**
 * T-317: el primer factor TOTP del admin lo enrola el operador con una herramienta local contra
 * `cadeapp-staging`. Estas pruebas usan un cliente Supabase falso y nunca se conectan a Supabase real; la
 * corrida real es evidencia manual de la ficha.
 */

// Sentinelas distintas para cada dato que nunca puede aparecer en la salida.
const PASSWORD = 'SENTINEL-PASSWORD-7a1c';
const CODE = '913572';
const ACCESS_TOKEN = 'SENTINEL-ACCESS-TOKEN-4d2e';
const REFRESH_TOKEN = 'SENTINEL-REFRESH-TOKEN-8b3f';
const TOTP_SECRET = 'SENTINELTOTPSECRET6K9Q';
const OTPAUTH_URI = 'otpauth://totp/cadeApp:SENTINEL?secret=SENTINELTOTPSECRET6K9Q';
const SENTINELS = [PASSWORD, CODE, ACCESS_TOKEN, REFRESH_TOKEN, TOTP_SECRET, OTPAUTH_URI];

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
const QR_UTF8 = `data:image/svg+xml;utf-8,${encodeURIComponent(SVG)}`;
const QR_PATH = '/tmp/cadeapp-mfa-test/qr.svg';

type Factor = { id: string; factor_type: string; status: 'verified' | 'unverified' };
type ApiError = { message: string } | null;

function setup({
  role = 'admin',
  factors = [] as Factor[],
  factorsError = null as ApiError,
  unenrollError = null as ApiError,
  qrCode = QR_UTF8,
  verifyError = null as ApiError,
  verifyThrows = false,
  level = 'aal2',
  code = CODE,
} = {}) {
  const calls: string[] = [];
  const auth = {
    signInWithPassword: vi.fn(async () => {
      calls.push('signIn');
      return {
        data: {
          user: { id: 'user-1' },
          session: { access_token: ACCESS_TOKEN, refresh_token: REFRESH_TOKEN },
        },
        error: null,
      };
    }),
    signOut: vi.fn(async (options: { scope: 'local' }) => {
      calls.push(`signOut:${JSON.stringify(options)}`);
      return { error: null };
    }),
    mfa: {
      // Con error también devuelve datos con forma válida: así el test detecta que se ignore el error, y no solo
      // que falten datos.
      listFactors: vi.fn(async () => ({
        data: { all: factors, totp: factors.filter((f) => f.status === 'verified') },
        error: factorsError,
      })),
      unenroll: vi.fn(async ({ factorId }: { factorId: string }) => {
        calls.push(`unenroll:${factorId}`);
        return { error: unenrollError };
      }),
      enroll: vi.fn(async (_params: { factorType: 'totp' }) => {
        calls.push('enroll');
        return {
          data: {
            id: 'factor-new',
            totp: { qr_code: qrCode, secret: TOTP_SECRET, uri: OTPAUTH_URI },
          },
          error: null,
        };
      }),
      challengeAndVerify: vi.fn(async (_params: { factorId: string; code: string }) => {
        calls.push('verify');
        if (verifyThrows) throw new Error('fetch failed: connection reset');
        return { error: verifyError };
      }),
      getAuthenticatorAssuranceLevel: vi.fn(async () => ({
        data: { currentLevel: level },
      })),
    },
  };
  const client = {
    auth,
    from: vi.fn((_table: 'profiles') => ({
      select: (_columns: 'role') => ({
        eq: (_column: 'id', _value: string) => ({
          maybeSingle: async () => ({ data: role ? { role } : null }),
        }),
      }),
    })),
  };
  const output: string[] = [];
  const deps = {
    client,
    prompt: vi.fn(async (question: string) =>
      question.includes('Email') ? 'admin@cadeapp.test' : code
    ),
    promptSecret: vi.fn(async (_question: string) => PASSWORD),
    print: (line: string) => {
      output.push(line);
    },
    writeQr: vi.fn(async (_svgXml: string) => QR_PATH),
    removeFile: vi.fn(async (_file: string) => {}),
  };
  return { deps, calls, output, auth };
}

const LOCAL_SIGN_OUT = `signOut:${JSON.stringify({ scope: 'local' })}`;

describe('T-317: enrolamiento del primer factor TOTP del admin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rol no admin → no llama mfa.enroll y cierra la sesión local', async () => {
    const t = setup({ role: 'merchant' });
    expect(await enrollAdminMfa(t.deps)).toEqual({ ok: false, reason: 'NOT_ADMIN' });
    expect(t.auth.mfa.enroll).not.toHaveBeenCalled();
    expect(t.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(t.calls.at(-1)).toBe(LOCAL_SIGN_OUT);
  });

  it('TOTP verificado existente → no llama mfa.enroll', async () => {
    const t = setup({ factors: [{ id: 'f-ok', factor_type: 'totp', status: 'verified' }] });
    expect(await enrollAdminMfa(t.deps)).toEqual({ ok: false, reason: 'ALREADY_ENROLLED' });
    expect(t.auth.mfa.enroll).not.toHaveBeenCalled();
    expect(t.auth.mfa.unenroll).not.toHaveBeenCalled();
  });

  it('TOTP unverified previo → llama unenroll antes de enroll', async () => {
    const t = setup({
      factors: [
        { id: 'f-old-1', factor_type: 'totp', status: 'unverified' },
        { id: 'f-phone', factor_type: 'phone', status: 'unverified' },
      ],
    });
    expect(await enrollAdminMfa(t.deps)).toEqual({ ok: true });
    expect(t.auth.mfa.unenroll).toHaveBeenCalledTimes(1);
    expect(t.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'f-old-1' });
    expect(t.calls.indexOf('unenroll:f-old-1')).toBeLessThan(t.calls.indexOf('enroll'));
  });

  it('error de listFactors → falla cerrado sin llamar mfa.enroll ni mostrar el error remoto', async () => {
    const t = setup({ factorsError: { message: 'REMOTE-LIST-ERROR' } });
    expect(await enrollAdminMfa(t.deps)).toEqual({ ok: false, reason: 'FACTORS_UNAVAILABLE' });
    expect(t.auth.mfa.enroll).not.toHaveBeenCalled();
    expect(t.output.join('\n')).not.toContain('REMOTE-LIST-ERROR');
    expect(t.calls.at(-1)).toBe(LOCAL_SIGN_OUT);
  });

  it('error de unenroll → aborta sin llamar mfa.enroll ni mostrar el error remoto', async () => {
    const t = setup({
      factors: [{ id: 'f-old-1', factor_type: 'totp', status: 'unverified' }],
      unenrollError: { message: 'REMOTE-UNENROLL-ERROR' },
    });
    expect(await enrollAdminMfa(t.deps)).toEqual({ ok: false, reason: 'CLEANUP_FAILED' });
    expect(t.auth.mfa.enroll).not.toHaveBeenCalled();
    expect(t.output.join('\n')).not.toContain('REMOTE-UNENROLL-ERROR');
  });

  it('QR data URL → escribe un archivo cuyo contenido empieza con <svg y no con data:image/', async () => {
    const t = setup();
    await enrollAdminMfa(t.deps);
    expect(t.deps.writeQr).toHaveBeenCalledTimes(1);
    const [written] = t.deps.writeQr.mock.calls[0] ?? [''];
    expect(written.startsWith('<svg')).toBe(true);
    expect(written.startsWith('data:image/')).toBe(false);
    expect(written).toBe(SVG);
  });

  it.each([
    ['SVG crudo', SVG],
    ['data URL base64', `data:image/svg+xml;base64,${Buffer.from(SVG).toString('base64')}`],
  ])('QR como %s → falla cerrado sin escribir archivo', async (_label, qrCode) => {
    const t = setup({ qrCode });
    expect(await enrollAdminMfa(t.deps)).toEqual({ ok: false, reason: 'QR_FORMAT' });
    expect(t.deps.writeQr).not.toHaveBeenCalled();
    expect(t.auth.mfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  it('camino feliz → challengeAndVerify, aal2, QR borrado y signOut({ scope: "local" })', async () => {
    const t = setup();
    expect(await enrollAdminMfa(t.deps)).toEqual({ ok: true });
    expect(t.auth.mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp' });
    expect(t.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({
      factorId: 'factor-new',
      code: CODE,
    });
    expect(t.auth.mfa.getAuthenticatorAssuranceLevel).toHaveBeenCalled();
    expect(t.deps.removeFile).toHaveBeenCalledWith(QR_PATH);
    expect(t.auth.signOut).toHaveBeenCalledTimes(1);
    expect(t.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(t.calls.at(-1)).toBe(LOCAL_SIGN_OUT);
    expect(t.output.join('\n')).toContain(QR_PATH);
  });

  it('código inválido → error visible, sin aal2 y QR eliminado', async () => {
    const t = setup({ verifyError: { message: 'Invalid TOTP code entered' } });
    expect(await enrollAdminMfa(t.deps)).toEqual({ ok: false, reason: 'INVALID_CODE' });
    expect(t.output.join('\n')).toMatch(/código no es válido/i);
    expect(t.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
    expect(t.deps.removeFile).toHaveBeenCalledWith(QR_PATH);
    expect(t.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('código que no son 6 dígitos → no llega a Supabase y el QR se elimina', async () => {
    const t = setup({ code: '12ab' });
    expect(await enrollAdminMfa(t.deps)).toEqual({ ok: false, reason: 'INVALID_CODE' });
    expect(t.auth.mfa.challengeAndVerify).not.toHaveBeenCalled();
    expect(t.deps.removeFile).toHaveBeenCalledWith(QR_PATH);
  });

  it('sin aal2 después de verificar → falla', async () => {
    const t = setup({ level: 'aal1' });
    expect(await enrollAdminMfa(t.deps)).toEqual({ ok: false, reason: 'NOT_AAL2' });
  });

  it('excepción después de crear el QR → la promesa falla, el QR se borra y la sesión local se cierra', async () => {
    const t = setup({ verifyThrows: true });
    await expect(enrollAdminMfa(t.deps)).rejects.toThrow();
    expect(t.deps.writeQr).toHaveBeenCalledTimes(1);
    expect(t.deps.removeFile).toHaveBeenCalledWith(QR_PATH);
    expect(t.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('si falla el borrado del QR, igual intenta cerrar la sesión local y después rechaza', async () => {
    const t = setup();
    t.deps.removeFile.mockRejectedValueOnce(new Error('remove failed'));
    await expect(enrollAdminMfa(t.deps)).rejects.toThrow('remove failed');
    expect(t.deps.removeFile).toHaveBeenCalledWith(QR_PATH);
    expect(t.auth.signOut).toHaveBeenCalledTimes(1);
    expect(t.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('QR data URL utf-8 que no es SVG → falla cerrado sin escribir archivo ni verificar', async () => {
    const t = setup({ qrCode: 'data:image/svg+xml;utf-8,not-svg' });
    expect(await enrollAdminMfa(t.deps)).toEqual({ ok: false, reason: 'QR_FORMAT' });
    expect(t.deps.writeQr).not.toHaveBeenCalled();
    expect(t.auth.mfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  it('la salida nunca contiene contraseña, código, tokens, secreto TOTP ni otpauth://', async () => {
    const logs: string[] = [];
    const capture = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    };
    vi.spyOn(console, 'log').mockImplementation(capture);
    vi.spyOn(console, 'error').mockImplementation(capture);
    vi.spyOn(console, 'warn').mockImplementation(capture);
    const scenarios = [
      setup(),
      setup({ verifyError: { message: 'Invalid TOTP code entered' } }),
      setup({ role: 'merchant' }),
      setup({ level: 'aal1' }),
    ];
    for (const t of scenarios) {
      await enrollAdminMfa(t.deps);
      const all = [...t.output, ...logs].join('\n');
      for (const sentinel of SENTINELS) {
        expect(all).not.toContain(sentinel);
      }
      expect(all).not.toContain('otpauth://');
    }
  });

  it('la contraseña se pide con la entrada oculta, nunca con la normal', async () => {
    const t = setup();
    await enrollAdminMfa(t.deps);
    expect(t.deps.promptSecret).toHaveBeenCalledTimes(1);
    expect(t.deps.prompt).not.toHaveBeenCalledWith(expect.stringMatching(/contraseña/i));
  });
});

describe('T-317: formato del QR', () => {
  it('data URL utf-8 válida → XML del SVG', () => {
    expect(qrSvgFromDataUri(QR_UTF8)).toBe(SVG);
  });

  it('SVG crudo → error', () => {
    expect(() => qrSvgFromDataUri(SVG)).toThrow();
  });

  it('data URL base64 → error', () => {
    expect(() =>
      qrSvgFromDataUri(`data:image/svg+xml;base64,${Buffer.from(SVG).toString('base64')}`)
    ).toThrow();
  });

  it('data URL utf-8 cuyo cuerpo no es SVG → error', () => {
    expect(() => qrSvgFromDataUri('data:image/svg+xml;utf-8,not-svg')).toThrow('QR_FORMAT');
  });
});

describe('T-317: cliente Supabase', () => {
  it('se construye sin persistir, sin refrescar y sin detectar sesión en la URL', () => {
    const create = vi.fn(() => ({}));
    createEnrollClient('https://proyecto.supabase.co', 'anon-publica', create);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith('https://proyecto.supabase.co', 'anon-publica', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });
});

class FakeTty extends EventEmitter {
  isTTY: boolean;
  isRaw: boolean;
  rawHistory: boolean[] = [];
  setRawMode?: (mode: boolean) => FakeTty;
  constructor({ isTTY = true, isRaw = false, withRawMode = true } = {}) {
    super();
    this.isTTY = isTTY;
    this.isRaw = isRaw;
    if (withRawMode) {
      this.setRawMode = (mode: boolean) => {
        this.isRaw = mode;
        this.rawHistory.push(mode);
        return this;
      };
    }
  }
  resume() {
    return this;
  }
  pause() {
    return this;
  }
}

function fakeOutput() {
  const written: string[] = [];
  return { written, output: { write: (text: string) => written.push(text) } };
}

describe('T-317: entrada oculta de la contraseña', () => {
  it('sin TTY interactiva → rechaza antes de leer, sin escuchar la entrada', async () => {
    const input = new FakeTty({ isTTY: false });
    const onSpy = vi.spyOn(input, 'on');
    const { output } = fakeOutput();
    await expect(readSecret({ input, output, question: 'Contraseña: ' })).rejects.toThrow(
      /terminal interactiva/
    );
    expect(onSpy).not.toHaveBeenCalled();
    expect(input.rawHistory).toEqual([]);
  });

  it('sin setRawMode → rechaza antes de leer', async () => {
    const input = new FakeTty({ withRawMode: false });
    const onSpy = vi.spyOn(input, 'on');
    const { output } = fakeOutput();
    await expect(readSecret({ input, output, question: 'Contraseña: ' })).rejects.toThrow(
      /terminal interactiva/
    );
    expect(onSpy).not.toHaveBeenCalled();
  });

  it('lee sin eco, maneja Backspace y restaura el raw mode previo al terminar', async () => {
    const input = new FakeTty({ isRaw: false });
    const { written, output } = fakeOutput();
    const pending = readSecret({ input, output, question: 'Contraseña: ' });
    expect(input.isRaw).toBe(true);
    input.emit('data', Buffer.from(`${PASSWORD}x`));
    input.emit('data', Buffer.from('\u007f'));
    input.emit('data', Buffer.from('\r'));
    await expect(pending).resolves.toBe(PASSWORD);
    expect(written.join('')).not.toContain(PASSWORD);
    expect(input.isRaw).toBe(false);
    expect(input.listenerCount('data')).toBe(0);
  });

  it('Ctrl+C → rechaza y también restaura el raw mode y los listeners', async () => {
    const input = new FakeTty({ isRaw: false });
    const { written, output } = fakeOutput();
    const pending = readSecret({ input, output, question: 'Contraseña: ' });
    input.emit('data', Buffer.from('parcial'));
    input.emit('data', Buffer.from('\u0003'));
    await expect(pending).rejects.toThrow();
    expect(written.join('')).not.toContain('parcial');
    expect(input.isRaw).toBe(false);
    expect(input.listenerCount('data')).toBe(0);
  });

  function expectRestored(input: FakeTty) {
    expect(input.isRaw).toBe(false);
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
    expect(input.listenerCount('end')).toBe(0);
  }

  it('error de la entrada → rechaza con un mensaje propio y restaura raw mode y listeners', async () => {
    const input = new FakeTty({ isRaw: false });
    const { written, output } = fakeOutput();
    const pending = readSecret({ input, output, question: 'Contraseña: ' });
    input.emit('data', Buffer.from('parcial'));
    input.emit('error', new Error('REMOTE-STDIN-DETAIL'));
    const rejection = await pending.then(
      () => null,
      (error: unknown) => error
    );
    expect(rejection).toBeInstanceOf(OperatorError);
    expect(String((rejection as Error).message)).not.toContain('REMOTE-STDIN-DETAIL');
    expect(written.join('')).not.toContain('parcial');
    expectRestored(input);
  });

  it('fin de la entrada antes de Enter → rechaza con un mensaje propio y restaura raw mode y listeners', async () => {
    const input = new FakeTty({ isRaw: false });
    const { output } = fakeOutput();
    const pending = readSecret({ input, output, question: 'Contraseña: ' });
    input.emit('data', Buffer.from('parcial'));
    input.emit('end');
    const rejection = await pending.then(
      () => null,
      (error: unknown) => error
    );
    expect(rejection).toBeInstanceOf(OperatorError);
    expectRestored(input);
  });

  it('respeta un raw mode que ya estaba activo', async () => {
    const input = new FakeTty({ isRaw: true });
    const { output } = fakeOutput();
    const pending = readSecret({ input, output, question: 'Contraseña: ' });
    input.emit('data', Buffer.from('abc\n'));
    await expect(pending).resolves.toBe('abc');
    expect(input.isRaw).toBe(true);
  });
});

describe('T-317: lanzador', () => {
  it('package.json corre la herramienta sin cargar archivos .env', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['admin:mfa-enroll']).toBe('node tools/admin-mfa-enroll.mjs');
  });
});
