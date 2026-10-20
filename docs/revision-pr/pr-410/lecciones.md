# Lecciones — PR #410 / T-355

- **P08 reincidente:** la prueba de payload manipulable debe demostrar *cero escrituras*, no solo un código de error. Espías sobre la tabla de mutación, no sobre tablas irrelevantes.
- **RLS es barrera final:** bloquear un control de UI o acotar una action no basta cuando se puede operar `public.profiles` directamente; la decisión B origina CC #412. Cuidar compatibilidad merchant/admin.
- **Logs de datos personales:** `error.message` de DB es contenido no fiable y potencialmente sensible. Probar con error contaminado, no solo «connection failed».
- **Proyección mínima:** un booleano basta para «DNI en legajo». No enviar prefijo de HMAC al cliente.
- **Evidencia es distinta a checkbox:** CI unit verde no equivale a E2E Preview ni a mutaciones RED→GREEN. No adulterar tests para hacer verde.
- **No se asigna AG nuevo** hasta ejecutar una batería propia en ronda posterior y hallar el máximo AG en TODAS las ramas remotas. Evitar duplicados y lecciones no verificadas.

Todos los riesgos funcionales aquí requieren confirmación RED en la próxima ronda. Estados de CI/Preview fueron revisados en logs.


## Ronda 2 — 2026-10-18

- No confundir **aprobación de CI funcional** con cumplimiento de las **reglas estáticas del repositorio**: la PR añadió `as any` y 3 non-null assertions en tests y E2E y pasó typecheck/lint. Si este patrón reaparece, automatizar una regla AST enfocada en líneas nuevas.
- La integración de CC-031 fue resuelta en una PR distinta; el autor hizo merge normal de `develop`, resolviendo H02 sin SQL duplicado en T-355.
- E2E separado **en progreso** no es FAIL ni PASS. El informe debe anclarse al run y distinguir código E2E correcto por inspección de persistencia realmente ejercitada.
- Un cast `as never` nuevo en un UPDATE que solo toca phone es deuda de tipado si se podía expresar mediante tipo `profiles.Update`; no inventar un fallo de seguridad mientras su payload siga cerrado y RLS proteja la fila.

## Ronda 3 — 2026-10-18
- El bloqueante de código H09 se solucionó exactamente como se solicitó, sin inventar casos, y se contrastaron las líneas más recientes con CI `typecheck/lint/unit` verde.
- Distinguir el **test E2E específico que pasó** del **gate E2E global cancelado**: este caso tiene un test T-355 `✓` en un job `cancelled`, y la suite puede tener otros fallos independientes.
- Subir un timeout de 30 a 45 minutos evita ese corte en ejecuciones nuevas, pero **no corrige otros `✘`**. No convertir un problema de tiempo en un certificado de que toda la suite es verde.
- Guardar el SHA del workflow confiable de `develop`, distinto del SHA objetivo de la PR, para explicar por qué un run usa la versión de 30 minutos aunque `develop` ya tenga la de 45.
