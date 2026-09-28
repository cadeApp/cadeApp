# Evidencia — PR #109 / T-116 / Ronda 1

## SHAs
PR head: 9acf2ac6f0f053a4452e56c96077386fcd5aa252
develop: ef09bb8ec9fa2335aa6e9e7ae11165301841a61d
compare: ahead 4 / behind 0

## Commits
dfc786a chore(T-116): start task
6790c92 feat(map): implement Google Maps component and pin selector
2edfbf6 docs(T-116): session log
9acf2ac chore(T-116): sync with develop

dfc786a ya agrega src/ui/map.tsx como stub y fija su API.

## Contract-change
Búsqueda CC-011: única coincidencia = PR #109. No hay CC separado.
D01: Lautaro073 eligió 1-A.

## Google loader
map.tsx:92 acceso directo a NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
map.tsx:133 isMapAvailable = Boolean(apiKey) && isOnline.
map.tsx:292 APIProvider.
map.tsx:299 onCameraChanged.
No hay onError, useApiLoadingStatus ni APILoadingStatus.FAILED.

Documentación oficial de @vis.gl consultada: APIProvider admite onError y useApiLoadingStatus expone FAILED.

## Cámara
map.test.tsx:127 nombra desplazamiento del mapa.
map.test.tsx:142 ejecuta ArrowUp.
No invoca onCameraChanged.

## Centroides C01
src/features/merchants/queries.ts: ZoneOption = id + name.
select = id, name.
C01 no pasa defaultZoneCenter.

## Lazy-load / bundle
C01 y C03 importan MapSkeleton desde @/ui/map y también dynamic import de @/ui/map.

CI #430:
- merchant/onboarding 145 kB
- merchant/requests/new 163 kB
- courier/feed 179 kB

CI #455:
- merchant/onboarding 165 kB
- merchant/requests/new 163 kB
- courier/feed 179 kB

Compare bdafee8...ef09bb8: sin cambios de onboarding entre bases.

## Cobertura CI #455
Test Files 68 passed.
Tests 764 passed.

src/ui/map.tsx:
- statements 97.26%
- branches 91.37%
- funcs 80%
- lines 97.26%
- uncovered 98, 300-307

## Evidencia visual / axe
Tree del head: sin capturas T-116.
Comentarios PR al iniciar: 0.
map.test.tsx: sin axe.
package.json: sin @axe-core/playwright y sin @playwright/test.

## Barrido
.only 0
.skip 0
sleep 0
any 0
@ts-ignore 0
hex arbitrarios 0

Direct env detectado en src/ui/map.tsx.

CI #455 se consultó puntualmente como evidencia; no se usa su verde como cierre.

---

# Evidencia — PR #109 / T-116 / Ronda 2

head: df73adac155a3b34db60d6a126ac85e53209e8e5
develop: 47d65c41dc22e1f6b5bebbfb5473c3e89b2d820a

## Shared contract
Los 6 archivos compartidos CC-011 son idénticos entre PR head y develop actual.

## CI #487
Actions checkout:
```text
HEAD = a9a69b20de7cacbda0118ecf012747d8646a39e2
Merge df73adac... into 47d65c41...
```

Jobs todos success.
Unit: 74 files / 898 tests.

Build:
```text
/merchant/onboarding   147 kB
/merchant/requests/new 163 kB
/courier/feed          179 kB
```

## H04/H05/H09
CI ejecutó:
- onboarding-form.test.tsx: 8 tests;
- create-request-form.test.tsx: 8 tests;
- H04 centroide A/B/pin/null;
- H05 payload exacto de pin C01/C03;
- H09 unicidad de dirección/GPS.

No se encontró salida de mutación `onChange={() => {}}` en bitácora, commits ni comentarios.

## H07
Se abrieron las 12 PNG.

Observación:
- `c01_offline_*` muestra mapa activo, sin fallback offline;
- `c03_offline_*` muestra mapa activo, sin fallback offline;
- `google_failed_*` sí muestra fallback.

`axe-report.json` usa URLs localhost:4567 con query page/state.
Búsqueda repo `4567` y `page=c01`: sin resultados.

Varios reportes tienen incompleteCount=1, pero los summary afirman “cumple al 100%”.

## Barrido
0 only/skip/sleeps/any/ts-ignore/hex/direct-env/inline-style/direct-sonner/static-MapPicker.
---

# Evidencia — PR #109 / T-116 / Ronda 3

head: 57f96df55745995aafe1053171c65a9f54f6e6c5
develop: aae504a218b8b76e2d6cd0f56d8b5189e5b8b4fd
merge sintético CI: b80f7797477682a849fecec55a36bae605df7054

## H05

Inspección del wiring:
- C01 `onChange` hace `setValue(defaultPickupLat/defaultPickupLng)`.
- Test H05 dispara el callback capturado y exige marcador de UI + payload exacto -27.4365/-65.6165.
- C03 `onChange` hace `setValue(dropoffLat/dropoffLng)`.
- Test H05 dispara el pin y exige `Pin fijado` + payload exacto -27.4385/-65.6185.

Bitácora del autor:
- C01 mutado a no-op: 1 failed / 7 skipped; restaurado: 1 passed / 7 skipped.
- C03 mutado a no-op: 1 failed / 7 skipped; restaurado: 1 passed / 7 skipped.

Limitación: el contenedor de revisión no pudo clonar GitHub (DNS/egress no disponible), por lo que la mutación roja no se reejecutó localmente. Se deja explícito.

## H07

Decisión de Lautaro073: evidencia visual/runtime final diferida a T-300 / staging.

Residual hallado:
- docs/tasks/T-116.md aún marca [x] el requisito que contiene “axe AA sin violaciones”.
- body #109 hace lo mismo.
- merchants/evidence/T-116/axe-summary.md: “cumple al 100%”, con incomplete > 0.
- requests/evidence/T-116/axe-summary.md: “cumple al 100%”, con incomplete > 0.

## CI #518

Checkout real:
```text
HEAD = b80f7797477682a849fecec55a36bae605df7054
Merge 57f96df... into aae504a...
```

Unit:
```text
Test Files 84 passed (84)
Tests 1044 passed (1044)
```

DB:
```text
Files=12, Tests=1601
Result: PASS
```

Bundle:
```text
/merchant/onboarding   147 kB
/merchant/requests/new 164 kB
/courier/feed          176 kB
```

approval-policy: failure esperada por falta de aprobación vigente de Lautaro073.

---

# Evidencia — PR #109 / T-116 / Ronda 4

head: c23bf0d77bf2dd03fd123bbfcbd5bc09eb54e614
develop actual: 57badabc28fd3bd8e913674bd80b30feb8828414
merge sintético CI: 91ae078ad0c9188e30e3ad1f034ab6fd509588ad

## Diff final

57f96df...c23bf0d: exactamente 4 archivos:
- docs/tasks/T-116.md
- docs/tasks/log/T-116.md
- src/features/merchants/evidence/T-116/axe-summary.md
- src/features/requests/evidence/T-116/axe-summary.md

Sin código/tests/JSON/PNG modificados.

## H07

- ficha: axe/runtime pendiente a T-300;
- body: mismo estado;
- ambos axe-summary: advertencia “EVIDENCIA PRELIMINAR — NO VÁLIDA PARA CERRAR H07”;
- “cumple al 100%” eliminado;
- incomplete/conteos preservados.

## CI #540

Checkout:
```text
HEAD is now at 91ae078 Merge c23bf0d... into 57badabc...
```

Unit:
```text
Test Files 93 passed (93)
Tests 1239 passed (1239)
```

DB:
```text
Files=12, Tests=1601
Result: PASS
```

Bundle:
```text
/merchant/onboarding   147 kB
/merchant/requests/new 164 kB
/courier/feed          176 kB
```

approval-policy: success.
