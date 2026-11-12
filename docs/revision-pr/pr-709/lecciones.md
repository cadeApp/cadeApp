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
