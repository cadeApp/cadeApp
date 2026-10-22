# PR #489 — Admin y seguridad de Fase 4 · T-400 a T-409

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/489 |
| Autor | @Lautaro073 |
| Rama | `docs/T-400-407-fichas` → `develop` |
| R1 | `25ad3cf36cf5` · con bloqueantes (7 altos / 3 medios / 2 bajos) |
| R2 | `be515ec74e9f` · 12 correcciones, 6 hallazgos nuevos (3 altos / 2 medios / 1 bajo) |
| R3 | `3a70d5561624d30382bbb48b407ceaea9514c1a0` · **SIN BLOQUEANTES DOCUMENTALES** |
| Tipo | 10 fichas y plan, sin código, SQL ni migraciones |

## Informes independientes
- [Ronda 1](revisiones/ronda-1.md)
- [Ronda 2](revisiones/ronda-2.md)
- [Ronda 3](revisiones/ronda-3.md)

## Estado de los hallazgos
18/18 especificaciones corregidas tras las tres rondas. Revisadas documentalmente en `3a70d556`. **No** equivale a ejecución ni cierre técnico de futuras mitigaciones.

**CI HEAD R3**: unit 3170/3170 (verify-fichas 7/7), db-tests 3019/3019, lint/typecheck/build/audit/bundle-budget verdes, Vercel success. E2E-preview cancelado; revisar si es check requerido. Informe `SIN BLOQUEANTES` agregado al cuerpo de PR para approval-policy (antes faltaba).

## Decisiones y dependencias
- D01=C / #498: búsqueda normalizada en PostgreSQL.
- D02=C / #499: timestamp real de envío.
- D03=C: tres pestañas de incidentes.
- T-408 contiene una especificación futura para cerrar SEC-01/02/03/10/11; sigue vigente la aceptación de riesgo de lanzamiento firmada por Lautaro073 en T-312.
- T-409 organiza issues/CC/hijas, no declara cerradas vulnerabilidades reales.
- PR #497 ya mergeada en develop; PR #491 / T-312 sigue abierta.

## Acción
**Revisión de especificación SIN BLOQUEANTES.** Sin aprobación ni merge; comprobar estado de checks requeridos, especialmente `e2e-preview`, antes de mergear. No exigir repetición de CI únicamente por los commits de informe.

[Hallazgos](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).
