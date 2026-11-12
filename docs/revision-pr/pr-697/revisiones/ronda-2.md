# Ronda 2 — PR #697 · T-432 / CC-049

**Fecha:** 2026-11-12 · **Head auditado:** `3406672db6e88c04c6603d8815b8ec81556dcbd8` · **Base:** `develop@9dafedab103cdfdd7eca0fa88cc38f2e319dc831`.  
**Veredicto: CON BLOQUEANTES (2).** Ronda 1 conservada intacta. Solo cuatro documentos cambiaron entre `c09c982d` y `3406672d`; el autor no tocó `docs/revision-pr/pr-697/`.

## Hallazgos anteriores

| ID | Estado de ronda 2 | Evidencia documental en SHA revisado |
|---|---|---|
| H01 | **Arreglado-verificado documentalmente** | `CC-049.md:218-229` y `T-432.md:85-92,118-120` separan GRANT y RLS con dos sondas independientes; grant temporal en subtransacción revertida; mutaciones específicas. |
| H02 | **PARCIAL · BLOQUEANTE** | `CC-049.md:65-72,143-154` cumple D5-C, sin DELETE de históricos y con limpieza posterior, pero `CC-049.md:232-236`/`T-432.md:96-98` prueban **reaplicación** en base ya migrada, no **primera aplicación**. |
| H03 | **Arreglado-verificado documentalmente** | `CC-049.md:88-100,165-168,244-250` especifica `generateRequestDetails` + `https.request`, `request.destroy()` y temporizador absoluto; test de flujo goteando, timeout, 3xx y limpieza del timer. |
| H04 | **Arreglado-verificado documentalmente** | `CC-049.md:81-87` define unión `sent/blocked` y omite `endpoint` en bloqueado; `T-432.md:101-106` exige `Object.hasOwn` y respuesta API. |

**Límite de la palabra “verificado”:** aquí solo se comprueba la especificación documental corregida contra el SHA; no se certifica SQL, TypeScript ni RED/GREEN de implementación inexistente.

## H02 — Prueba de preservación en el instante equivocado

**Archivos:** `docs/contracts/CC-049.md:232-236`, `docs/tasks/T-432.md:96-98`.  
**Categoría:** `P08-control-no-cubre-lo-que-dice` · **severidad alto** · **estado parcial**.

La reejecución de una migración en una base ya migrada no prueba que se conservaron filas durante su primera ejecución. Una migración defectuosa que borra filas solo la primera vez pasa la prueba de reaplicación. Este contraejemplo se ejecutó como modelo Node, NO como pgTAP, en `../evidencia/comandos.md`.

**Arreglo pedido:** especificar en el CC y en el DoD que el control debe:
1. Restaurar **una base local CI efímera** a la última migración anterior a CC-049 con `pnpm supabase db reset --version <pre-CC049> --no-seed`.
2. Sembrar **antes de aplicar CC-049 por primera vez** una fila histórica válida y una fuera de lista, con un perfil existente y sus IDs/valores esperados.
3. Ejecutar la migración original con `pnpm supabase migration up`, y exigir igualdad de ambas filas y de sus valores, no solo contar.
4. Mutar temporalmente en una copia aislada la primera migración agregando un DELETE de inválidas; restaurar otra vez la misma precondición y observar RED real de preservación; restaurar SQL sano y ver GREEN.
5. Restaurar el estado local para no afectar otros tests; el CI actual corre `cc035_concurrency.mjs` tres veces (estándar y dos modos de mutación): preparar el escenario pre-migración una sola vez, dentro del modo estándar ya invocado por CI, sin editar el workflow fuera de alcance.

El resto de D5-C (sin DELETE en la primera migración, no enviar hosts fuera de lista, inventario por conteos posterior y borrado con autorización) **sí está correcto**.

**Residuo:** `T-432.md:163-164` aún dice “un host fuera de ella solo puede venir del bypass”. Es falso como garantía, y contradice el motivo de D5-C (posibles históricos legítimos). Sustituir por una nota de hosts desconocidos que se preservan hasta clasificar.

## H05 — M01 no tiene matriz compartida ejecutable

**Archivos:** `docs/contracts/CC-049.md:207-216` y `docs/tasks/T-432.md:83-84`.  
**Categoría:** `P15-entregable-declarado-pero-no-ejecutable` · **severidad medio** · **bloqueante nuevo**.

La ficha exige “una tabla escrita una vez como datos explícitos (endpoint → esperado)” consumida por pgTAP SQL y Vitest TS. Sin embargo, el CC solo enumera **clases** de URL (host engañoso, puerto, backslash…), sin URL literal ni booleano esperado, y “Archivos permitidos” no contempla un nuevo fixture común o generador. No hay forma especificada de compartir literalmente una tabla de código entre ambos ejecutores; el agente se vería obligado a inferir casos, duplicar ocultamente datos o exceder el alcance.

**Arreglo mínimo sostenible sin archivos nuevos:** agregar en `CC-049.md` §Impacto exacto una **tabla canónica Markdown** con columnas `ID | endpoint literal | esperado (true/false)` para al menos 17 combinaciones, incluyendo 4 servicios válidos, mayúsculas, `:443`, sufijo host, userinfo, puerto incorrecto, `\\`, punto final, percent-encoding, IPv6, falta de `/`, `notify.windows.com` sin subdominio y dos niveles WNS. IDs estables.

En ficha y CC aclarar que es **una sola tabla normativa en el contrato**, pero en código se **replican los pares literales con expectativas fijas** en las suites SQL y TS existentes: no hay archivo JSON compartido en el scope actual. Está prohibido calcular el esperado usando el helper sometido a prueba. Si se quiere de verdad un fixture de datos importado por ambos lenguajes, requiere un archivo/mecanismo adicional permitido expresamente; esta ronda no lo autoriza.

**Prueba futura:** cada caso debe estar ejercido por pgTAP y TS con resultado conocido. Mutación de un helper que acepte `fcm.googleapis.com.evil.example` debe dejar **rojo** el test SQL y el TS correspondiente. No afirmar que se ejecutó ahora.

## Mejora M02 (no bloqueante)

`docs/tasks/log/T-432.md:17` describe D4-B y D5-C como decisiones “automáticas, opción recomendada”. En realidad **Lautaro073 seleccionó D4-B y D5-C expresamente** en la ronda 1. Corregir atribución sin cambiar valores.

## Falsos positivos descartados y controles

- La PR **es documental a propósito**; no falta implementación en esta PR. La futura implementación tendrá su propia revisión y pgTAP/HTTPS/E2E.
- `src/features/announcements/actions.ts` usa `attempts.length`: no necesita modificarse por H04.
- La fila T-432 de `docs/implementation-plan.md` coincide exactamente con el primer DoD y contempla `transport.test.ts`; los cuatro docs modificados están permitidos.
- D1-A, D2-A, D3, D4-B y D5-C permanecen cerradas. Sin preguntas nuevas a Lautaro073.

## Evidencia y límites

GitHub reportó head `3406672d`, base `9dafedab`, `mergeable:true`, y diff incremental solo en CC/ficha/fila/bitácora. Contraste estático independiente encontró H01/H03/H04 y coherencia DoD: **positivos**; cobertura de primera aplicación H02, matriz literal M01 y nota histórica precisa: **negativos**. El contraejemplo de reaplicación se ejecutó con Node v22.16.0 en `/tmp`, sin red ni PostgreSQL; las salidas están en `../evidencia/comandos.md`.

No se pudo clonar el repo por DNS: no se ejecutaron `git merge-tree`, `pnpm exec vitest run tools`, `typecheck`, `lint` ni `test:db`. Los **123/123** los declara el autor; no constituyen evidencia independiente. Por existir bloqueantes no se inspeccionó CI como criterio de readiness.

**Cierre:** H01, H03 y H04 arreglados/verificados **solo documentalmente**. H02 parcial y H05 abierto. M02 mejora. No aprobar ni mergear. El prompt acotado para agy estará en el comentario de cierre con este informe; ronda 3 debe revisar el próximo SHA.
