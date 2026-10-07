# Evidencia — PR #293

HEAD revisado: `dfb5fb1cf9db5013a322c11129b97b063a6ded8b`.

## Integración

```text
develop = 64dfdf653219c6cf08a223c0df829353d9d9d8f1
HEAD    = dfb5fb1cf9db5013a322c11129b97b063a6ded8b
ahead   = 1
behind  = 0
```

Archivos funcionales:

```text
docs/implementation-plan.md
docs/tasks/T-347.md
docs/tasks/log/T-347.md
```

## Hallazgo H01

Texto de la ficha:

```text
docs/tasks/T-347.md:48
Disparo: on: workflow_dispatch solamente

docs/tasks/T-347.md:51
Confianza: corre con el workflow de la rama por defecto,
así que la PR bajo prueba no puede reescribirlo.
```

El diseño seguro ya existente del repo separa:

```text
e2e-preview.yml
on: repository_dispatch
checkout trusted default branch en resolve
target SHA de PR validado como dato
checkout del SHA objetivo solo después de resolverlo
```

La ronda concluye que T-347 debe usar la misma propiedad de control plane.

## Decisiones

```text
0-B → repository_dispatch + event type específico + client_payload { target, mutation }
1-A → catálogo manifest/patches revisado en develop
2-A → next start en 127.0.0.1 dentro del runner
3-A → validación post-merge; reabrir/mantener #289 si no da RED_CONFIRMED
```

## CI del HEAD funcional

Run `37575457747`:

```text
lint          success
build         success
unit          success
typecheck     success
audit         success
db-tests      success
bundle-budget success
```

Vercel: success.

`approval-policy`: failure esperado porque la revisión independiente todavía tiene un bloqueante.

## Limitación de esta ronda

No se implementó T-347: esta PR solo crea la ficha. Por eso no corresponde ejecutar una mutación real ni validar todavía artifacts, payload parser o runtime `next start`.

La siguiente ronda debe revisar únicamente la corrección documental de H01 y las cuatro decisiones ya fijadas.
