# Lecciones de la revisión — PR #56 / T-005

## 1. Esquemas privados para funciones internas de seguridad (`app_private`)
Al usar funciones auxiliares `SECURITY DEFINER` para evaluar condiciones de RLS entre tablas relacionadas (como verificar si un courier tiene oferta aceptada en un pedido), ubicarlas en un esquema dedicado (`app_private`) previene tanto la recursión cíclica de Postgres como la exportación innecesaria a `src/types/database.types.ts` cuando se corre `pnpm supabase gen types --schema public`. Esto mantiene los contratos de tipos intactos y evita violaciones de alcance en tareas que no autorizan modificar tipos generados.

## 2. Demostración explícita de fase roja en pgTAP
El DoD exigía demostrar que `rls_enabled.sql` falla ante una tabla sin RLS. Al no contar con Docker localmente, la demostración se ejecutó en dos pasos en CI: primero introduciendo temporalmente la tabla de prueba en el test y capturando el fallo en los logs de GitHub Actions (`35689605017`), y luego retirándola junto con la migración para dejar la suite en verde (`35690759854`).
