# PR #242 — T-325 hotfix · Feed pending + perfil con documentos reales

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/242 |
| **Tarea** | T-325 hotfix · issue #241 |
| **Autor** | @Lautaro073 |
| **Rama** | `fix/T-325-feed-real-documents` → `develop` |
| **HEAD R4** | `c14fead12f0e42ecf42216b1de9b8ea2f3546907` |
| **SHA funcional combinado** | `ef40e47e8c5c6f7bd7b9850fc40fa88e626e67b3` |
| **develop integrado** | `3e5d5381dbf59717763f1927e1cf080504a9ebf1` |
| **Estado** | **Ronda 4 · CON BLOQUEANTE RESIDUAL (1)** |

## Rondas

| Ronda | SHA | Resultado |
|---|---|---|
| 1 | `ddf7f5991257f98b2371f8f51659ea9d6e6d1c87` | H01–H03 abiertos |
| 2 | `3c469698bd551cd42022b3388562b935431e2999` | H01–H03 cerrados; H04 abierto |
| 3 | `320bab2cc25c2a772dad4c0826345c3be47e1e44` | H04 cerrado; H05–H06 abiertos |
| 4 | `c14fead12f0e42ecf42216b1de9b8ea2f3546907` | H05 cerrado; H06 sigue abierto por Preview indisponible |

## Estado por hallazgo

| ID | Sev. | Estado |
|---|---|---|
| PR242-H01 | alto | arreglado-verificado |
| PR242-H02 | medio | arreglado-verificado |
| PR242-H03 | medio | arreglado-verificado |
| PR242-H04 | medio | arreglado-verificado |
| PR242-H05 | alto | arreglado-verificado |
| PR242-H06 | medio | abierto |

## Verificación R4

- Rama sincronizada: **ahead 12 / behind 0** de `develop`.
- GitHub: **mergeable=true**.
- T-334 preservado:
  - `onboardingComplete`;
  - «Completá tu registro»;
  - CTA «Continuar registro»;
  - tests de courier incompleto/completo.
- T-325 preservado:
  - licencia/seguro desde `courier_documents`;
  - «Notificaciones»;
  - enlaces legales publicados;
  - tests de documentos y legales.
- Test dirigido tras integración: **90/90** según bitácora.
- CI #1094 del HEAD actual:
  - unit: **118 archivos · 1835/1835 tests**;
  - lint/typecheck/build: GREEN;
  - bundle: `/courier/feed 159 kB`, `/courier/profile 178 kB`;
  - DB seguía en ejecución al cerrar la ronda.
- Vercel del SHA funcional y de los commits documentales: **failure por cuota diaria**, no por build.
- Sin Preview del SHA combinado → no existe evidencia válida para H06.

## Resultado

No hay cambios de código pendientes conocidos.  
**No mergear todavía:** falta únicamente H06, evidencia real del perfil combinado cuando Vercel vuelva a aceptar deployments.
