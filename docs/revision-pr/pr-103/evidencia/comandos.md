# Evidencia — PR #103 / CC-008 / Ronda 1

## Preflight

```text
head: 4703cc2f71e7609e302c5cc79da563f2d58f0605
base: develop@ac4587f3c76f3ce8d63f3abbafff0847b89d9b54
ahead: 1
behind: 0
diff: docs/contracts/CC-008.md únicamente
comments: 0
threads: 0
```

## Inspección de contrato existente

```text
courier-docs: public=false
storage.objects: insert propio para courier; acceso admin para all
CC-007: app_private.is_active_operational_actor() es barrera funcional vigente
CC-008: no menciona ese gate en la SECURITY DEFINER propuesta
```

## Control ausente que debe agregarse

Mutación SQL propuesta para la futura suite pgTAP:

```sql
-- Romper a propósito el gate:
-- quitar AND app_private.is_active_operational_actor()
-- de get_trip_details.
-- Deben ponerse rojos al menos:
-- 1) merchant reconsent_required no obtiene fila
-- 2) courier pending/reconsent_required no obtiene fila
```

Si esa mutación no pone rojo el pgTAP, el control de consentimiento del CC no existe.

## Avatar

```text
docs/contracts/CC-008.md propone avatar_url
schema actual: avatar vive en courier_documents/storage_path
bucket courier-docs: privado
decisión Lautaro073: signed URL temporal server-side
```

CI no consultado por bloqueantes. No se levantó Supabase local.
