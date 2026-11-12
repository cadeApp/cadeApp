# Ronda 3 — PR #735 · T-435 / CC-051 — 2026-11-12

**Resultado: SIN BLOQUEANTES. 7/7 hallazgos de R1 cerrados y revalidados documentalmente. Sin decisión nueva; sin aprobación ni merge.**

| Elemento | Verificado |
|---|---|
| SHA revisado | `ab697f5dded24c2c966d2bf77837f6bae14776ea` |
| Base develop | `2cd76f246f9c7644e659e2ec4d0177802e0cde50` |
| Rama | `feat/T-435-sec12-realtime-capture` |
| PR | https://github.com/cadeApp/cadeApp/pull/735 |
| CI del SHA | **success**, [run 43256758218](https://github.com/cadeApp/cadeApp/actions/runs/43256758218), evento `pull_request` |
| Scope | Documental: no hay implementación E2E nueva ni cambio de esquema |

## Preflight

- Leídos `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, `AGENTS.md` desde base, más CC-023 §5, CC-051, ficha T-435, plan T-435, bitácora, ronda 2, hallazgos, evidencia y lecciones.
- Antes del diff se comprobaron comentario R1 y R2, bot Vercel (ignorado), **sin comentarios de review nuevos ni threads**, y `develop@2cd76f24` aún vigente.
- GitHub `mergeable=true`; la comparación `7a653b4c...ab697f5d` es ahead=2, behind=0, con **solo dos archivos distintos modificados**: `docs/tasks/T-435.md` y `docs/tasks/log/T-435.md`. Un commit de autor `5da64f56` fue seguido por un merge **no rebased** `ab697f5d`, que trajo el commit de revisión `7a653b4c` sin descartar cambios.
- Ninguna modificación de `docs/revision-pr/pr-735/**` hecha por el autor entre R2 y R3; se preservan `ronda-1.md`, `ronda-2.md` y datos del revisor. Nada que restaurar ni renombrar por autorrevisión.
- La ficha se creó en la PR, **no existe en develop**; toda edición es parte del alcance ya autorizado de CC-051. No se ampliaron permisos, migraciones ni dependencias.

## Comprobación completa de H01–H07

| ID | Estado R3 | Evidencia en SHA `ab697f5d` |
|---|---|---|
| H01 | **Arreglado-verificado** | CC-051:60–64 y T-435:64–65 exigen UPDATE real al courier; INSERT adicional solo inspeccionado |
| H02 | **Arreglado-verificado** | CC-051:69–73, T-435:68–70: draft con marker en INSERT post-SUBSCRIBED; S positivo, M sin claves, A negativo |
| H03 | **Arreglado-verificado** | CC-051:47–56 y 78–87, T-435:60–75: SUBSCRIBED, PostgREST por actor, barrera causal, ventana negativa y su límite |
| H04 | **Arreglado-verificado** | CC-051:89–98 y 114–125: gate de matriz completa, fuga solo para actor restringido, negativos por conteo |
| H05 | **Arreglado-verificado EN ESTA RONDA** | T-435:110–116 separa la regla por publicación completa y allowlist: SELECT privilegiado de origen, evento público del ID sin excluidas, pgTAP attnames/PK/offers. CC-051:102–112 coincide. El veto absoluto de R2 desapareció |
| H06 | **Arreglado-verificado** | CC-051:160–173 exige rollback fail-closed sin volver a publicación completa, preserva offers |
| H07 | **Arreglado-verificado** | CC-051:78–100, T-435:73–80: correlación, limpieza en finally, null y log solo nombres de claves. T-435:117–118 precisa que visibilidad PostgREST del borrador se prueba luego del INSERT |

**Mutaciones nuevas, independientes de la batería de R2:** se verificaron **siete invariantes de H05** en verde sobre texto GitHub en `ab697f5dded24c2c966d2bf77837f6bae14776ea`: (1) control positivo en completa; (2) ausencia obligatoria de columnas privadas en allowlist; (3) SELECT privilegiado del origen; (4) evento público correlacionado; (5) pgTAP attnames/PK/offers; (6) PostgREST de draft posterior al INSERT y separado de SUBSCRIBED; (7) prohibición de nota de veto absoluto. A cada una se le introdujo **una mutación adversa distinta exclusivamente en memoria**, y el instrumento la detectó en **rojo**, 7/7. Se revalidaron otras **10 obligaciones transversales**, todas en verde, de CC, ficha, bitácora y fila del plan. Código completo, control y salida en [evidencia/comandos.md](../evidencia/comandos.md). Esto demuestra consistencia del **documento**, no la semántica de eventos Realtime ejecutados.

### Protocolo CI: ejecución exacta y resumen

Se comprobó vía GitHub Actions el run **43256758218**, `pull_request`, **head_sha exacto `ab697f5dded24c2c966d2bf77837f6bae14776ea`**, **completed/success**, posterior a los commits documentales fuente.

| Job | Resultado | Evidencia examinada |
|---|---|---|
| unit | ✅ success | `pnpm test:coverage`: **209 Test Files passed; 3961 Tests passed**; además tests Node de workflow 86/86 y ADR 6/6 |
| db-tests | ✅ success | pgTAP **Files=47, Tests=3958, Result: PASS**; tests de mutaciones esperadas RED→GREEN restauradas; `git diff --exit-code -- src/types/database.types.ts` concluyó sin diferencias |
| build | ✅ success | compilación y artifact de rutas generados |
| lint | ✅ success | `pnpm lint` terminado correctamente |
| typecheck | ✅ success | `pnpm typecheck` terminado correctamente |
| audit, bundle-budget | ✅ success | finalizados correctamente |

El job `lint` advierte que `pnpm format:check`, configurado como **advisory**, detectó estilo en **355 archivos globales**. Los logs no señalan archivos de `docs/contracts/CC-051.md`, `docs/tasks/T-435.md`, `docs/tasks/log/T-435.md` ni `docs/revision-pr/pr-735/` dentro de ese reporte. No se convierte una advertencia preexistente repo-wide en bloqueo de esta tarea documental.

**`pnpm exec vitest run tools` 123/123:** consta en bitácora, **no se reprodujo ese comando concreto** en un clon local; el CI general verificado es independiente y suficiente para no fingir ese resultado. No se arrancó Docker/Supabase local ni se dispararon workflows remotos.

**`node docs/revision-pr/analizar.mjs verificacion` y `git merge-tree`:** no ejecutados por falta de clon. Se validó estructura JSONL en memoria y GitHub reporta mergeable=true; distinguir ambas observaciones de una ejecución real local.

## Decisiones y cierre

- **D1 expresa de Lautaro073:** captura solo vía `e2e-preview` en Develop con usuarios del arnés.
- **D2-A selección automática:** sin CHECK de null si no aparece fuga; si aparece, CC-023 §5.
- **D3-A selección automática por autorización permanente, no decisión expresa:** matriz RPC real UPDATE + draft sintético INSERT + pruebas positivas, negativas y temporalidad. Las tres siguen reflejadas en el contrato/ficha.
- No hay cuestiones 🔵 ni solicitudes de decisión nuevas.
- No abrir otro PR de implementación dentro de esta PR documental. **En la PR futura** exigir pruebas E2E reales (no fabricar logs ni debilitar aserciones) sobre su SHA, con la allowlist solamente si la captura demuestra fuga.

**Conclusión:** la **revisión documental independiente** está cerrada **SIN BLOQUEANTES**. El merge del contrato/ficha queda a decisión humana de Lautaro073; **el revisor no aprueba ni mergea**. El commit de esta ronda mueve el HEAD y puede disparar CI de nuevo; no exigir nuevo CI green únicamente por el histórico de revisión o bitácora cuando el SHA documental del autor ya tuvo run success.

