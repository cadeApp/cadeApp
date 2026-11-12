# Lecciones — PR #709 · ronda 1

## Clases completas revisadas

- **Acceso administrativo a postulaciones:** `admin_list_applicants` (filtra `pending` sin envío), `getApplicantDetail` por UUID, visor con aal2; no hay búsqueda documentada que una soporte ↔ UUID del reclamante. Aplicación de `pr-56/AG-37`: considerar **todas** las superficies de lectura, no asumir que «puede abrir el detalle» implica «puede encontrar la fila».
- **Auditoría de eventos nuevos:** escritura SQL `audit_log`, lectura `getApplicantAuditRows`, mapeo `toAuditLogItem`, allowlist `AUDIT_REASON_ACTIONS`, presentación `AUDIT_CHANGE_FIELDS` y `ADMIN_COPY.audit.actions`. El evento existe en SQL propuesto pero se perdería semánticamente en la UI. Reutiliza `P08-control-no-cubre-lo-que-dice`.
- **Frontera Server/Client para soporte:** página SSR `/courier/onboarding/vehicle`, `VehicleForm` cliente, helper soportado `@/features/merchants/server`, enrutamiento sin número. Ningún cliente debe leer `CADEAPP_SUPPORT_WHATSAPP_NUMBER`.
- **Cupo con dos transacciones:** consumir en sesión primero, `finalize` service_role después. Un test aislado del contador NO prueba el consumo del error final; exigir integración y mutación específica.

## Proceso y responsabilidad

- En una PR documental, **defecto de contrato/DoD** ≠ defecto de implementación ya verificado. No presentar tests RED futuros como si se hubieran ejecutado ni convertir los 123 tests declarados por el autor en evidencia propia.
- Decisión recomendada tomada automáticamente por un interlocutor bajo autorización permanente **no equivale** a «Lautaro aprobó expresamente en esta sesión». Conservar esa procedencia en CC, ficha y log.
- No se numera un `AG-xxx` nuevo en esta ronda: son instancias de patrones existentes (`pr-56/AG-37`, `pr-68/AG-74` para concurrencia y `P08`). Evita colisiones con las ramas remotas (la numeración global debe comprobarse en Git antes de añadir una lección nueva).
- Un revisor de un CC no implementa los cambios grandes que después tendrá que verificar. El prompt de corrección ahora toca cuatro documentos; no hay commit de SQL ni tests de producción en esta PR.
## Ronda 2 — ventana horaria y JSON de RPC

- **H07 (nuevo, alto):** el contador por `(subject, action, window_start)` no es por día si el cliente influye en `TimeZone`. Un `date_trunc('day', now())` aparentemente inocuo se vuelve un parámetro indirectamente controlable con `Prefer: timezone` de PostgREST. Recomendación generalizable: ventanas de rate limit deben fijar zona del servidor dentro de la RPC y tener prueba con cambio de sesión. Patrón `P08`. Fue un **agujero de la revisión R1**: en R1 se validó concurrencia y rollback sin revisar la dimensión `TimeZone`.
- **H08 (nuevo, medio):** todo `returns jsonb` compartido con dominio debe fijar el envelope (objeto vs array, vacío, nombres), y separar parses peligrosos según ruta de validación (UUID nunca se castea a partir de teléfono). Patrón `P11`. La prueba de búsqueda por teléfono ya estaba pedida, pero el CC no daba forma SQL inequívoca.
- **H09 (mejora):** el cuerpo de PR y la matriz de invariantes también son fuentes de verdad: tras una ampliación (dos → tres RPC), actualizar los resúmenes sin borrar el histórico de autorrevisión.
- **No se crea AG nuevo:** estos defectos se alinean con `P08` y `P11` ya conocidos; la numeración global de reglas/AG no se ha verificado contra todas las ramas remotas. Aplicar a AGENTS si aparece evidencia transversal adicional (o severidad crítica confirmada).
- Los seis arreglos R1 se verificaron **solo como especificación textual**, no como código ejecutado. La distinción aparece en `verificado_metodo` de cada registro.
