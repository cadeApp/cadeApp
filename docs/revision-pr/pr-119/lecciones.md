# Lecciones — PR #119

## Ronda 1

No se crea un AG nuevo en esta ronda: los cuatro hallazgos son instancias directas de lecciones ya existentes.

- **AG-37 — enumerar la clase entera:** H01 nace de declarar cobertura sobre "el feed" mientras el checker solo inspecciona una selección parcial de archivos; H03 reduce todos los estados post-match a un único fixture `matched`.
- **AG-60 — desconfiar del propio instrumento:** H02 y H04 muestran controles que parecen específicos (mocks de markers y `onError`) pero no consumen la información que ya exponen.
- **AG-75 — la mutación debe atacar lo arreglado:** en la ronda siguiente deben usarse mutaciones nuevas de la revisión para comprobar que los controles corregidos detectan: archivo nuevo/renombrado en el feed, tercer marker, traza ausente, mapa solo en `matched` y `onError` ignorado.
