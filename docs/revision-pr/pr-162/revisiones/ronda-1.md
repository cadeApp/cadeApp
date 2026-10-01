# Ronda 1 — PR #162 / T-320

**Fecha:** 2026-10-01  
**SHA:** `49bc8c92ddd225e65cc930a71f2104957eb1ef7e`  
**Resultado:** **CON BLOQUEANTES (4)**

## Alcance y sincronización

La rama está 3 commits por delante y 0 por detrás de `develop`. Los 15 archivos modificados pertenecen a los «Archivos permitidos» de T-320. No hay cambios del autor en `docs/revision-pr/**`.

## Evidencia RED real

El commit inicial `0de9f858` ya contenía las pruebas T-320 antes de la implementación. CI run `36818656439` terminó rojo:

```text
Test Files  4 failed | 106 passed (110)
Tests       25 failed | 1527 passed (1552)
```

Entre los fallos se observan explícitamente ausencia de `emailRedirectTo`, ausencia de `redirectTo`, acciones de contraseña todavía sin implementar, guards que no reconocían las rutas nuevas, confirm handler inexistente y formulario stub. La evidencia RED es válida.

## CI del HEAD

CI run `36820292693` terminó verde:

```text
typecheck       success
lint            success
unit            success
build           success
bundle-budget   success
audit           success
db-tests        success

Test Files  110 passed (110)
Tests       1552 passed (1552)

Files=13, Tests=1611
Result: PASS
```

Los hallazgos siguientes son huecos que esta suite verde no observa.

---

## PR162-H01 — la revocación de otras sesiones es best-effort aunque el DoD la exige

**BLOQUEANTE · alto · correctness · P08-control-no-cubre-lo-que-dice**

En `src/features/auth/actions.ts:273-277`:

```ts
try {
  await supabase.auth.signOut({ scope: 'others' });
} catch {
  // Best-effort: fallo al revocar otras sesiones no anula el cambio de contraseña
}
```

La ficha exige que, tras cambiar correctamente la contraseña, se cierren las demás sesiones. La implementación convierte esa postcondición en best-effort.

La API actual de Supabase devuelve `{ error }` para `signOut({ scope: 'others' })`; por lo tanto hay dos clases de fallo que deben contemplarse:

1. la Promise resuelve con `{ error: ... }`;
2. la Promise rechaza por error de transporte/excepción.

En ambos casos el código actual continúa hasta `ok({ redirectTo })`.

### Batería independiente

```text
M01 signOut resuelve {error}  -> acción actual: ok
M02 signOut rechaza          -> acción actual: ok
```

Los tests solo prueban `mockResolvedValue({ error: null })` y que la función haya sido invocada; no prueban que la revocación haya sido exitosa.

### Arreglo esperado

Capturar el resultado de `signOut({ scope: 'others' })`. Si devuelve `error` o lanza, la acción no puede informar éxito; con los contratos actuales debe responder `INTERNAL_ERROR`. Agregar ambos tests adversariales.

---

## PR162-H02 — clasificación de sesión basada en substring del mensaje remoto

**BLOQUEANTE · medio · correctness · P07-coincidencia-demasiado-amplia**

En `src/features/auth/actions.ts:258-266`:

```ts
if (
  error.code === 'session_missing' ||
  error.name === 'AuthSessionMissingError' ||
  error.message?.toLowerCase().includes('session')
) {
  return err('UNAUTHENTICATED');
}
```

La ficha distingue «sin sesión» de «cualquier otro error». El substring del texto remoto hace que un error genérico como:

```text
code=unknown_failure
name=AuthApiError
message="Session backend unavailable"
```

termine como `UNAUTHENTICATED`, aunque por contrato corresponde `INTERNAL_ERROR`.

### Batería independiente

```text
M03 unknown_failure + "Session backend unavailable"
esperado: INTERNAL_ERROR
actual:   UNAUTHENTICATED
```

El test actual de error desconocido usa `"Server exploded"`, por eso no detecta la coincidencia demasiado amplia.

### Arreglo esperado

Clasificar falta de sesión por señal estructurada (`session_missing` y/o el tipo/nombre específico de Supabase), nunca por que el mensaje contenga una palabra. Agregar el caso adversarial anterior.

---

## PR162-H03 — falta la prueba explícita para rutas codificadas en `next`

**BLOQUEANTE · medio · test-coverage · P06-enumeracion-incompleta**

La ficha enumera expresamente ataques con rutas codificadas en la validación de `next`. En `src/app/auth/confirm/route.test.ts:221-255` se prueban:

- URL absoluta;
- `//evil.com`;
- `/\\evil.com`;
- una ruta interna fuera de allowlist.

No hay request con el valor hostil percent-encoded.

La implementación actual parece rechazar los ejemplos hostiles después de la decodificación de `URLSearchParams`, pero el DoD exige que esa frontera quede observable por prueba y demostrada contra una mutación.

### Arreglo esperado

Agregar una tabla de casos como mínimo con:

```text
next=%2F%2Fevil.com
next=https%3A%2F%2Fevil.com
next=%2F%5Cevil.com
```

y afirmar que el destino final sigue siendo interno y no contiene el host atacante. No hace falta cambiar producción si estos casos pasan tal como está.

---

## PR162-H04 — los controles nuevos de reset pierden semántica y foco visible

**BLOQUEANTE · medio · accesibilidad · P13-accesibilidad-no-considerada**

La clase completa en `src/features/auth/components/reset-password-form.tsx` tiene tres ocurrencias:

1. líneas 50-54: `<Link><Button /></Link>` termina como un enlace que contiene un `<button>`, es decir, interactivo dentro de interactivo;
2. líneas 112-119: toggle «ver contraseña» con `focus:outline-none`, sin reemplazo `focus-visible` y sin target mínimo 48×48;
3. líneas 150-157: mismo defecto en «confirmar contraseña».

El formulario de login ya contiene el patrón canónico del proyecto para estos toggles: `h-12 min-h-12 w-12 min-w-12` más `focus-visible:ring-2 focus-visible:ring-ring`.

### Arreglo esperado

- Renderizar el CTA a `/forgot-password` como un solo `Link` estilizado con `buttonVariants`/tokens del sistema, no `Link > Button`.
- Alinear ambos toggles de visibilidad al patrón accesible existente de login/register: target táctil mínimo y foco visible.
- Mantener sus `aria-label` actuales.
- Agregar al menos una comprobación que impida reintroducir `a > button`; el foco/tamaño puede verificarse por el mecanismo de UI ya usado por el repo o quedar documentado para inspección si no hay una aserción robusta sin acoplarla a clases.

---

## Residual operacional, no bloqueante de implementación

La propia ficha deja a Lautaro073:
1. configurar en Supabase las Redirect URLs;
2. después del merge/promoción, ejecutar el flujo real en `cadeapp-staging`.

No se marca ninguno como completado en esta ronda.

## Informe revisar-pr

```text
Informe revisar-pr — T-320 — 2026-10-01 — generado por revisión independiente
Resultado: CON BLOQUEANTES (4)
Checks: typecheck ✅ · lint ✅ · unit ✅ (1552/1552) · build ✅ · db-tests ✅ (1611/1611)
BLOQUEANTES:
- [src/features/auth/actions.ts:273-277] signOut({scope:'others'}) es best-effort y su {error}/rechazo no impide devolver éxito.
- [src/features/auth/actions.ts:258-266] cualquier error cuyo message contenga "session" se clasifica erróneamente como UNAUTHENTICATED.
- [src/app/auth/confirm/route.test.ts:221-255] falta el caso explícito de next percent-encoded exigido por la ficha.
- [src/features/auth/components/reset-password-form.tsx:50-54,112-119,150-157] CTA interactivo anidado y toggles sin foco visible/target táctil mínimo.
MEJORAS:
- Ninguna separada en esta ronda.
No revisado / residual:
- Redirect URLs de Supabase y evidencia E2E real de staging: pasos manuales de Lautaro073 definidos por la ficha.
```
