# PR #126 — CC-013 — Ronda 2

**Fecha:** 2026-09-29  
**HEAD funcional revisado:** `80155e4fea27e6a906fcbd59da73b266683ff832`  
**Resultado:** **SIN BLOQUEANTES DE CÓDIGO · EXCEPCIÓN DE GATE ACEPTADA**

## Cambios desde Ronda 1

Un único commit de autor sobre la revisión:

- `docs/contracts/CC-013.md`: marca aprobación P1.
- `tools/db-types.test.ts`: amplía los fixtures a los cinco helpers.

No se modificó `tools/db-types.mjs`.

## PR126-H01 — arreglado-verificado

El fixture remoto/local ahora contiene las cinco variantes reales.

La revisión repitió la mutación de Ronda 1 de forma independiente:

```js
.replace(/^( {2}EnumName extends )\((\w+ extends \{)$/gm, '$1$2')
```

Resultado:

```text
correctPasses: true
mutationWouldFailFirstTest: true
remainingBrokenHelpers:
- Tables
- TablesInsert
- TablesUpdate
- CompositeTypes
remainingCount: 4
```

La suite ya observa la clase completa que la implementación declara normalizar.

Estado: **arreglado-verificado**.

## PR126-D01 — aprobación P1

La decisión A de Lautaro073 quedó reflejada correctamente:

```md
- [x] P1 (dueño de esquema/RPC)
```

No se tocaron las líneas n.a.

## CI técnico final

Run CI #601, SHA `80155e4...`:

```text
build          success
unit           success
db-tests       success
lint           success
audit          success
typecheck      success
bundle-budget  success
```

No quedan fallos técnicos del PR en CI.

## PR126-D02 — excepción de approval-policy

El check `approval-policy` falla en runs #752/#753 con:

```text
Falta el informe completo de revisar-pr sin bloqueantes.
```

Causa verificada en `.github/workflows/approval-policy.mjs`:

```js
/Informe revisar-pr\s*—\s*T-\d{3}/
```

El parser acepta únicamente informes `T-xxx`; no contempla `CC-xxx`.

No corresponde escribir `T-013` o `T-300` en un informe de CC-013 solo para satisfacer el regex.

Lautaro073 eligió explícitamente:

> **B — aceptar approval-policy rojo para esta PR y seguir igual.**

Se registra como excepción P1, no como check verde ni como corrección verificada.

### Estado GitHub

- `mergeable: true`
- `mergeable_state: unstable`

No fue posible consultar branch protection mediante la integración (403), por lo que no se afirma si GitHub permitirá el merge sin bypass. Si el check es required, la plataforma puede exigir bypass/admin aunque la revisión técnica esté cerrada.

## No revisado todavía por definición

`migrate-staging` solo puede demostrar el objetivo final después de mergear/promover a staging. La validación previa disponible es:

- run original 36535421202 reproduce el drift de plantilla;
- blobs reales remoto/local normalizan byte a byte;
- db-tests actual queda verde en CI #601.

## Conclusión

No quedan bloqueantes de código ni de contrato dentro de CC-013.

Queda una **excepción de proceso aceptada por P1**: `approval-policy` rojo porque el gate no soporta IDs `CC-xxx`.

Esta revisión no hace merge.
