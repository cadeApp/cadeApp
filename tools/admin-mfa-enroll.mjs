import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

/**
 * T-317: enrola el primer factor TOTP de una cuenta admin. Lo corre el operador en su terminal, una sola vez
 * por cuenta (runbook `docs/runbooks/admin-bootstrap.md`). No usa la service role: entra como el propio admin
 * con la anon key. Nunca imprime ni guarda la contraseña ni el código.
 */

/**
 * `mfa.enroll()` devuelve el QR como data URI de SVG (utf-8 o base64); también se acepta el SVG crudo.
 * @param {string} qrCode
 */
export function qrSvgFromDataUri(qrCode) {
  if (!qrCode.startsWith('data:')) return qrCode;
  const comma = qrCode.indexOf(',');
  const header = qrCode.slice(0, comma);
  const body = qrCode.slice(comma + 1);
  return header.endsWith(';base64')
    ? Buffer.from(body, 'base64').toString('utf8')
    : decodeURIComponent(body);
}

/**
 * @typedef {'SIGN_IN_FAILED' | 'NOT_ADMIN' | 'ALREADY_ENROLLED' | 'ENROLL_FAILED' | 'INVALID_CODE' | 'NOT_AAL2'} EnrollFailure
 * @typedef {{ ok: true } | { ok: false, reason: EnrollFailure }} EnrollResult
 * @typedef {{ message: string } | null} ApiError
 * @typedef {{ id: string, factor_type: string, status: string }} Factor
 * @typedef {{
 *   auth: {
 *     signInWithPassword(credentials: { email: string, password: string }): Promise<{ data: { user: { id: string } | null } | null, error: ApiError }>,
 *     signOut(): Promise<unknown>,
 *     mfa: {
 *       listFactors(): Promise<{ data: { all: Factor[], totp: Factor[] } | null }>,
 *       unenroll(params: { factorId: string }): Promise<unknown>,
 *       enroll(params: { factorType: 'totp', friendlyName: string }): Promise<{ data: { id: string, totp: { qr_code: string, secret: string } } | null, error: ApiError }>,
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
 *   writeQr: (qrCode: string) => Promise<string>,
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

    const { data: factors } = await client.auth.mfa.listFactors();
    if ((factors?.totp ?? []).length > 0) {
      print('La cuenta ya tiene un factor TOTP verificado. No se enrola otro.');
      return { ok: false, reason: 'ALREADY_ENROLLED' };
    }
    const pending = (factors?.all ?? []).filter(
      (/** @type {{ factor_type: string, status: string }} */ factor) =>
        factor.factor_type === 'totp' && factor.status === 'unverified'
    );
    for (const factor of pending) {
      await client.auth.mfa.unenroll({ factorId: factor.id });
    }

    const { data: enrolled, error: enrollError } = await client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'cadeApp admin',
    });
    if (enrollError || !enrolled?.totp) {
      print('Supabase no pudo crear el factor TOTP.');
      return { ok: false, reason: 'ENROLL_FAILED' };
    }

    qrFile = await writeQr(enrolled.totp.qr_code);
    print(`Abrí este archivo y escanealo con tu app de autenticación: ${qrFile}`);
    print(`O cargá la clave a mano: ${enrolled.totp.secret}`);

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
    if (qrFile) await removeFile(qrFile);
    await client.auth.signOut();
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

/** @param {string} question */
function promptSecret(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  process.stdout.write(question);
  // Silencia el eco de lo que se tipea; readline no expone una opción pública para esto.
  Object.assign(rl, { _writeToOutput: () => {} });
  return new Promise((resolve) => {
    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const env = envSchema.safeParse(process.env);
  if (!env.success) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    process.exitCode = 1;
    return;
  }
  console.log(`Proyecto: ${new URL(env.data.NEXT_PUBLIC_SUPABASE_URL).host}`);
  const client = createClient(
    env.data.NEXT_PUBLIC_SUPABASE_URL,
    env.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const dir = await mkdtemp(path.join(tmpdir(), 'cadeapp-mfa-'));
  const result = await enrollAdminMfa({
    client,
    prompt,
    promptSecret,
    print: (line) => console.log(line),
    writeQr: async (qrCode) => {
      const file = path.join(dir, 'qr.svg');
      await writeFile(file, qrSvgFromDataUri(qrCode), { mode: 0o600 });
      return file;
    },
    removeFile: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  });
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Error inesperado.');
    process.exitCode = 1;
  });
}
