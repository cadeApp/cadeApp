# Lecciones — PR #658, ronda 1

**Fuente:** seis hallazgos por inspección de `3a396ee1`, contrastados con RED/GREEN/CI. Sin lecciones AG nuevas numeradas: se refuerzan reglas existentes y se evita atribuir numeración sin enumerar todas las ramas remotas.

## Refuerzo AG-37 — enumerar la clase y demostrar el invariante que realmente se protege

Los casos 13–16 de `cc047_admin_hardening.sql` ya pasaban sin migración: el trigger de T-340 rechazaba escrituras ajenas. No acusar el estado final como defecto funcional; el defecto es de cobertura del control RLS. Cuando hay controles superpuestos (policy y trigger), agregar un test de **catálogo** (`pg_policies`, `cmd <> 'SELECT'`, expresión que referencia `app_private.is_admin()`) con mutación de la policy, sin adulterar el trigger ni la prueba funcional.

## Refuerzo AG-75 — las mutaciones del autor no certifican cobertura independiente

La PR #659 probó seis mutaciones relevantes. No mutó `FOR UPDATE` ni un borrado pre-fixture. No reconstruir sus 18 fallos como propios. Proponer una carrera admin/admin que lea `audit_log.before` tras serialización, más inspección de código fuente de la migración. Las pruebas estáticas propias son evidencia **estática**, no de base.

## Refuerzo P06 y AG-37 — combinaciones de requisitos no equivalen a un solo `AND`

D3 exige actor, nivel de MFA y columna separados. Consolidarlos en una sola aserción puede perder señal diagnóstica o saltarse una combinación. En SEC-11, nota igual, distinta y reescrita son tres historias distintas, no sinónimos.

## Decisiones y no-falsos-positivos

- D01=B es una mejora de minimización de datos: denegar `rate_limits` a clientes incluso al admin con `aal2`, manteniendo al menos una policy para `rls_enabled.sql`.
- D02=A valida las adaptaciones de `cc043` y scripts `cc025`/`cc033` porque las antiguas expectativas dependían de la policy de escritura eliminada.
- Los triggers de T-340 siguen siendo defensa real: no pedir una mutación que los desactive para fabricar rojo en `cc047`.
- No pedir un pgTAP imposible sobre datos anteriores a la migración. La consulta y la revisión manual de notas históricas siguen siendo obligaciones de promoción humana.
- No convertir el `e2e-preview` bloqueado por migración, según runbook, en falso error de código. Registrar el E2E de staging pendiente.

**No cambiar AGENTS.md solo por esta PR.** La ronda 2 deberá contrastar los controles nuevos con mutaciones propias que intenten escapar de cada control.

## Ronda 2 — confirmaciones y nueva lección sin número AG

**H01–H06:** el autor implementó lo pedido y la CI demostró respuestas específicas a mutaciones. La revisión independiente leyó el código y la ejecución de CI, y corrió su propia batería estática contra el mismo SHA. No atribuir los mutantes #660–#662 a la revisión.

**H07 — complemento a pr-68/AG-75 + pr-56/AG-37.** La propia R1 del revisor pidió una policy `rate_limits_select_admin USING(false)` y un catálogo que detectara `is_admin()` sobre DML. Eso deja una clase fuera: policies de escritura genéricas (`FOR INSERT WITH CHECK(true)`), incluso si el objetivo `rate_limits` es «solo RPC». La forma sostenible es agregar un control estructural por tabla que cubra **todas las operaciones incompatibles con su contrato**, independientemente de nombre, predicado o rol. Además, probar INSERT real como `authenticated` cuando el DoD nombra la exclusividad de RPC.

> **Refuerzo de regla listo para adoptar cuando se repita en otra PR:** «Para tablas internas manejadas solo por SECURITY DEFINER, los tests deben exigir cero policies de DML directo en `pg_policies` y ensayar al menos una escritura cliente (INSERT como actor con grant aplicable). Una aserción que solo busca el helper admin no garantiza ausencia de policies permisivas alternativas.»

**Límite de evidencia:** no afirmar CI GREEN de una mutación que nunca se ejecutó en PostgreSQL. La mutación H07 fue comprobada solo mediante lectura y simulación estática del instrumento. La siguiente ronda debe corroborar con PR de mutación aislada.

**Cuidado con numeración:** no añadir `AG-xx` nuevo sin inspeccionar los máximos de todas las ramas remotas; este refuerzo conserva las referencias con su carpeta. Ronda 2 no modifica AGENTS.md.


## Ronda 3 — H07 cerrado con mutación de una clase realmente distinta

- Se añadió el control por **tabla y operación**, no por nombre ni predicado: `pg_policies.tablename='rate_limits' AND cmd <> 'SELECT'`. Es robusto frente a `INSERT WITH CHECK(true)` aunque la policy no contenga `is_admin()`.
- El autor mantuvo el test general H02 y agregó tres oráculos funcionales para los actores admin `aal1`, admin `aal2` y courier `aal1`, **rechazo por SQLSTATE y ausencia de filas persistidas**. La mutación aislada #663 confirmó que `authenticated` tenía permiso INSERT (los tres clientes realmente insertaron con policy permisiva). RLS era la barrera y el nuevo control la protege.
- La ejecución de los mutantes en CI corresponde al **autor**; el revisor contrastó de forma independiente SHA, diff, pruebas, logs y una batería propia estática. No atribuirse ejecución PostgreSQL propia.
- **Patrón P08 prevenido:** enumerar el universo de operaciones permitidas en cada tabla RPC-only, no inferirlo de una negativa de SELECT ni de que una policy no contenga el nombre del helper administrativo.
- H01–H07 todos cerrados. **No agregar otra regla AG por una sola PR**; este caso refuerza las referencias AG-37/AG-75 ya documentadas. No confundir «sin bloqueantes de código» con «E2E de staging realizado»: la promoción exige sus gates humanos.
