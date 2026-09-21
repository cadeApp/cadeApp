## [T-xxx] <título>

Closes #<issue>

### Qué cambia
<2-4 líneas, con referencia a la ficha docs/tasks/T-xxx.md>

### DoD (copiado de la ficha; marcar solo lo verificado)
- [ ] ...

### Evidencia de checks
```
pnpm typecheck && pnpm lint && pnpm test
pnpm test:db (si aplica)
```
<pegar salida o enlace al run de CI>

- [ ] Cada prueba nueva se demostró fallando al romper la regla (ver bitácora)
- [ ] Bitácora `docs/tasks/log/T-xxx.md` al día

### Informe de revisión de agy (obligatorio; lo verifica `approval-policy`)
<!-- Pegá acá el informe completo de la skill revisar-pr. Si el PR es de Lautaro073, lo genera quien aprueba. -->

### Rutas de otra zona (si hay)
| Ruta | Dueña de la zona (visto bueno) |
|---|---|

### Dependencias nuevas
- ninguna | paquete@versión (listada en la ficha)

### Checklist de seguridad (obligatorio si toca supabase/, src/server/, .github/, .agents/ o package.json)
- [ ] RLS habilitada y policies explícitas; nada con `USING (true)` sin justificación
- [ ] Funciones SECURITY DEFINER con search_path fijo, grants mínimos y chequeo de auth.uid()/rol
- [ ] Ningún secreto, dato del destinatario ni documento en código, logs, tests o payloads
- [ ] Workflows: Actions fijadas por SHA; sin exponer secretos en logs
- [ ] Ningún check, regla de lint o umbral de CI debilitado

### Rollback
<cómo se revierte si falla en staging/producción>
