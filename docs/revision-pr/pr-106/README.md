# PR #106 — T-122 · Admin de repartidores

> 🔴 **Ronda 1: CON BLOQUEANTES (11)**

| | |
|---|---|
| PR | #106 |
| Rama | `feat/T-122-admin-repartidores` → `develop` |
| SHA revisado | `085d2c3d85c49c17d950c217353b91d4a6ffbdd6` |
| Base | `develop@366a2b859be586278bff9245b3f1ce1d1b6533ec` |
| Merge ref de GitHub | `72a1e0944ba37177f058e03f974b35dd9ba0a8b8` |
| Alcance | 20 archivos, todos dentro de la ficha original |
| Resultado | 11 bloqueantes · 0 decisiones pendientes |

## Decisiones de Lautaro073

### D01 — URLs reales del panel admin

**Elegida: 1-A.** Se mantiene el contrato canónico `/admin/...`.

La corrección debe hacer que Next publique realmente `/admin/applicants`, `/admin/applicants/[id]` y el alias `/admin/couriers`. `(admin)` sigue siendo un route group y por sí solo no aporta el segmento `admin`.

Se autoriza la ampliación mínima necesaria para que el guard lleve al flujo MFA real, porque es consecuencia técnica directa de mantener el contrato `/admin/...`.

### D02 — Primitivas del sistema de diseño

**Elegida: 2-A.** Se usan las primitivas oficiales de shadcn mediante un `contract-change`.

El repo ya tiene `components.json` de shadcn con `ui: "@/ui"`. T-122 no debe mantener copias manuales de Table/Tabs/InputOTP. El CC debe ir en rama/PR separado y reservarse en develop antes de retomarse T-122 (AG-71).

## Hallazgos

| ID | Sev. | Resumen |
|---|---:|---|
| PR106-H01 | alto | `(admin)` no genera `/admin/*`; los links canónicos apuntan a rutas inexistentes |
| PR106-H02 | alto | el guard de admin aal1 rebota por `/login` y nunca llega al MFA |
| PR106-H03 | alto | `redirectTo` no confiable llega directo a `router.push` |
| PR106-H04 | alto | decide/suspend/verify llaman RPCs con service_role, sin identidad aal2 |
| PR106-H05 | alto | verify document envía un input incompatible con el contrato RPC |
| PR106-H06 | medio | Table/Tabs/InputOTP manuales sin contract-change |
| PR106-H07 | medio | cola sin paginación |
| PR106-H08 | medio | sin loading/error y errores DB convertidos en vacío/404 |
| PR106-H09 | medio | 13 usos de `text-xs` contra el piso de 14px |
| PR106-H10 | medio | “Salir” no ejecuta signOut |
| PR106-H11 | medio | DoD visual marcado sin capturas ni evidencia AA/foco |

Detalle: [revisiones/ronda-1.md](revisiones/ronda-1.md) · Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [evidencia/comandos.md](evidencia/comandos.md)

## Aspectos correctos verificados

- Alcance original: todos los archivos del PR están permitidos por la ficha de develop.
- No se editó `src/ui/**` ni se agregaron dependencias silenciosamente.
- La extirpación de Liquidaciones está presente en la navegación.
- CBU/alias no se seleccionan en la cola ni el detalle.
- El visor genera signed URL de 60s y no devuelve la URL si falla la inserción de auditoría.
- El RED inicial existe y es real: en `8cdd539`, `admin.test.ts` ejecutó 13 tests y dejó 7 rojos.
- CI final del autor sobre `085d2c3`: typecheck/lint/unit/build/audit/bundle-budget/db-tests verdes; ese verde no cubre los bloqueantes anteriores.
