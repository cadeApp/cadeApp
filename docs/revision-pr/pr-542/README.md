# PR #542 — T-414 · Novedades y promociones

**PR:** https://github.com/cadeApp/cadeApp/pull/542 · **Autor:** Lautaro073 · **Rama:** `feat/T-414-announcements` → `develop`.

**Ronda 1 — 2026-10-22:** HEAD de código `204402e2aa8075d5fc405e62ce121af0c89030be`, base `7d9471fa8b105854b5ae175fa75a12cd9f20c83a`. **CON BLOQUEANTES (2)**, no aprobado ni mergeado.

| Hallazgo | Estado en la ronda 1 |
|---|---|
| H01 · error previo al push tratado como cero envíos | corregido por inspección; RED no reproducido independientemente |
| H02 · resultado de `admin_record_announcement_push` ignorado | corregido por inspección; RED no reproducido independientemente |
| H03 · paginación de destinatarios y suscripciones | corregido por inspección; RED no reproducido independientemente |
| H04 · envío habilitado sin conteo | corregido por inspección; RED no reproducido independientemente |
| H05 · matriz de autorización por RPC incompleta en pgTAP | **BLOQUEANTE** |
| H06 · `setTimeout(1)` en prueba de concurrencia | **BLOQUEANTE** |
| H07 · frase obsoleta de RLS en ficha | MEJORA |

La PR tenía 51 archivos (+4898/-34) al revisar. Autoriza D01=A: policies restrictivas, D02=A: paginación/lotes, D03=A: etiquetas Auditoría.

**CI del HEAD:** 177 archivos, 3361 pruebas unitarias PASS, typecheck/lint/build/audit/bundle-budget PASS. `db-tests` seguía en ejecución al redactar. En `b57f57f`, 39 archivos, 3201 tests de DB PASS y tipos coincidentes.

[Informe completo](revisiones/ronda-1.md) · [Hallazgos](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

**Siguiente:** agente corrige H05/H06/H07, pushea SHA y se revalida. No exigir otro CI únicamente por el commit documental de revisión. El E2E conectado a develop va después de `migrate-develop`; la revisión no lo ejecutó.
