# PR #142 — T-318 · Mensajes claros y seguros cuando falla el registro

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/142 |
| **Tarea** | T-318 · Issue #141 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-318-register-errors` → `develop` |
| **Head R2** | `9d34f42841ec9ed9875324e8d81f36dd7234315a` |
| **Head R3** | `6947d68ffca5c5510aa0e943355fa1ff33e8bc23` |
| **Head R4 revisado** | `d9d7b063e346443155b3208d271ddf3f9d225aef` |
| **Base R4** | `develop` @ `158f83b2b1bf6211a2bf8e53ae7cd90130edc445` |
| **Estado** | Ronda 4 · SIN BLOQUEANTES |

## Contexto

#142 reemplaza #140 después de las decisiones de Lautaro073:
- 1-A: separar el bug de T-009 y crear T-318.
- 2-A: preservar la protección anti-enumeración de Supabase.

La ficha oficial entró por PR #143 antes del cierre de la implementación.

## Estado por hallazgo

- **PR142-H01** · alto · arreglado-verificado · alta nueva con sesión se neutraliza con `signOut({ scope: 'local' })`; fallo de signOut corta con INTERNAL_ERROR sin activar consentimientos.
- **PR142-H02** · alto · arreglado-verificado · ficha T-318 en `develop`.
- **PR142-A01** · alto · arreglado-verificado · ficha/plan fuera del diff de implementación.

## Ronda 4

Se verificó:
- `signOut({ scope: 'local' })` ocurre antes del chequeo de `identities: []`, del admin client y de `activate_account_consents`;
- con `data.session=null` no se llama signOut;
- con error de signOut no se activan consentimientos;
- tests cubren Confirm Email ON y OFF sin fijar siempre `session:null`;
- mutaciones S1/S2/S2b/S3 son específicas y restauradas;
- compare con develop: behind=0;
- CI exact-head de `d9d7b063...`: **7/7 verde**.

## Próximo paso

Actualizar únicamente el body de la PR con el informe final de Ronda 4. No hace falta otra ronda por metadata. No aprobar ni mergear desde el agente.
