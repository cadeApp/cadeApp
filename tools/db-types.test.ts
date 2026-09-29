import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeGeneratedTypes as normalize } from './db-types.mjs';

/**
 * CC-013: `db-tests` (CI) genera los tipos con `--local` y `migrate-staging` con `--project-id`. El segundo usa
 * la plantilla del servidor de Supabase, que agrega `__InternalSupabase` y paréntesis en los helpers. Sin
 * normalizar, ningún archivo commiteado satisface a los dos checks (run `migrate` 36535421202).
 */
const REMOTE_TEMPLATE = `export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      zones: {
        Row: {
          id: number
          name: string
        }
      }
    }
  }
}

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions
`;

const LOCAL_TEMPLATE = `export type Database = {
  public: {
    Tables: {
      zones: {
        Row: {
          id: number
          name: string
        }
      }
    }
  }
}

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions
`;

describe('CC-013: db:types normaliza la plantilla del generador', () => {
  it('la salida con plantilla remota queda igual a la salida local', () => {
    expect(normalize(REMOTE_TEMPLATE)).toBe(LOCAL_TEMPLATE);
  });

  it('la salida local no cambia (idempotente)', () => {
    expect(normalize(LOCAL_TEMPLATE)).toBe(LOCAL_TEMPLATE);
  });

  it('una diferencia real de esquema sigue siendo visible después de normalizar', () => {
    const remoteWithNewColumn = REMOTE_TEMPLATE.replace(
      '          name: string\n',
      '          name: string\n          active: boolean\n'
    );
    expect(normalize(remoteWithNewColumn)).not.toBe(LOCAL_TEMPLATE);
    expect(normalize(remoteWithNewColumn)).toContain('active: boolean');
  });

  it('el database.types.ts commiteado ya está normalizado', () => {
    const committed = fs
      .readFileSync(path.resolve('src/types/database.types.ts'), 'utf-8')
      .replace(/\r\n/g, '\n');
    expect(normalize(committed)).toBe(committed);
  });
});
