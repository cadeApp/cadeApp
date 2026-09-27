# PR #112 — T-123 · Admin de comercios y plataforma

> 🔴 **Ronda 1 — fase RED: CON BLOQUEANTES (3)**

| | |
|---|---|
| PR | #112 |
| Rama | `feat/T-123-admin-comercios-plataforma` → `develop` |
| SHA funcional revisado | `1960d016e7fc88ba0c788f3fad919148068de3a2` |
| Base | `develop@7f392e9f0fc020f9dcf6838d1638cbbe4004d7ac` |
| Estado de la PR | Draft / fase RED |
| CI | typecheck ✅ · lint ✅ · build ✅ · audit ✅ · db-tests ✅ · bundle-budget ✅ · unit ❌ esperado por RED |
| Resultado de revisión | fase RED genuina, pero cobertura incompleta |

## Decisiones

- D01–D04: registradas en la ficha de T-123.
- **D05-B (Lautaro073):** excepción explícita a Regla 25 para T-123. No se agregan en esta PR índices ni pruebas RLS específicas para las consultas nuevas; queda como deuda/tarea posterior. No presentar esto como cumplimiento de Regla 25.

## Hallazgos

- **H01:** A03 no fija la semántica de “Marcar mes pagado”.
- **H02:** A04 puede omitir `pilot_active` y el panel “Últimos cambios”.
- **H03:** A06 puede perder el filtro `action` al paginar.

Detalle: [revisiones/ronda-1.md](revisiones/ronda-1.md)
