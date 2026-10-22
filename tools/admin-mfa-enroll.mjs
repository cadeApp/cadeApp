import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

/**
 * T-317: enrola el primer factor TOTP de una cuenta admin de `cadeapp-staging`. Lo corre el operador en su
 * terminal, una sola vez por cuenta (runbook `docs/runbooks/admin-bootstrap.md`). No usa la service role: entra
 * como el propio admin con la URL pública y la anon key. Nunca imprime ni guarda la contraseña, el código, los
 * tokens de sesión ni el secreto TOTP; solo muestra la ruta de un QR temporal.
 */

/** Error con un mensaje propio de la herramienta, seguro de mostrar al operador. */
export class OperatorError extends Error {}

export const QR_DATA_URL_PREFIX = 'data:image/svg+xml;utf-8,';

/**
 * Documento SVG: espacios, declaración XML y comentarios opcionales antes de la raíz `<svg …>`, y el
 * documento termina en `</svg>`. Es la forma que genera Supabase Auth (SVGo).
 */
const SVG_DOCUMENT =
  /^\s*(?:<\?xml\b[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>][\s\S]*<\/svg>\s*$/;

/**
 * `mfa.enroll()` devuelve el QR como data URL utf-8 de un SVG: supabase-js concatena el SVG crudo al
 * prefijo, sin codificarlo. Cualquier otro formato falla cerrado.
 * @param {string} qrCode
 * @returns {string} el XML del SVG tal como vino después del prefijo
 */
export function qrSvgFromDataUri(qrCode) {
  if (typeof qrCode !== 'string' || !qrCode.startsWith(QR_DATA_URL_PREFIX)) {
    throw new Error('QR_FORMAT');
  }
  const svgXml = qrCode.slice(QR_DATA_URL_PREFIX.length);
  if (!SVG_DOCUMENT.test(svgXml)) {
    throw new Error('QR_FORMAT');
  }
  return svgXml;
}

/**
 * Cliente sin sesión persistente ni refresco: la sesión vive solo en memoria mientras corre la herramienta.
 * @template T
 * @param {string} url
 * @param {string} anonKey
 * @param {(url: string, key: string, options: { auth: { persistSession: boolean, autoRefreshToken: boolean, detectSessionInUrl: boolean } }) => T} create
 * @returns {T}
 */
export function createEnrollClient(url, anonKey, create) {
  return create(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Lee un secreto de una TTY sin eco. Sin TTY interactiva falla cerrado, antes de consumir entrada.
 * @param {{
 *   input: {
 *     isTTY?: boolean,
 *     isRaw?: boolean,
 *     setRawMode?: (mode: boolean) => unknown,
 *     on(event: 'data', listener: (chunk: Buffer | string) => void): unknown,
 *     on(event: 'error' | 'end', listener: () => void): unknown,
 *     removeListener(event: 'data', listener: (chunk: Buffer | string) => void): unknown,
 *     removeListener(event: 'error' | 'end', listener: () => void): unknown,
 *     resume?: () => unknown,
 *     pause?: () => unknown,
 *   },
 *   output: { write(text: string): unknown },
 *   question: string,
 * }} io
 * @returns {Promise<string>}
 */
export async function readSecret({ input, output, question }) {
  const setRawMode = input.setRawMode;
  if (input.isTTY !== true || typeof setRawMode !== 'function') {
    throw new OperatorError('Se necesita una terminal interactiva para pedir la contraseña.');
  }
  const wasRaw = input.isRaw === true;
  /** @type {((chunk: Buffer | string) => void) | null} */
  let onData = null;
  /** @type {(() => void) | null} */
  let onError = null;
  /** @type {(() => void) | null} */
  let onEnd = null;
  output.write(question);
  try {
    setRawMode.call(input, true);
    input.resume?.();
    return await new Promise((resolve, reject) => {
      let value = '';
      // El detalle del error de la entrada no se propaga: el mensaje es siempre propio.
      onError = () => reject(new OperatorError('No se pudo leer la entrada de la terminal.'));
      onEnd = () =>
        reject(new OperatorError('La entrada terminó antes de completar la contraseña.'));
      onData = (chunk) => {
        for (const char of String(chunk)) {
          if (char === '\r' || char === '\n') {
            resolve(value);
            return;
          }
          if (char === '\u0003') {
            reject(new OperatorError('Cancelado.'));
            return;
          }
          if (char === '\u007f' || char === '\b') {
            value = value.slice(0, -1);
            continue;
          }
          value += char;
        }
      };
      input.on('data', onData);
      input.on('error', onError);
      input.on('end', onEnd);
    });
  } finally {
    if (onData) input.removeListener('data', onData);
    if (onError) input.removeListener('error', onError);
    if (onEnd) input.removeListener('end', onEnd);
    setRawMode.call(input, wasRaw);
    input.pause?.();
    output.write('\n');
  }
}

/**
 * @typedef {'SIGN_IN_FAILED' | 'NOT_ADMIN' | 'FACTORS_UNAVAILABLE' | 'ALREADY_ENROLLED' | 'CLEANUP_FAILED' | 'ENROLL_FAILED' | 'QR_FORMAT' | 'INVALID_CODE' | 'NOT_AAL2'} EnrollFailure
 * @typedef {{ ok: true } | { ok: false, reason: EnrollFailure }} EnrollResult
 * @typedef {{ message: string } | null} ApiError
 * @typedef {{ id: string, factor_type: string, status: string }} Factor
 * @typedef {{
 *   auth: {
 *     signInWithPassword(credentials: { email: string, password: string }): Promise<{ data: { user: { id: string } | null } | null, error: ApiError }>,
 *     signOut(options: { scope: 'local' }): Promise<unknown>,
 *     mfa: {
 *       listFactors(): Promise<{ data: { all: Factor[], totp: Factor[] } | null, error: ApiError }>,
 *       unenroll(params: { factorId: string }): Promise<{ error: ApiError }>,
 *       enroll(params: { factorType: 'totp' }): Promise<{ data: { id: string, totp: { qr_code: string } } | null, error: ApiError }>,
 *       challengeAndVerify(params: { factorId: string, code: string }): Promise<{ error: ApiError }>,
 *       getAuthenticatorAssuranceLevel(): Promise<{ data: { currentLevel: string | null } | null }>,
 *     },
 *   },
 *   from(table: 'profiles'): { select(columns: 'role'): { eq(column: 'id', value: string): { maybeSingle(): Promise<{ data: { role: string } | null }> } } },
 * }} EnrollClient
 */

/**
 * @param {{
 *   client: EnrollClient,
 *   prompt: (question: string) => Promise<string>,
 *   promptSecret: (question: string) => Promise<string>,
 *   print: (line: string) => void,
 *   writeQr: (svgXml: string) => Promise<string>,
 *   removeFile: (file: string) => Promise<void>,
 * }} deps
 * @returns {Promise<EnrollResult>}
 */
export async function enrollAdminMfa({ client, prompt, promptSecret, print, writeQr, removeFile }) {
  const email = (await prompt('Email del admin: ')).trim();
  const password = await promptSecret('Contraseña (no se muestra): ');

  const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signIn?.user) {
    print('No se pudo iniciar sesión con esas credenciales.');
    return { ok: false, reason: 'SIGN_IN_FAILED' };
  }

  /** @type {string | null} */
  let qrFile = null;
  try {
    const { data: profile } = await client
      .from('profiles')
      .select('role')
      .eq('id', signIn.user.id)
      .maybeSingle();
    if (profile?.role !== 'admin') {
      print('La cuenta no tiene rol admin. Promovela primero (runbook, paso 2).');
      return { ok: false, reason: 'NOT_ADMIN' };
    }

    const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
    if (factorsError || !Array.isArray(factors?.all) || !Array.isArray(factors?.totp)) {
      print('No se pudieron leer los factores MFA de la cuenta. No se enroló nada.');
      return { ok: false, reason: 'FACTORS_UNAVAILABLE' };
    }
    if (factors.totp.length > 0) {
      print('La cuenta ya tiene un factor TOTP verificado. No se enrola otro.');
      return { ok: false, reason: 'ALREADY_ENROLLED' };
    }
    const pending = factors.all.filter(
      (factor) => factor.factor_type === 'totp' && factor.status === 'unverified'
    );
    for (const factor of pending) {
      const { error: unenrollError } = await client.auth.mfa.unenroll({ factorId: factor.id });
      if (unenrollError) {
        print(
          'No se pudo borrar un factor TOTP sin verificar de un intento anterior. No se enroló nada.'
        );
        return { ok: false, reason: 'CLEANUP_FAILED' };
      }
    }

    const { data: enrolled, error: enrollError } = await client.auth.mfa.enroll({
      factorType: 'totp',
    });
    if (enrollError || !enrolled?.totp) {
      print('Supabase no pudo crear el factor TOTP.');
      return { ok: false, reason: 'ENROLL_FAILED' };
    }

    /** @type {string} */
    let svgXml;
    try {
      svgXml = qrSvgFromDataUri(enrolled.totp.qr_code);
    } catch {
      print('Supabase devolvió el QR en un formato inesperado. No se escribió ningún archivo.');
      return { ok: false, reason: 'QR_FORMAT' };
    }
    qrFile = await writeQr(svgXml);
    print(`Abrí este archivo y escanealo con tu app de autenticación: ${qrFile}`);

    const code = (await prompt('Código de 6 dígitos de la app: ')).trim();
    if (!/^\d{6}$/.test(code)) {
      print('El código tiene que ser de 6 dígitos.');
      return { ok: false, reason: 'INVALID_CODE' };
    }
    const { error: verifyError } = await client.auth.mfa.challengeAndVerify({
      factorId: enrolled.id,
      code,
    });
    if (verifyError) {
      print('El código no es válido. Volvé a correr la herramienta.');
      return { ok: false, reason: 'INVALID_CODE' };
    }

    const { data: assurance } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel !== 'aal2') {
      print('El factor quedó verificado pero la sesión no llegó a aal2.');
      return { ok: false, reason: 'NOT_AAL2' };
    }

    print('Listo: MFA activo. Entrá por /login y después /login/mfa con el código de la app.');
    return { ok: true };
  } finally {
    // El cierre de sesión no depende del borrado: si borrar falla, igual se intenta cerrar la sesión y después
    // se propaga el error del borrado.
    try {
      if (qrFile) await removeFile(qrFile);
    } finally {
      await client.auth.signOut({ scope: 'local' });
    }
  }
}

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/** @param {string} question */
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const env = envSchema.safeParse(process.env);
  if (!env.success) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno.');
    process.exitCode = 1;
    return;
  }
  console.log(`Proyecto: ${new URL(env.data.NEXT_PUBLIC_SUPABASE_URL).host}`);
  const client = createEnrollClient(
    env.data.NEXT_PUBLIC_SUPABASE_URL,
    env.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    createClient
  );
  const dir = await mkdtemp(path.join(tmpdir(), 'cadeapp-mfa-'));
  try {
    const result = await enrollAdminMfa({
      client,
      prompt,
      promptSecret: (question) =>
        readSecret({ input: process.stdin, output: process.stdout, question }),
      print: (line) => console.log(line),
      writeQr: async (svgXml) => {
        const file = path.join(dir, 'qr.svg');
        await writeFile(file, svgXml, { mode: 0o600 });
        return file;
      },
      removeFile: async (file) => {
        await rm(file, { force: true });
      },
    });
    if (!result.ok) process.exitCode = 1;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    // Los errores de Supabase o de la red no se imprimen: pueden traer datos del servidor.
    console.error(
      error instanceof OperatorError
        ? error.message
        : 'Error inesperado. No se completó el enrolamiento.'
    );
    process.exitCode = 1;
  });
}
