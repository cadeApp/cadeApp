# supabase/ — zona de Lautaro073 (datos y servidor)

- Cambios acá: tareas de Lautaro073 o contract-change aprobado por él. Si sos persona2 o persona3 y la ficha no lo
  dice explícitamente, no toques esta carpeta: preguntá en el issue.
- Cada migración: un propósito, test pgTAP, checklist de seguridad del PR. Nunca editar una migración mergeada.
- Orden dentro de una migración: tipos/enums → tablas → índices → funciones → RLS/policies → grants.
- Toda función `SECURITY DEFINER`: `SET search_path = public, pg_temp`; `REVOKE ALL ... FROM public`; `GRANT EXECUTE ... TO authenticated`.
- `seed.sql` nunca contiene datos reales; usuarios de prueba con emails `@example.test`.
- Solo comandos locales (`pnpm supabase start`, `pnpm supabase db reset`). Los ambientes remotos los actualiza `migrate.yml`.
- Si Lautaro073 no está disponible, no se mergean cambios de esta carpeta (no hay procedimiento de emergencia).
