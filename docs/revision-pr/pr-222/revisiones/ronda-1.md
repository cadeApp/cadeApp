# Informe de revisión — PR #222 / CC-018 — Ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/222  
**SHA funcional revisado:** `588439a8e3bf91ab76c7affa56b682034bdb8807`  
**Fecha:** 2026-10-02

## Resultado

**CON BLOQUEANTE OPERATIVO (1).**

La implementación de CC-018 está bien acotada y, por inspección más CI del SHA exacto, cumple el contrato. No encontré un defecto funcional nuevo en el Select.

Queda un único gate externo: el Preview de Vercel del SHA revisado falla durante `pnpm run build`. Como GitHub Actions construye exitosamente exactamente el mismo SHA, no se adjudica una causa sin evidencia.

## Alcance y sincronización

- base: `develop@8ee022c2bf9166f6550b6973c5c4d8fd2413b9d2`;
- head funcional: `588439a8e3bf91ab76c7affa56b682034bdb8807`;
- 1 commit ahead / 0 behind;
- PR mergeable;
- archivos cambiados antes de esta revisión:
  - `docs/contracts/CC-018.md`;
  - `src/ui/select.test.tsx`;
  - `src/ui/select.tsx`.

Coinciden con los archivos permitidos del contrato CC-018.

## Implementación verificada

La raíz del defecto era coherente con el diagnóstico de #219: el wrapper tenía su propia máquina de estado, items propios y además un `SelectPrimitive.Root` de Radix cuyos items reales no estaban registrados.

El arreglo es mínimo:

- elimina el import de `@radix-ui/react-select` de este archivo;
- elimina solamente el wrapper `SelectPrimitive.Root`;
- conserva el Provider propio y el `div[data-cade-select-root]`;
- no cambia `handleSelect`;
- no cambia `SelectTrigger`, su handler de teclado ni roles/ARIA;
- no elimina la dependencia del proyecto.

## Cobertura

`src/ui/select.test.tsx` comprueba:

1. controlado dentro de `<form>`: elegir B produce una sola llamada con B;
2. si el padre no actualiza `value`, la prop controlada sigue siendo fuente de verdad;
3. modo no controlado respeta `defaultValue` y selección posterior;
4. trigger/listbox/options conservan roles, ARIA, cierre y `aria-selected`;
5. el wrapper corregido no monta un `<select>` nativo.

El primer caso además actualiza el estado del padre y comprueba que el trigger muestra la etiqueta elegida, cubriendo el requisito de integración controlada.

### GREEN independiente

GitHub Actions run **951**, sobre `588439a8e3bf91ab76c7affa56b682034bdb8807`:

- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- audit ✅
- db-tests ✅
- bundle-budget ✅

Resumen unit:

```text
src/ui/select.test.tsx (5 tests) PASS
Test Files 114 passed (114)
Tests 1687 passed (1687)
```

La evidencia RED/mutación declarada por el autor no pudo reejecutarse en este entorno de revisión porque el acceso al repo es por connector y no hay clon ejecutable local. La sensibilidad del control sí queda sustentada por la aserción exacta de cantidad/valor de callbacks y por la ejecución GREEN del archivo en CI; no se presenta esto como un RED runtime independiente.

## PR222-H01 — Preview Vercel falla sobre el SHA revisado

**Severidad:** medio  
**Categoría:** correctness / operación  
**Patrón:** P15-entregable-declarado-pero-no-ejecutable

Deployment:

```text
dpl_CqVhLF7kG57bper8AXMYk7oPmG7E
SHA: 588439a8e3bf91ab76c7affa56b682034bdb8807
state: ERROR
errorCode: type_error
errorMessage: Command "pnpm run build" exited with 1
```

El deployment inmediatamente anterior de `develop@8ee022c...` estaba READY, mientras el build de GitHub para este SHA está GREEN.

### Qué falta

No modificar código a ciegas.

1. Dejar que el commit documental de esta revisión dispare un nuevo Preview.
2. Si el nuevo Preview queda READY, pedir Ronda 2 para cerrar H01 como fallo transitorio.
3. Si vuelve a fallar, inspeccionar el log de ese deployment y corregir únicamente la causa demostrada.
4. No debilitar tests ni cambiar CC-018 para hacer pasar el deployment.

## Decisiones P1

Ninguna pendiente.

## Conclusión

CC-018 está técnicamente bien implementado. **No mergear todavía** únicamente por el gate Vercel rojo hasta obtener un Preview fresco GREEN o una causa reproducida y corregida.
