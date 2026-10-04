# PR #242 — T-325 hotfix · Feed pending + perfil con documentos reales

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/242 |
| **Tarea** | T-325 hotfix · issue #241 |
| **Autor** | @Lautaro073 |
| **Rama** | `fix/T-325-feed-real-documents` → `develop` |
| **HEAD R3** | `320bab2cc25c2a772dad4c0826345c3be47e1e44` |
| **develop actual** | `3e5d5381dbf59717763f1927e1cf080504a9ebf1` |
| **Estado** | **Ronda 3 · CON BLOQUEANTES (2)** |

## Rondas

| Ronda | SHA | Resultado |
|---|---|---|
| 1 | `ddf7f5991257f98b2371f8f51659ea9d6e6d1c87` | H01–H03 abiertos |
| 2 | `3c469698bd551cd42022b3388562b935431e2999` | H01–H03 cerrados; H04 abierto |
| 3 | `320bab2cc25c2a772dad4c0826345c3be47e1e44` | H04 cerrado; H05–H06 abiertos |

## Estado

| ID | Sev. | Estado | Resumen |
|---|---|---|---|
| PR242-H01 | alto | arreglado-verificado | page → documentos reales |
| PR242-H02 | medio | arreglado-verificado | sin CTA circular |
| PR242-H03 | medio | arreglado-verificado | authError no se degrada |
| PR242-H04 | medio | arreglado-verificado | evidencia/bitácora del feed cerradas |
| PR242-H05 | alto | abierto | la rama diverge de T-334 y hoy pierde `onboardingComplete` |
| PR242-H06 | medio | abierto | cambios autorizados de perfil sin evidencia de navegador del head combinado |

## Alcance

Lautaro073 confirmó explícitamente durante Ronda 3 que las ampliaciones de `/courier/profile` fueron autorizadas. No se consideran desvío de alcance.

La fuente documental elegida es válida: `admin_verify_document` actualiza `courier_documents.status` y también los campos espejo de `couriers`; leer `courier_documents` permite mostrar `submitted` antes de la revisión admin.

## Estado de rama

Contra el `develop` actual:

- ahead: 8
- behind: 1
- status: diverged
- GitHub: **mergeable=false**

El commit que falta es T-334 (#240), que modificó exactamente `profile/page.tsx`, `courier-profile-view.tsx` y sus tests.

No mergear hasta integrar `develop`, preservar ambos contratos y revalidar el SHA resultante.
