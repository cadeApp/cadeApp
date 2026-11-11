# PR #688 — T-431

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/688 |
| Rama | `feat/T-431-merchant-push-whatsapp` → `develop` |
| Autor | Lautaro073 |
| Base de la PR | `af023d3099e9e2ea15e3b78bf0cf5937e699058a` |
| Último SHA de código revisado | `93a08afce1d1f36f78eab6f9828ff969539c0183` |
| Alcance total | 26 archivos; ronda 2 modifica solo cinco autorizados |
| Resultado actual | **SIN BLOQUEANTES DE CÓDIGO detectados por inspección**; ver limitaciones de ejecución y CI en la ronda 2 |

## Rondas

| Ronda | SHA examinado | Resultado | Informe |
|---|---|---|---|
| 1 | `f7e2dc35` | 2 bloqueantes H03/H04; H01/H02 sin verificación propia | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `93a08afc` | H03/H04 corregidos por inspección; ninguna regresión nueva identificada; pendientes de ejecución independiente | [Ronda 2](revisiones/ronda-2.md) |

## Estado de hallazgos

| ID | Estado | Referencia |
|---|---|---|
| H01 | arreglado-sin-verificar | Las dos páginas usan el componente real con copy correcto |
| H02 | arreglado-sin-verificar | RED R1–R3 son autorreportados; R3 conserva placeholder, sin repro propia |
| H03 | arreglado-sin-verificar | Wrapper restaura PushPromptErrorBoundary, tests de excepción en ambos roles y mutación M1 declarada |
| H04 | arreglado-sin-verificar | switch completo parametrizado con text, tabla de nueve códigos y mutación M2 declarada |
| H05 | aceptado (proceso) | El archivo red.md histórico del autor se conserva sin adjudicar verificación; en ronda 2 no tocó la carpeta |

**D01=A:** se mantiene: Cuenta queda activa en las subpáginas del plan, sin falsos positivos de prefijo.

## Checks y límites

El autor declara 202 archivos/3775 tests verdes, typecheck y lint. Al revisar el SHA exacto: CI typecheck, lint, build, audit y bundle-budget aparecen en éxito; unit y db-tests seguían en ejecución en la consulta. El checker advisory de formato reportó avisos preexistentes. El approval-policy falla mientras el cuerpo no contenga el formato de informe exigido; es un control de proceso, no un defecto funcional. La revisión no ejecutó localmente Vitest por falta de clon y resolución DNS.

**No sustituir evidencia del autor por verificación independiente:** los estados `arreglado-sin-verificar` se mantienen deliberadamente hasta reproducción de las pruebas o una validación CI exact-head suficiente.

[Hallazgos](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md)
