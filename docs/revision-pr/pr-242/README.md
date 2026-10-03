# PR #242 — T-325 hotfix · Feed pending con documentos reales

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/242 |
| **Tarea** | T-325 hotfix · issue #241 |
| **Autor** | @Lautaro073 |
| **Rama** | `fix/T-325-feed-real-documents` → `develop` |
| **Base revisada** | `b4119ef3e16170decda0a1649fc35db207faa8b0` |
| **SHA funcional revisado** | `ddf7f5991257f98b2371f8f51659ea9d6e6d1c87` |
| **Estado** | **Ronda 1 · CON BLOQUEANTES (3)** |

## Alcance

La ficha de `develop` todavía no contiene el hotfix y la rama la amplía a archivos de `offers/feed`. No se registra A01 porque el issue #241 fue creado por `Lautaro073` y documenta explícitamente la decisión de resolverlo como hotfix de T-325 con `StatusView` + `getCourierDocumentsStatus`. La ampliación de producto ya tiene decisión de P1; la revisión controla que la expansión técnica quede acotada.

El SHA revisado está **1 commit adelante / 0 atrás** de `develop` y GitHub lo reporta mergeable. El autor no creó ni tocó `docs/revision-pr/pr-242/**`.

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `ddf7f5991257f98b2371f8f51659ea9d6e6d1c87` | 3 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Hallazgos

| ID | Sev. | Estado | Resumen |
|---|---|---|---|
| PR242-H01 | alto | abierto | Los tests prueban `CourierFeed(documents=...)`, no que la página productiva lea/pase `courier_documents` |
| PR242-H02 | medio | abierto | Reusar `StatusView` dentro de `/courier/feed` agrega un CTA que navega a la misma ruta |
| PR242-H03 | medio | abierto | Un error de `auth.getUser()` se degrada a `documents=[]` y muestra estados falsos |

## No auditado todavía

CI detallado se difiere hasta que no queden bloqueantes, conforme al protocolo. El comentario de Vercel indica cuota diaria agotada; no se interpreta como defecto de código.

## Entorno de revisión

El contenedor de revisión no pudo resolver `github.com` por DNS, por lo que no hubo checkout local ni se inventan ejecuciones RED/GREEN. La inspección se hizo sobre blobs/patches del SHA remoto exacto. Las mutaciones independientes a reproducir están en [`evidencia/comandos.md`](evidencia/comandos.md).
