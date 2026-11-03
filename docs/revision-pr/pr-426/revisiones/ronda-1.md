# Informe revisar-pr — PR #426 — Ronda 1

**Fecha:** 2026-10-19  
**HEAD funcional revisado:** `16844025f3d6f73725f1045ca05d5022f95cd4c9`  
**Base:** `staging@fb7db3f035251a78e5a9e32f5e3465735a36ba4f`  
**Origen:** `develop@59fb3daa82eb1c0394dca9bad143d7fd246ec34b`  
**Resultado:** SIN BLOQUEANTES DE INTEGRACIÓN. No autoriza merge ni promoción.

## Verificaciones

- `16844025` es un merge, no un rebase, con padres exactos `59fb3da` y `fb7db3f`; ambos son ancestros de HEAD.
- Los 32 conflictos contenían, del lado staging, blobs exactos ya presentes en el historial de develop. Se conservaron las versiones nuevas de develop tras inspeccionarlos.
- Frente a develop, el árbol integrado agrega únicamente 22 archivos propios de staging: 18 artefactos históricos de revisión y cuatro personalizaciones de SEO/footer/layout/ícono.
- Se detectó y corrigió antes del commit un conflicto semántico no marcado por Git en `src/server/cron/sweep.ts`: un parser duplicado. El resultado conserva una sola definición y mantiene la reconciliación CC-030.
- Hay exactamente seis migraciones pendientes respecto de staging, en orden.
- CC-025 Fase C es compatible con el bundle desplegado: onboarding ya usa `submit_courier_onboarding_documents(jsonb)`, que se conserva con `EXECUTE authenticated`; la revocación de escrituras directas no lo corta. `admin_verify_document` conserva la llamada anterior de tres argumentos porque `p_rejection_code` tiene default y la salida adicional es tolerada por el schema anterior.
- CC-029/T-369 conserva contratos públicos y piloto; CC-030 agrega la barrera y deja el purge en `dry-run`; `admin_list_publication_plans` y CC-032 son aditivas; CC-031 sólo impide la autoedición del nombre del courier.

## Checks

- Local: typecheck PASS; lint PASS; 148 archivos / 2890 unit tests PASS; workflows 79/79 PASS; ADR 6/6 PASS; build de producción PASS (52 páginas).
- `pnpm test:db` local no ejecutado: Docker Desktop apagado / `ECONNREFUSED 127.0.0.1:54322`.
- CI de origen `39289651766`, intento 2, mismo SHA `59fb3da`: PASS completo; pgTAP 31 archivos / 2868 tests, CC-025 B0/Fase C, concurrencia y backfill verdes.
- CI del merge `39294894287`: typecheck, lint, unit, build, audit y bundle-budget PASS; `db-tests` seguía en curso al redactar este informe.

## Pendientes operativos

- Esperar `db-tests` remoto del SHA funcional exacto.
- PR #427 sigue bloqueada por alcance y no está en develop; si se regulariza y mergea, volver a mergear `origin/develop` en esta release y repetir revisión/CI.
- Preflight hosted sólo lectura, backup, ventana y configuración del ambiente siguen siendo requisitos manuales. No se consultaron secretos ni ambientes remotos.

**BLOQUEANTES:** ninguno en el árbol integrado revisado.  
**MEJORAS:** ninguna.  
**No revisado / dudas para Lautaro073:** estado hosted de migraciones, backup, variables y smoke/E2E post-merge; requieren autorización y ejecución operativa posterior.
