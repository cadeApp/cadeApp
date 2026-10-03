# PR #225 — CC-019 · Área de servicio de Aguilares con barrios periféricos

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/225 |
| **Contract-change** | CC-019 · Issue #226 |
| **Autor** | @Lautaro073 |
| **Rama** | `cc/CC-019-aguilares-service-area` → `develop` |
| **SHA funcional revisado** | `1ca6e2ef2fd3761867bd9862acf5d4d2ffe8e6fd` |
| **Estado** | Draft · CON BLOQUEANTES |

## Rondas

| Ronda | SHA funcional | Resultado | Informe |
|---|---|---|---|
| 1 | `1ca6e2ef2fd3761867bd9862acf5d4d2ffe8e6fd` | 2 bloqueantes técnicos + 1 decisión P1 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR225-H01 | La cobertura de bounds no prueba barrios periféricos como entrega/destino | medio | abierto |
| PR225-H02 | La regla viva de Supabase conserva el recuadro viejo | medio | abierto |
| PR225-D01 | Aprobación explícita de los cuatro límites de CC-019 | decisión | decision-pendiente |

## Verificado como correcto

- Rama sincronizada con `develop@125728b591950f0de2ecd520eea2617415ac9508`: 6 ahead / 0 behind; mergeable.
- Alcance del código dentro de los archivos declarados por CC-019.
- Los 8 CHECK se reemplazan manteniendo los nombres.
- `calculate_route_distance`: al normalizar los cuatro límites nuevos a los viejos, la definición completa queda idéntica a la vigente en `develop`.
- `request_cycle`: misma comprobación; no se perdieron guards de T-330 ni de contratos previos.
- No cambian RLS, firmas, códigos de error, `SECURITY DEFINER`, `search_path` ni grants.
- `AGUILARES_CENTER` no cambia.
- DB GREEN actual: 16 archivos / 1748 tests.
- Unit GREEN actual: 114 archivos / 1706 tests.
- typecheck/lint/build/bundle-budget GREEN; Vercel READY.
- `e2e-preview` = `BLOCKED / REQUIRES DEVELOP MIGRATION`, esperado para una PR con migración.
- `audit` rojo por advisory externo de `braces`; package.json y lockfile son idénticos a `develop`.

## Coordinación hecha por la revisión

- Creado **CC-019 / #226** con label `contract-change`.
- T-326 / #190 vuelve a tener label `bloqueada`.
- Comentario en PR #218 avisando que no debe mergearse antes de resolver CC-019 y revalidar T-326.

**No mergear #225 todavía.**
