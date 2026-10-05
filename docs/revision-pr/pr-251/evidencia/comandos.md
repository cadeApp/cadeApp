# Evidencia y comandos — PR #251

## Ronda 4 — SHA `c175443f2b7eb76f99a1185a4a1f28f0ea703808`

### Alcance y sincronización
- rama 14 ahead / 0 behind contra `develop`.
- desde ronda 3 solo se incorporó T-337 + bitácora de T-313; el spec T-313 no cambió.

### Preview
Run `37365402672`, job `111973257046`:
```text
33 passed
1 failed
```
T-313:
- courier ✅
- sin consentimiento ✅
- alta completa ❌ en línea 145

Artifact:
- intento inicial: error genérico de registro
- retries: mensaje de rate-limit
- no contiene causa Auth que identifique SMTP

### H05 — enumeración de creación/cleanup
```text
UI alta: click 143 -> asserts 145/146 -> track 150  [GAP]
createUser sin consentimiento: create 248 -> track 264 [OK]
courier: loginAsCourier -> fixture compartido [OK]
```
`cleanupStagingData` usa `createdUserIds`; discovery de requests depende de `merchantUser`, ausente en este registrationContext.

### H06
`readConsentState` devuelve `role, consent_status`.
Caso positivo afirma role merchant; caso negativo no lo hace.

### H07
Ocurrencias de SMTP como causa definitiva en bitácora: líneas 48, 57, 78, 89, 110, 118 (además de menciones condicionales previas).

### H08
Template oficial comparado con body actual. Faltan secciones obligatorias de evidencia, RED, informe de agy, rutas/dependencias/rollback.

### CI/policy
CI `37365268821`: conclusion failure; lint/audit success, build/unit/typecheck/db-tests cancelled.
approval-policy `37367274175`: failure con mensaje `El PR requiere aprobación vigente de Lautaro073.`

### Nota de instrumento
No se pudo clonar el repo desde el contenedor por falta de resolución de red; la evidencia ejecutable se tomó de los logs/artifacts oficiales del SHA revisado y la lectura directa de GitHub.
