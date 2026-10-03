# PR #225 — CC-019 · Área de servicio de Aguilares con barrios periféricos

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/225 |
| **Contract-change** | CC-019 · Issue #226 |
| **Autor** | @Lautaro073 |
| **Rama** | `cc/CC-019-aguilares-service-area` → `develop` |
| **SHA funcional revisado** | `5cd40ba4aaf6073556a8f31dfd0089da622a6980` |
| **Estado** | Draft · BLOQUEO DE INTEGRACIÓN |

## Rondas

| Ronda | SHA funcional | Resultado | Informe |
|---|---|---|---|
| 1 | `1ca6e2ef2fd3761867bd9862acf5d4d2ffe8e6fd` | 2 bloqueantes técnicos + 1 decisión P1 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `5cd40ba4aaf6073556a8f31dfd0089da622a6980` | H01/H02 cerrados · D01 aceptada · pendiente sincronizar develop | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR225-H01 | La cobertura de bounds no prueba barrios periféricos como entrega/destino | medio | arreglado-verificado |
| PR225-H02 | La regla viva de Supabase conserva el recuadro viejo | medio | arreglado-verificado |
| PR225-D01 | Aprobación explícita de los cuatro límites de CC-019 | decisión | aceptado |

## Ronda 2

- H01: 39 aserciones simétricas de destino/dropoff; mutación destino-only real → RED 36/116; revert normal → GREEN.
- H02: la ficha autoriza exactamente `.agents/rules/30-supabase.md` y solo cambia la línea del bounding box.
- D01: Lautaro073 aprobó opción A; issue #226 y ficha reflejan los cuatro límites.
- CI del SHA funcional: typecheck/lint/unit/build/db-tests/bundle-budget GREEN; DB 16 archivos / 1787 tests; unit 114 / 1706; Vercel READY.
- Audit rojo por advisory externo de `braces`; package y lock iguales a develop.
- E2E bloqueado por `REQUIRES DEVELOP MIGRATION`, esperado.

## Gate pendiente

Durante la revisión, `develop` avanzó a `55be618b26d4ab28f4030c8e8a7220d095e559b3`.

La rama está ahora:

```text
ahead: 11
behind: 27
```

Los 27 commits nuevos corresponden a T-304/E2E y no pisan archivos de CC-019, pero el CI de `5cd40ba4aaf6073556a8f31dfd0089da622a6980` no certifica el árbol integrado actual.

Antes de cerrar CC-019:

1. sincronizar `origin/develop` sin rebase/force/amend;
2. resolver cualquier conflicto conservando CC-019;
3. repetir CI/DB/Vercel;
4. pedir una verificación final corta.

**No mergear #225 todavía.**
