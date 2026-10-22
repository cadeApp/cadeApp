# Evidencia reproducible — PR #349

## SHA y fuentes
- Staging: `edf5f860876e7b996a170cc2f586ee78769bbaf7`, árbol `bb1064482c60d04bb7f34c60c35bec782f0a6f32`.
- Último develop ya promovido: `fbb6e5052a6473a0f7063e60a711b4fa452835f3`, árbol `152fcd298601a9cad309594736de2c662a6a3ce1`.
- Develop actual: `a3681e98f1a1d3aa5d2c3e97e535d7d9219c9d93`, árbol `222afea6e8b32c1527041c900c069129f4048d32`.
- Release funcional `10ab26a11d02653309d6e065a30052471af6d463`, tree `e43054f5b3b1f7d4ebcf63cf33eac76c3b48cf58`, padres en orden `[edf5f860, a3681e98]`.
- [CI Develop](https://github.com/cadeApp/cadeApp/actions/runs/38667902624): SUCCESS; [migrate-develop](https://github.com/cadeApp/cadeApp/actions/runs/38667902731): SUCCESS, nueva migración aplicada.
- [CI Release](https://github.com/cadeApp/cadeApp/actions/runs/38669947827): pendiente durante redacción; comprobar resultado del último HEAD de la PR.

## Inspección GitHub
Recuperar árboles con API GitHub `GET /repos/cadeApp/cadeApp/git/trees/{tree-sha}?recursive=1`, filtrar `type=blob`, comparar ruta+hash. Diferencias anteriores staging↔develop = 9 (5 docs revisión #335, 4 rutas UI). Diferencias develop previo↔actual = 12, todas sin choque con staging. Release reproduce los 12 blobs nuevos y deja intactos los otros.

## Checks tras merge
`migrate-staging` y Vercel son postmerge; chequear logs y SHA. No ejecutar SQL manual, modificar Auth, alterar datos, ni confundir CI efímero con staging real.
