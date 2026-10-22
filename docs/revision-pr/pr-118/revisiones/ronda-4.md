# Ronda 4 — PR #118 · T-206

**SHA:** `71cce94818fa5fb4cace69921cf0181a8e3871d9`  
**Resultado:** **CON BLOQUEANTES**

## Revalidación

La rama ya contiene el develop actual: 11 ahead / 0 behind.

### H07 — implementación corregida

`cancel_request` corta el side effect ante:
- error de offers/request/audit;
- offers data null;
- merchant_id ausente;
- actor_id ausente.

`offersRes.data=[]` sigue siendo válido. Hay tests directos para audit null, request null, offers null y array vacío.

### H05 — residual de evidencia

La batería pedida en R3 para publish/sweep/cancel sí aparece documentada:
- available true→false;
- pre-commit;
- dispersión cross-request;
- eliminación completa de select;
- cancel sin decided_at fallando por histórico extra.

Sin embargo, R3 también exigió pruebas nuevas para tres variantes `data:null,error:null`. El commit agregó esas pruebas, pero la bitácora solo conserva una mutación RED: quitar `!auditRes.data?.actor_id`.

Faltan pruebas RED reproducibles para:
1. quitar `!reqRes.data?.merchant_id`;
2. quitar `offersRes.data == null`.

Cada una debe fallar por conducta observable de side effect/resolución, no por TypeError ni aserción tautológica. Esto es necesario para poder marcar “Cada prueba nueva se demostró fallando”.

### M02 — todavía abierto

El body sigue mostrando CI del SHA anterior `6980fb`: 93/93 · 1275/1275.

El unit job del HEAD actual reporta:
```text
Test Files 93 passed (93)
Tests      1280 passed (1280)
verify-workflows # tests 22
verify-adr       # tests 6
```

Al momento de esta ronda, db-tests del HEAD seguía en ejecución. No actualizar ni declarar cierre hasta que finalice el run `36465381165`.

## Resultado

No aparecen nuevos defectos de producto en el delta inspeccionado. Los bloqueantes restantes son de evidencia obligatoria y cierre CI/body.
