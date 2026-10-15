# T-368 / PR #369 — Ronda 5: precisión de chequeo 549/54

En la inspección previa al nuevo CI detecté que la primera condición para 54 también capturaba un número completo 549 de 13 dígitos. Se reemplazó el OR por una distinción exclusiva: si comienza con 549, exigir 13 dígitos; si no, y comienza con 54, exigir 12. Los 10 dígitos nacionales siguen pasando. Esto se corrigió antes de certificar GREEN y sin debilitar los tests. El CI del HEAD corregido es el verificador definitivo.
