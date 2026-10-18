# Lecciones — PR #410 / T-355

- **P08 reincidente:** la prueba de payload manipulable debe demostrar *cero escrituras*, no solo un código de error. Espías sobre la tabla de mutación, no sobre tablas irrelevantes.
- **RLS es barrera final:** bloquear un control de UI o acotar una action no basta cuando se puede operar `public.profiles` directamente; la decisión B origina CC #412. Cuidar compatibilidad merchant/admin.
- **Logs de datos personales:** `error.message` de DB es contenido no fiable y potencialmente sensible. Probar con error contaminado, no solo «connection failed».
- **Proyección mínima:** un booleano basta para «DNI en legajo». No enviar prefijo de HMAC al cliente.
- **Evidencia es distinta a checkbox:** CI unit verde no equivale a E2E Preview ni a mutaciones RED→GREEN. No adulterar tests para hacer verde.
- **No se asigna AG nuevo** hasta ejecutar una batería propia en ronda posterior y hallar el máximo AG en TODAS las ramas remotas. Evitar duplicados y lecciones no verificadas.

Todos los riesgos funcionales aquí requieren confirmación RED en la próxima ronda. Estados de CI/Preview fueron revisados en logs.
