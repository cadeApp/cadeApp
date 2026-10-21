# Informe revisar-pr — T-387 — 2026-10-21 — ronda 2 independiente

**PR:** https://github.com/cadeApp/cadeApp/pull/471  
**Código corregido:** `59e7a36cf14943ba9ad7db945907f420fea1d0a9`  
**HEAD con bitácora:** `fceddca2ac5c77c3236dc29266ae25be0be65514`  
**Resultado:** **SIN BLOQUEANTES TÉCNICOS NUEVOS (0)**. H01–H03 resueltos con alcances de comprobación detallados; **pendiente gate E2E oficial/approval-policy antes de mergear**.

## Controles al arrancar
- Ficha `docs/tasks/T-387.md` consultada en `develop@9add0a25`, no en la rama.
- Rama GitHub al día: 5 commits adelante, 0 detrás, `mergeable=true`; no CC, ADR ni migraciones nuevos en el diff.
- Comparación con ronda 1 (`02d7180a`): 5 archivos del scope autorizado; ningún archivo de revisión tocado por el agy.
- PR: comentario R1 (revisor), sin nuevos comentarios inline ni aprobaciones.
- Bitácora: sesión append-only nueva del 21/10, sin falsificar el SHA de su propio commit.
- Entorno: sin checkout local; no se levantaron Docker ni Supabase, ni se tocaron variables, claves, despliegues o workflows manualmente.

## Reevaluación de hallazgos

### H01 — Resuelto
En `e2e/specs/courier-onboarding.spec.ts` el helper `buildOnePagePdf` crea una página completa, `expectOnePagePdf` valida la estructura propia, y `expectStoredPdf` descarga el objeto de Storage y compara los bytes íntegros. Los tres flujos E2E la usan. El revisor **ejecutó en /tmp** el helper transcrito exactamente de `59e7a36cf14943ba9ad7db945907f420fea1d0a9`: `pdfinfo` emitió **exit 0, Pages: 1**; el catálogo roto por mutación independiente dio **exit 99**. El E2E local 12/12 y M9 rojo son evidencia **de la bitácora del autor**, no nueva ejecución del revisor.

### H02 — Resuelto en código; comprobación independiente de guardas estáticas + CI
`vehicle-form.tsx`: busy antes del primer `await`; contador del intento evita que la selección vieja sobrescriba la nueva. `document-replacement-card.tsx`: guard `inFlightRef` y busy antes de validar. El revisor ejecutó controles sobre cadenas extraídas de ambos módulos y cuatro mutaciones **en memoria** (borrar/mover busy y quitar guard): original GREEN y las cuatro copias mutadas RED. Esto demuestra el orden y la presencia de barreras, **no simula el DOM**. Los tests del agente con FileReader retenido se corroboran presentes en `components.test.tsx`, y el CI unit de `fceddca2ac5c77c3236dc29266ae25be0be65514` reporta **3153/3153**. Los M7/M8 runtime rojos son del autor, no de esta ejecución independiente.

### H03 — Resuelto
`docs/tasks/log/T-387.md` suma sesión nueva con hechos y resultados actuales, preserva la previa, y declara pendientes los gates oficiales.

## Mejoras / advertencias no bloqueantes
- Los tests nuevos de concurrencia efectivamente mockean `uploadCourierDocument` y acciones (necesario para aislar la UI); el comentario que dice «no se mockea subida ni acciones» es impreciso. No invalida la prueba porque se afirma que se invocan y el E2E ejercita Storage y backend. Ajustar comentario en próxima edición del archivo, sin forzar otra ronda.
- `expectOnePagePdf` es un verificador de invariantes estructurales, **no un parser PDF completo**; la validez del helper fue corroborada por separado con `pdfinfo`. No existe motivo para agregar una dependencia pesada de PDF en esta tarea.
- `bundle-budget` reporta advertencias existentes para rutas del courier; la comparación medida 259 kB → 258 kB descarta regresión cuantitativa en estas dos rutas.

## CI y merge readiness
- CI código `59e7a36cf14943ba9ad7db945907f420fea1d0a9` ✅ éxito, run 39538285344.
- CI `fceddca2ac5c77c3236dc29266ae25be0be65514`: `unit` 155 archivos / 3153 pruebas ✅; typecheck/lint/build/audit/bundle ✅; `db-tests` en curso al cierre del cotejo.
- `approval-policy` ❌ sin el informe de esta ronda; `e2e-preview` pendiente. La ejecución E2E local descrita en bitácora fue **100 pass, 2 flaky, 1 failed fuera de T-387, 2 did not run**; el spec con fallo pasó solo después. No se inventa un full green.
- **Recomendación:** no pedir más modificaciones de código de T-387. Esperar que el E2E oficial y el gate de revisión queden realmente en verde sobre el HEAD aplicable antes de mergear. No exigir nueva batería completa solo por este commit de documentación; si falla alguna prueba obligatoria, investigar su fallo real.

## Decisiones 🔵
**Ninguna.** Todas las opciones de alcance ya están decididas en T-387 (1 C y 2 C). No se solicita ampliación.

## Resultado y límites de independencia
Esta ronda cierra los **bloqueantes técnicos** y deja un requisito operativo **pendiente**, no un supuesto GREEN. No se ejecutó Playwright ni Vitest localmente; las comprobaciones propias fueron parser PDF real, lectura verificable del código/bitácora, mutaciones estáticas en memoria y logs reales de GitHub CI. **No aprobado / no mergeado**.
