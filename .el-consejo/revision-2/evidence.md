# Evidencia de ejecución — revision-2 (plan de implementación para agentes)

- Fecha: 2026-09-17 · Comando: `revisar` · Protocolo: runtime-contract v1
- Candidato: `docs/implementation-plan.md` v1 (con la corrección D14 del pago del envío), copiado en `original.md`.
- Estado final: **CONDICIONAL** (7 dictámenes `conditional`; los 4 críticos y los conflictos humanos se resolvieron con override humano).

## Intake
- Pedido del usuario: "pasalo por el consejo solo activando los necesarios", con tareas divididas en 3 personas para trabajo simultáneo en GitHub, coordinación de la IA para trabajar en distintos momentos, buenas reglas, buen código y buenas prácticas.
- Pregunta crítica (una): cómo correr PM y Documentación por agy, dado el límite de 32k de Windows. Respuesta: "agy con el plan en partes".

## Selección (decisión del usuario, desvío declarado)
- Activados: pm, documentation, frontend, backend, qa, security; asesor devops (deployment, ci-cd, infrastructure, observability, rollback); juez.
- No activados, aunque el motor convoca a todos los permanentes: design, ux-ui, marketing, persona, legal, finance.

## Proveedores
| Rol | Proveedor |
|---|---|
| frontend, backend, qa, security, devops, judge | subagentes `consejo-*` de Claude Code |
| pm, documentation | agy, a través de `src/providers/antigravity` del motor |
| ensamblado | orquestador (Claude Code) |

## Desvíos respecto del lanzador
1. **Fuera del lanzador**, igual que en revision-1. No hay `recordRun`, caché ni `--resume`. Los 7 dictámenes pasan `validateRoleReview` y las 5 réplicas pasan la validación de `validateRebuttal`.
2. **Revisión por partes en agy.** PM y Documentación revisaron 5 partes del plan, un llamado por parte, con el índice completo en cada una. Después cada rol consolidó **su propio** dictamen en un sexto llamado por agy: eligió qué hallazgos conservar (`keep`) a partir de un resumen de sus dictámenes parciales, con los enunciados truncados a 300 caracteres. El texto final de cada hallazgo es el original de la parte; el código conserva siempre los críticos (no hubo críticos en estos roles). Registro en `reviews/parts/`.
3. **Schema más estricto en agy:** `conflicts[].parties` restringido a los ids activos. No hizo falta normalizar partes.
4. **Dictámenes de subagentes transcriptos** desde la notificación (el transcript no queda en disco), con las entidades HTML decodificadas.
5. **Réplica de PM por agy con compactación nivel 3:** sin el plan en el prompt y con los dictámenes de las partes **resumidos** (resumen hasta 400 caracteres, enunciado y corrección hasta 260 cada uno). Corrección de lo que se informó durante la corrida, donde se dijo que los dictámenes iban completos.
6. **Réplicas de DevOps y Frontend:** el primer intento se cortó por el límite de uso de la API sin devolver respuesta. Se reenviaron en la misma ronda.
7. **Semántica de `validateRebuttal`,** como en revision-1: se aceptan conflictos nuevos declarados en la réplica y entradas sobre ellos (`rebalance-fase3-p1-e2e` de Backend y `conf-codeowners-routegroup-p2-p3` de Frontend).
8. **Juez:** los 4 conflictos técnicos y reversibles se resolvieron en una sola sesión del subagente, con 4 decisiones separadas y cada una validada con `validateJudgeDecision`. El motor haría un llamado por conflicto; se pidió además coherencia explícita entre los fallos relacionados.
9. **Checkpoint con una aclaración:** el usuario no entendió la pregunta sobre respaldos, así que se explicó y se repitió. Sigue siendo el mismo checkpoint.
10. **Contenido agregado en el ensamblado sin revisión propia del Consejo** (deriva de hallazgos, pero su forma concreta es del ensamblado): archivos de `docs/agy-kit/`, protocolo con GitHub Project y PR en Draft, release semanal con capitán rotativo, fixtures de lint en T-000, umbral de cobertura del 90 %, Día 0 y simulacro de traspaso en T-001.

## Verificaciones hechas por el orquestador
- **Documentación integrada de agy** (`~/.gemini/antigravity-cli/builtin/skills/agy-customizations/docs/hooks.md` y `rules.md`, SKILL.md):
  - reglas en `AGENTS.md`/`GEMINI.md` por carpeta y en `.agents/rules/*.md`;
  - skills en `.agents/skills/<nombre>/SKILL.md`;
  - `hooks.json` en `.agents/`, cuyo comando corre con `cmd /c` en Windows desde la carpeta del `hooks.json`;
  - `PreToolUse` con `decision` `allow`, `deny`, `ask` o `force_ask`; `ask` respeta el caché de permisos.
- **`docs/agy-kit/.agents/scripts/agent-guard.mjs`:** 27 casos de comandos y 8 de rutas y entrada inválida, 35/35 OK. Un primer fallo se debió al escape de barras invertidas del shell en la prueba y no al script; se repitió desde un archivo.
- **Coherencia del plan v2:** criterio de aceptación exacto en la matriz, 42 tareas definidas, ninguna tarea citada sin definir, ninguna dependencia a una tarea inexistente, y cada tarea en el tablero de su dueño.

## Limitaciones
- PM y Documentación no vieron el plan completo de una sola vez, y PM replicó sin el plan y con dictámenes resumidos.
- Nada se verificó contra GitHub real: CODEOWNERS con paréntesis, Code Owners obligatorio y `concurrency` quedan como supuestos A1 a A4, a verificar en T-001 y T-003.

## Ajuste posterior (v2.1): equipo real
- El usuario aclaró que Lautaro073 es una de las 3 personas y la única con experiencia; las otras dos operan agy con sus cuentas en sus máquinas. Lautaro073 toma P1 más T-000, T-001 y T-003.
- Consecuencias aplicadas por el orquestador (no hubo nueva ronda del Consejo):
  - aprobaciones centralizadas: los PR de P2 y P3 los aprueba Lautaro073, y los de Lautaro073 los aprueba P2 o P3 con el informe de la skill nueva `revisar-pr`. Se hace cumplir con el check `approval-policy` (T-003);
  - se elimina el procedimiento de emergencia (break-glass);
  - se agrega la guía §3.8 para quienes tienen menos experiencia;
  - T-312 exige una revisión de seguridad independiente de migraciones y servidor.
- Fallos del Juez reabiertos por sus propias condiciones y ajustados sin nueva adjudicación, declarado:
  - `codeowners-spof-p1`, condición (a): no hay respaldo experto;
  - `rebalance-fase3-p1-e2e`, condición (b): P1 sin capacidad, así que T-305 y T-306 vuelven a P3 con el criterio del fallo.
- `conf-codeowners-routegroup-p2-p3`: la revisión del dueño de zona pasa a ser visto bueno de coordinación.
- Si se quiere validar este ajuste, corresponde otra corrida `revisar` acotada a §2, §3.8 y §7.

## Ajuste posterior (v2.2): stack, patrones y diseño
- Pedido del usuario: reglas claras de reutilización, escalado, raíz de carpetas, optimización, librería de componentes, control de estado y Zod; preferencias explícitas: shadcn/ui + Tailwind, Motion para animaciones, Skeleton y toasts con Sonner; diseño posterior con Stitch (MCP o prompts).
- Agregado por el orquestador, sin nueva ronda del Consejo:
  - regla `25-stack-y-patrones.md`;
  - reglas 20 y 60 ampliadas;
  - skills `implementar-diseno` y ajustes a `revisar-pr`;
  - T-000, T-003, T-008, T-204, T-205 y T-301 ajustadas;
  - §12 con el inventario de pantallas para Stitch.
- Supuestos a verificar al instalar:
  - la forma recomendada de `LazyMotion` y de los componentes livianos de Motion en la versión instalada;
  - la compatibilidad de `@serwist/next` con el bundler de la versión de Next.js;
  - que Stitch exporte en un formato que la skill pueda usar como referencia.
- Presupuestos (180 KB de first-load JS; Lighthouse ≥ 80 en rendimiento y ≥ 95 en accesibilidad): son valores iniciales del ensamblado, ajustables.
