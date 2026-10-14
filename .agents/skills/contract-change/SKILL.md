---
name: contract-change
description: >-
  Usar cuando una tarea de cadeApp necesita cambiar un contrato compartido (src/domain, rpc-contracts,
  esquema o RPC, src/ui, platform_settings) o cuando la RPC real y el dominio no coinciden.
---
# Cambio de contrato

1. Detené la tarea actual (skill `cerrar-sesion`) y avisá a la persona.
2. Rama `cc/CC-nnn-<slug>` desde develop. Copiá `docs/contracts/_plantilla.md` a `docs/contracts/CC-nnn.md`
   (nnn = siguiente número libre) y completalo: contrato, actual vs. propuesto, motivo, tareas afectadas,
   impacto en D1–D14.
3. Pedile a la persona que abra un issue con label `contract-change` y marque `bloqueada` las tareas afectadas.
4. Reglas de decisión:
   - Dominio y RPC no coinciden: NO gana nadie por defecto. Lo valida P2 (dueña de `src/domain`) junto con P1.
   - Si el cambio altera una decisión D1–D14 o un comportamiento que ve el usuario: decide Lautaro073 antes del merge.
   - Nunca se debilita un chequeo de seguridad de la RPC o de RLS para que coincida con el dominio.
5. Reglas de contenido (T-341). Antes de pedir el merge, el CC tiene que cumplirlas todas; cada sección
   «Obligatoria» de la plantilla se completa o dice «no aplica» con el motivo:
   - **Cero decisiones de producto abiertas.** Un CC con decisiones abiertas que cambien comportamiento observable no
     se mergea: se preguntan a Lautaro073 y se registran en «Decisiones de producto» con fecha.
   - **Helper de base interno** (`app_private.*` u otro): declarar permisos explícitos (`security definer/invoker`,
     `search_path`, `revoke all … from public, anon, authenticated`, sin `grant` a clientes), qué RPC lo llaman y sus
     validaciones defensivas. El Impacto exige pgTAP de que los clientes no pueden ejecutarlo.
   - **Operación transaccional** (cambia estado, asigna, cobra cupo): definir idempotencia (qué devuelve un reintento y
     si emite eventos), locks y su orden respecto de las RPC existentes, y las carreras relevantes, con sus pruebas.
   - **Esquema consumido por una UI que ya se puede desplegar:** definir un rollout compatible hacia atrás (qué pasa con
     la UI vieja contra el esquema nuevo), backfill, el orden de despliegue y la condición para retirar la
     compatibilidad.
   - **Campos que solo cambian las RPC:** barrera real en PostgreSQL. Un `with check` que solo evalúa la fila nueva
     **no** congela un campo. Vale revocar el `update` de tabla y conceder `update` solo sobre las columnas permitidas,
     o una policy o helper que compare explícitamente el valor nuevo contra el previo con un patrón probado (subselect
     sobre la fila vigente o trigger que compare `OLD` y `NEW`). En los dos casos, un test de bypass por campo.
   - **Invariantes y fuentes de verdad:** completar la sección de la plantilla revisando `AGENTS.md`,
     `docs/master-plan.md`, las decisiones D relevantes, los schemas y RPC compartidas y las reglas de privacidad y
     seguridad. Si el CC es incompatible con alguna, no puede decir que la cumple: la actualiza en la misma PR (con
     autorización de Lautaro073 para `AGENTS.md` o `.agents/**`) o abre el cambio documental coordinado. Ninguna
     tarea bloqueada empieza con fuentes de verdad contradictorias.
   - **Privacidad:** matriz de exposición por actor, antes y después de cada transición (D3).
   - **Verificar contra el repo:** cada afirmación de «Actual» se contrasta con el código (archivo:línea), y cada
     setting nuevo se suma a todo su contrato (dominio, SQL, admin, formulario).
6. **Antes de cerrar el CC, reconciliar** «Impacto exacto en la tarea» con la ficha de cada tarea bloqueada:
   «Archivos permitidos» tiene que cubrir cada archivo y suite, y el DoD cada prueba exigida. Si la ficha no
   coincide, se corrige la ficha (por PR) antes del merge del CC.
7. El PR del contract-change se mergea antes que las tareas afectadas; después se desbloquean y se retoman
   con la skill `retomar-tarea`.
