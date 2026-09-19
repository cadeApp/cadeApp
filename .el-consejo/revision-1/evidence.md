# Evidencia de ejecución — revision-1 (cadeApp)

- Fecha: 2026-09-17
- Comando: `revisar`
- Protocolo: runtime-contract v1 (INTAKE → SELECT → INDEPENDENT_REVIEW → REBUTTAL → ADJUDICATION → CHECKPOINT → ASSEMBLE)

## Intake (una ronda, respuestas de Lautaro)

- Ejecución: híbrida a mano. Roles de código como subagentes de Claude Code y el resto por agy.
- Ingresos: suscripción mensual para comercios y emprendedores.
- Zona: solo Aguilares, Tucumán, Argentina.
- Habilitación de repartidores: aprobación manual (DNI, selfie, vehículo).

## Selección

- Revisores permanentes (12): pm, frontend, backend, design, ux-ui, qa, marketing, persona, documentation, security, legal, finance.
- Juez: judge.
- Asesor condicional: devops, activado por los dominios deployment, infrastructure, backups y observability.
- `social-media`, `video` y `motion-graphics` no se activaron: no hay entregables de ese tipo.

## Reparto de proveedores (lo eligió el usuario)

| Rol | Proveedor |
|---|---|
| frontend, backend, qa, security, devops, judge | subagentes `consejo-*` de Claude Code |
| pm, design, ux-ui, marketing, persona, documentation, legal, finance | agy, a través de `src/providers/antigravity` del motor |
| ensamblado | orquestador (Claude Code) |

## Desvíos respecto del lanzador (declarados)

1. **Fuera del lanzador.** El motor no puede mezclar subagentes con agy, así que no hay registro de `recordRun`, caché ni `--resume`. Un script puente reutiliza piezas del motor: `loadCouncil`, `outputContractFor`, `validateRoleReview`, el texto `RULES` de `provider-bridge.mjs`, la constitución y el transporte agy. Los 13 dictámenes pasaron `validateRoleReview`.
2. **Dictámenes de subagentes transcriptos.** El transcript no queda en disco, así que el JSON final se transcribió de la notificación y las entidades HTML (`&gt;`, `&lt;`) se decodificaron.
3. **Partes no canónicas en agy.** agy devolvió `parties` que no son ids de rol ("finanzas", "PM", "Finanzas", "fundador", "human_checkpoint"). El motor habría abortado con "Conflict references an unavailable participant". Se mapearon a ids canónicos y se descartaron los que no son roles (ver `conflicts.json > partyNormalization`).
4. **Réplica: entradas sobre conflictos nuevos.** `provider-bridge.mjs` rechaza una entrada cuyo `conflict_id` no estaba entre los relevantes, pero `validateRebuttal` la admite si el conflicto se declara en la misma réplica. Se siguió `validateRebuttal` (caso DevOps).
5. **Réplica: conflictos nuevos.** `provider-bridge.mjs` descarta los `conflicts` que devuelven las partes y reenvía los originales, mientras que `validateRebuttal` admite conflictos nuevos. Se siguió `validateRebuttal`: entraron `push-notification-implementation-scope`, `devops-backup-vs-pii-retention` y `backup-retention-vs-pii-deletion`.
6. **Compactación por el límite de 32k de Windows (agy).** El pedido de réplica completo no entraba. finance, legal, marketing y ux-ui usaron nivel 1 (los dictámenes de las partes sin evidence, impact ni assumptions). pm usó nivel 4 (sin el plan y con dictámenes truncados a severidad y enunciado). Con el motor tal cual, la réplica de pm por agy fallaría.
7. **Schema de réplica más estricto en el segundo intento.** En el primer intento legal, marketing y ux-ui devolvieron entradas sin `conflict_id` o `summary`, y pm excedió la línea de comandos. Se reintentaron (la misma ronda, no hubo respuestas aceptadas) con `entries[]` obligando `conflict_id` y `summary`. Los errores quedaron en `rebuttal/failed-attempt-1/`.
8. **Finanzas no argumentó en la réplica.** Devolvió 0 entradas y repitió sus conflictos. Es válido por contrato y no se repitió.
9. **Ayudantes y skills opcionales.** No se usaron: los transportes no tienen acceso a skills y las reglas piden `helperRequests: []`.
10. **Fuentes legales y fiscales sin verificar.** Legal cita las leyes 25.326, 20.744, 24.449 y 24.240, y Finanzas una alícuota de IIBB de Tucumán del 3 al 5 %, sin consultar fuentes vigentes (agy corre sin herramientas). Por el gate de Legal, esas conclusiones quedan condicionadas a verificarlas.
