# Lecciones — PR #587 (T-421, CC-043/044)

## Patrón común

El contrato se escribió para un marcador operativo (`vehicle_type`) que pronto dejará de significar «envío completo». El diseño final D01-C/D02-C exige **enumerar a todos los consumidores de ese marcador** antes de iniciar la migración, no solo la RPC nueva.

## Lecciones existentes aplicadas (sin nueva numeración AG)

- **AG-37:** enumerar la clase entera antes de cerrar un hallazgo; en esta PR incluye `updateSession`, login, updatePassword, guard, cola, registros históricos, seed y resets E2E.
- **AG-71:** comparar todo lo que cambia en develop; CC-042 puede cambiar el orden del onboarding.
- **P08:** no declarar idempotencia verde sin probar el histórico `application_submitted=true,submitted_at=null`.
- **P20:** cuando se dice «solo aal2», aclarar la **vía**: la RPC no cierra las policies directas.
- **AG-60:** si una mutación no mata la aserción correcta, arreglar el instrumento antes de declarar cobertura. El primer control de texto MFA encontró otra mención a `assert_admin_aal2()` y parecía ciego; se ajustó el patrón a la cláusula específica de grants, obteniendo 8/8.

No agregamos un número AG nuevo: es una PR de diseño documental y no se pudo enumerar el máximo de todas las ramas remotas como pide el protocolo.

## Reglas de diseño que conviene conservar

1. `submitted_at` significa «primer envío real y verificable»; nunca fecha de alta ni fecha de reintento.
2. La fecha histórica desconocida sigue siendo desconocida, aun con `application_submitted=true`.
3. Custom GUC transaccional es mecanismo de coordinación, no prueba criptográfica de autoría.
4. Cuando una columna pasa a ser fuente de verdad, revisar **guard + login + recuperación + UI + E2E/seed**, no solo quien la escribe.

## Advertencias

Se detectaron riesgos del diseño futuro por inspección; no se ejecutó SQL ni se declaró bypass explotable desde la API. No trasladar «RED confirmado de texto» a «RED confirmado de seguridad».

## Ronda 2 — evolución y huecos encontrados

- **H01–H07:** el autor corrigió el contrato y amplió la ficha; se reconocen resueltos en **documentación**, sin declarar probada ninguna migración. La guarda de H04 (GUC + dueño de la función) es más sólida que un flag aislado y la limitación del rol privilegiado quedó explícita.
- **PR587-H08:** el reviewers anterior no había enumerado la **clase de transiciones de rollout**: schema nuevo + acción vieja + lectores nuevos. No basta afirmar que migrate precede al deploy; un éxito del writer viejo puede dejar el nuevo marcador falso. **Lección:** diseñar y probar el par expand/contract, incluida la versión anterior de cada escritor.
- **PR587-H09:** un escritor `service_role` puede no pasar por la validación Zod del formulario. **Lección:** al mover una escritura crítica a una RPC privilegiada, trasladar los invariantes de las columnas al SQL, aunque el cliente existente ya valide.
- **No agregar aún AG nuevo:** una PR documental sola no constituye un patrón repetido en múltiples PRs. Candidatos: P08 y AG-37 ya existentes.

## Ronda 3 — cierre sin nuevos patrones

- **H08** necesitó enumerar no solo el writer de la nueva versión, sino el exacto `UPDATE` del writer que quedará un corto tiempo con esquema migrado. La guarda fail-closed evita éxito silencioso. No confundir el **fallo controlado** durante despliegue con una postulación completada.
- **H09** recibió una definición SQL de la patente derivada de `ARGENTINA_PLATE_REGEX`, que debe probarse en PostgreSQL en la implementación. Validación Zod = ayuda UX, **no** garantía de base de datos.
- **H01–H09** se cierran **documentalmente**, no como prueba runtime. El diseño puede aprobarse sin confundirlo con código auditado. El autor no debe tocar `docs/revision-pr/**` al implementar T-421.
- Candidatos existentes AG-37/P06 y P08 son suficientes. No se crea regla AG nueva ni se modifica `AGENTS.md` por una sola PR.
