# T-xxx — <título>

- **Zona / dueño:** P? · **Issue:** #<n> · **Fase:** ?
- **Dependencias (mergeadas en develop):** T-..., T-..., CC-... (si aplica)
- **Contratos a leer:** `src/domain/...`, RPC `...`, tablas `...`, primitivas `src/ui/...`, `docs/contracts/CC-nnn.md`

## Objetivo
<qué cambia para el usuario o el sistema, 2-3 líneas; referencia a §x del master plan>

## Reconciliación de contratos
<!-- Obligatoria si la tarea depende de un CC. Si no depende de ninguno, escribir «No aplica: no hay CC». -->
- **CC requerido:** CC-nnn (#issue, PR #n) · **Estado:** en revisión | mergeado en <sha>.
- **No se puede empezar** hasta que el CC esté mergeado. Al tomar la tarea se compara esta ficha con la versión
  mergeada del CC (skill `tomar-tarea`).
- Cada archivo y suite del «Impacto exacto en la tarea» del CC está cubierto por «Archivos permitidos».
- Cada comportamiento y prueba que exige el CC aparece en el DoD.
- **Decisiones abiertas del CC: 0.** Si hay alguna, la ficha no está lista.

## Checklist de esquema/RPC
<!-- Obligatorio si la tarea toca supabase/migrations, RPC, RLS o tipos generados. Cada punto: cómo se cubre, o «no aplica» con el motivo. -->
- [ ] **Compatibilidad de rollout:** la UI ya desplegada sigue funcionando contra el esquema nuevo, o el orden de
      despliegue está definido.
- [ ] **RLS y permisos:** policies, grants por columna, `security definer/invoker`, `search_path`, helpers internos
      sin `execute` para clientes.
- [ ] **Idempotencia y concurrencia:** resultado de un reintento, locks y su orden, carreras relevantes.
- [ ] **Privacidad y exposición:** qué ve cada actor antes y después de cada transición (D3).
- [ ] **Migración y backfill:** idempotentes, con datos existentes probados.
- [ ] **Contratos TypeScript:** `src/domain/**`, `rpc-contracts.ts`, `errors.ts`, `src/lib/error-messages.ts`.
- [ ] **Fake de dominio** actualizado.
- [ ] **pgTAP:** caso feliz, cada código de error, actor incorrecto, estado incorrecto, concurrencia y bypass directo.
- [ ] **E2E** del flujo afectado.

## Archivos permitidos
- `ruta/**`
- (de otra zona, con subruta concreta) `ruta/de/otra/zona/**` → revisa: P?

## Fuera de alcance
- ...

## Dependencias nuevas permitidas
- ninguna | `paquete@versión` (motivo)

## DoD
- [ ] Pruebas: <casos concretos, incluidos bordes, y qué regla se rompe para verlas fallar>
- [ ] RED de cada prueba nueva demostrado por el comportamiento real que falta (ver «Regla de pruebas»)
- [ ] `pnpm typecheck && pnpm lint && pnpm test` (`&& pnpm test:db` si aplica)
- [ ] Sin cambios fuera de "Archivos permitidos"
- [ ] Bitácora `docs/tasks/log/T-xxx.md` al día y PR con evidencia

## Regla de pruebas
La evidencia RED tiene que fallar por el comportamiento real que falta. Está prohibido fabricar RED o GREEN:
- comentando código;
- adulterando expectations;
- agregando ramas `if (test)`;
- usando mocks que eviten el camino de producción;
- debilitando una aserción solo para que pase CI.

Una **mutación** que rompe a propósito la regla para demostrar que el test la protege es válida, con estas condiciones:

- **Preferido:** una mutación local temporal, restaurada y sin commit, si con eso alcanza. Se describe en la bitácora
  con la mutación exacta y las líneas resumen de RED y GREEN.
- **Si hace falta evidencia de CI** (por ejemplo `pnpm test:db` o `e2e-preview`, que no corren en local):
  - se usa una rama y PR **aislada** `review/T-xxx-<mutacion>`, marcada en el título y en el cuerpo como
    **`REVIEW ONLY / NEVER MERGE`**;
  - el commit mutado nunca se mezcla con la rama de la tarea;
  - se registran en la bitácora el SHA mutado y el run de CI como evidencia;
  - después de capturar la evidencia, la PR de mutación se cierra sin mergear;
  - la rama real queda con el código correcto.

- **Si la mutación quita un control de seguridad y la evidencia es E2E** (por ejemplo MFA, autorización o
  deduplicación en `src/**`): **no** se usa una PR `review/...` con el código mutado, porque Vercel lo desplegaría en
  un Preview público. Se usa el workflow `e2e-mutation` (T-347): la mutación entra como patch revisado en
  `e2e/mutations/`, corre en el runner trusted contra un build en `127.0.0.1` y solo cuenta `RED_CONFIRMED`. Detalle
  en `e2e/AGENTS.md`.

Sigue prohibido:
- adulterar tests o debilitar expectations;
- mocks que eviten el camino de producción;
- ramas `if (test)`;
- dejar la mutación en la PR real;
- mergear una mutación.

## Notas para quien retome
<riesgos conocidos, decisiones ya tomadas en la ficha>
