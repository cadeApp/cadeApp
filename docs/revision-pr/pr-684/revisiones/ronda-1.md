# Revisión independiente — PR #684 / T-409 — Ronda 1

**Fecha:** 2026-11-08  
**Head auditado:** 9c7cb2831aefa5f2bff36ac430fb6d1ff046c450  
**Base:** develop@305a3c7550d4c6dce08e431645aca378114c494d  
**Resultado:** **SIN BLOQUEANTES** (0 bloqueantes; 1 mejora editorial no condicionante).

## Alcance y hechos verificados

- El diff de la tarea incluye únicamente docs/tasks/T-409.md y docs/tasks/log/T-409.md; ambos están en «Archivos permitidos» según la ficha **leída desde develop**. Su modificación agrega inventario y ajusta el DoD en D2=A, sin introducir implementaciones, migraciones ni fichas hijas.
- Comparación independiente con la entrada de seguridad de docs/tasks/log/T-312.md: **24 identificadores atómicos** en las categorías medios y bajos. Se excluyen SEC-10/SEC-11 (T-408) y D-10 (T-392): quedan **21 identificadores** cubiertos por **20 filas** en el inventario porque A-08/B-07 y A-09/C-04 se agrupan. CSP es la fila adicional, expresamente pedida por la ficha. Sin faltantes ni sorpresas.
- Issues #664–#683 consultados individualmente: **20/20 abiertos**, asignados a Lautaro073, etiquetados P1 como dueño, cuerpo con urgencia en palabras. **14/14** de los clasificados «CC: sí» tienen etiqueta contract-change; los otros seis no.
- Clasificación inventariada: **6 Alta, 8 Media, 6 Baja**. Los 14 CC corresponden a cambios previstos de RLS, esquema, Storage, RPC o contratos compartidos; **6 sin CC previsto** (SEC-08, CSP, D-05, D-04, D-06 y D-07). Las futuras fichas y CC deben validar el alcance preciso; no se presentan como diseños aprobados.
- D1=A es consistente: etiqueta P1 de GitHub = Persona 1, no urgencia; la tabla y los issues separan ambos conceptos. D2=A está en la ficha y DoD: CC en su propia PR, mergeado **antes** de implementar la hija; SEC-12 requiere primero capturar Realtime con actores autorizados/no autorizados y probar el cambio en efectivo, **sin** CHECK prematuro.
- D-10: .github/workflows/health-cron.yml programa cada 10 min y llama /api/cron/health para staging y production; correctamente fuera del inventario. CSP: src/security/headers.ts conserva Content-Security-Policy-Report-Only, así que #669 debía seguir abierto; el issue fue corregido y está abierto.
- Estado parcial, no cierre: SEC-07 ya envía en tandas de 10 (src/server/push/sender.ts), pero carece de allowlist y timeout; issue #665 fue precisado. D-06 ya tiene patrones de contenido además de claves (src/server/observability/scrubber.ts), pero la cobertura no es completa; issue #682 fue precisado. Los restantes están inventariados como trabajo pendiente, **no como bypass explotado por esta revisión**.

## PR684-H01 · 🟡 MEJORA, no bloqueante — Resúmenes heredados desactualizados

**Archivo:** docs/tasks/T-409.md, apartados «Objetivo» y «DoD»; docs/tasks/log/T-409.md, entrada de decisiones.  
**Detección:** [ANÁLISIS] sobre 9c7cb283, contrastado con los módulos y los issues.  
**Diagnóstico:** el objetivo heredado de SEC-07 todavía dice «envío secuencial sin timeout», aunque el sender ya usa tandas de diez. La frase de D-06 «el scrubber trabaja por claves» resume mal la implementación (también busca patrones de contenido). El DoD mantiene la palabra «prioridad» donde ahora el inventario usa «urgencia». La nueva entrada de bitácora atribuye D1 y D2 a opciones recomendadas «Lautaro073 ausente», aunque las decisiones fueron confirmadas explícitamente en esta revisión.
**Impacto:** bajo/editorial: inventario, urgencias, CC e issues están correctos; #665 y #682 ya tienen el detalle residual. No condiciona el merge de T-409. Si se revisa esta ficha en una futura edición, ajustar estas frases con precisión sin ampliar alcance.
**No exigir:** otra ronda ni un CI adicional únicamente por este detalle documental.

## Controles y límites

- **Control propio de inventario:** se comprobaron conteo, orden, IDs, agrupaciones, issue único, CC y urgencia; 4 mutaciones en memoria (eliminar B-09, cambiar CC de SEC-09, cambiar urgencia de A-07 y duplicar issue de D-04) dieron RED; el estado intacto dio GREEN. Ver evidencia/comandos.md. No se modificaron tests, expectations ni archivos de producción.
- **GitHub:** head 9c7cb283 coincide con el SHA solicitado, PR abierta, mergeable=true según API (no equivale a ejecutar git merge-tree).
- **Checks locales:** typecheck, lint, pnpm test y test:db **no ejecutados**: la sesión no tiene un clon ni pnpm; no se corrió Supabase ni Docker. Como la PR solo inventaría hallazgos, no se declara RED→GREEN de las vulnerabilidades hijas.
- **CI oficial:** al consultar el SHA revisado, workflow CI estaba in_progress; approval-policy inicialmente failure sin informe; e2e-preview no estaba reportado como verde (preview Vercel omitido para la rama documental). **No afirmar CI verde**. La verificación de esta ronda es principalmente documental y por inspección.
- **No tocar:** SEC-10/11 pertenecen a T-408; SEC-04/05 pertenecen a T-390/T-391. No convertir SEC-12 de hipótesis a fallo confirmado. No exigir archivos de CC en esta misma PR: D2=A lo prohíbe.
- **Cambios remotos de esta revisión:** los issues #669 (reabierto y título sin T-391 para impedir autocierre por board-sync), #665 y #682 (descripciones precisadas). No se modificó develop, staging, main, secretos ni configuraciones.

## Veredicto

**SIN BLOQUEANTES — ronda 1 cerrada contra 9c7cb283.** El alcance es documental; las 20 tareas hijas siguen pendientes y necesitan su implementación, pruebas de bypass y revisión independiente propias. La mejora H01 no impide merge de la PR paraguas. No aprobar ni mergear sin petición explícita.
