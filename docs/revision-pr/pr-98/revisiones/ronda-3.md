# Informe de revisión — PR #98 / T-311 — Ronda 3

**SHA revisado:** `c47aee486cf87c491ce62b231eda8795e34aa722`  
**Fecha:** 2026-09-25  
**Resultado:** **BLOQUEADA POR CONTRACT-CHANGE CC-007**

## Decisiones P1 cerradas antes del informe

### A02 / D04 — Excepción puntual de scope: ACEPTADA

Lautaro073 autorizó que PR #98 modifique exclusivamente `docs/tasks/T-312.md` para reemplazar el gate obsoleto `abogado OK` por el gate legal coherente con T-311.

Esto cierra el problema de scope de H01. No autoriza otros cambios en T-312.

### A03 / D05 — Contract-change para H06: ACEPTADO

Lautaro073 eligió que el requisito sea un invariante real, no un rollback best-effort:

> Una cuenta que no tenga los consentimientos legales obligatorios persistidos no puede quedar utilizable en la aplicación, incluso si fallan las compensaciones posteriores a `signUp`.

Por la skill `contract-change`, T-311 debe detenerse y **CC-007** debe resolverse/mergearse antes de continuar.

## Hallazgos cerrados

### H01 — CERRADO

`docs/implementation-plan.md` y `docs/tasks/T-312.md` ya no contienen `abogado OK`. La excepción de scope de T-312 fue autorizada expresamente por P1 (A02).

### H11 — CERRADO EN CONTENIDO

La Política de Privacidad ahora refleja los schemas reales:
- registro: displayName/phone facultativos;
- merchant: zone/coordenadas/notas facultativas;
- courier: patente condicional moto/auto; licencia/seguro facultativos; avatar obligatorio;
- requests: campos obligatorios y condicionales correctamente separados.

El control automático añadido para evitar deriva tiene defectos propios y queda separado como H12.

## H06 · 🔴 Escalado a CC-007

**Archivo actual:** `src/features/auth/actions.ts:124-147`

AGY mejoró la compensación: observa el resultado de `deleteUser` y, si falla, intenta eliminar el profile y banear Auth.

Pero las dos neutralizaciones se ejecutan con `Promise.allSettled()` y sus resultados no se inspeccionan. Si ambas fallan, la acción vuelve a `INTERNAL_ERROR` sin garantía de que la cuenta haya quedado inutilizable.

Esto ya no se intenta resolver con otra capa de best-effort. A03 exige un contrato compartido de autorización/activación que haga imposible usar una cuenta sin los consentimientos requeridos.

### Flujo obligatorio

1. detener T-311 con `cerrar-sesion`;
2. rama `cc/CC-007-consent-enforcement` desde `develop`;
3. copiar `docs/contracts/_plantilla.md` a `docs/contracts/CC-007.md`;
4. documentar contrato actual vs propuesto, motivo, tareas afectadas e impacto D1–D14;
5. issue con label `contract-change` y T-311 marcada `bloqueada`;
6. P2 + P1 validan el contrato; no debilitar RLS/RPC;
7. mergear CC-007;
8. retomar T-311 con `retomar-tarea`.

### Invariante a estudiar en CC-007

El contrato propuesto debe garantizar que una identidad Auth sin aceptación persistida de los documentos legales obligatorios no obtiene/retiene acceso funcional protegido. La forma exacta (estado de perfil, autorización server/RLS, activación posterior u otra) debe decidirse en CC-007; no se impone desde esta revisión.

## H08 · 🔴 DoD visual pendiente

Sigue correctamente desmarcado:
- 390×844;
- 360×800;
- capturas P04;
- axe AA.

Se completa después de mergear CC-007 y retomar T-311.

## H09 · 🟠 Body mejorado pero volverá a necesitar sincronización

El body real ya:
- deja H08 `[ ]`;
- eliminó “SIN BLOQUEANTES”;
- usa la ruta `fuentes-legales-autor.md`;
- actualizó cifras.

Pero ahora, tras A03, todavía abre diciendo que resuelve H01–H11 y presenta H06 como resuelto. Debe actualizarse para indicar que T-311 está bloqueada por CC-007. Queda abierto hasta la reanudación.

## H12 · 🔴 Test de H11 no protege contra deriva y viola AGENTS

**Archivo:** `src/features/legal/legal-red.test.ts:66-83`

El test usa:

```ts
(privacy as any)
(s: any)
```

`AGENTS.md:48` prohíbe explícitamente `any`.

Además, el test solo busca palabras dentro de `documents.ts`; no importa ni ejecuta los schemas reales. Si mañana `registerSchema.displayName` pasa a obligatorio, el test puede seguir verde aunque la Política quede desactualizada.

### Arreglo al retomar T-311

- eliminar todos los `any`;
- tipar correctamente `LegalDocumentDescriptor.sections`;
- importar los schemas reales y cubrir casos representativos:
  - register sin displayName/phone sigue válido;
  - merchant sin zone/coords/notes sigue válido y sin address no;
  - courier bici sin patente válido, moto/auto sin patente inválido;
  - request sin coords/notes válido y cashChangeAmount solo requerido cuando corresponda;
- mantener el test textual solo como complemento, no como fuente de verdad.

## CI final

No se inspecciona. H06 requiere CC-007 y H08/H09/H12 siguen abiertos.

## Prompt para AGY

### Fase 1 — ahora

1. `git pull` en `feat/T-311-legal-consents` para traer la Ronda 3.
2. No hagas más cambios funcionales en T-311.
3. Ejecutá la skill `cerrar-sesion`: documentá que T-311 queda **bloqueada por CC-007** y que H08/H09/H12 se resolverán al retomarla.
4. Seguí la skill `contract-change`.
5. Desde `develop`, creá `cc/CC-007-consent-enforcement`.
6. Copiá `docs/contracts/_plantilla.md` → `docs/contracts/CC-007.md`.
7. Definí:
   - contrato actual;
   - invariante propuesto: cuenta sin TOS/privacy obligatorios persistidos no puede acceder a funciones protegidas;
   - alternativas de enforcement y trade-offs;
   - tareas afectadas, incluyendo T-311;
   - impacto en D1–D14;
   - qué cambia en autorización/RLS/server y por qué no debilita seguridad.
8. Aplicá el procedimiento de issue `contract-change` y T-311 bloqueada según la skill.
9. No mezcles implementación de CC-007 dentro de PR #98.

### Fase 2 — solo después de mergear CC-007

1. Volvé a `feat/T-311-legal-consents` con `retomar-tarea` y mergeá `origin/develop` sin rebase.
2. Adaptá T-311 al contrato CC-007.
3. Cerrá H12 sin `any` y con pruebas que ejecuten los schemas reales.
4. Actualizá el body para reflejar CC-007 y el estado real de H06/H08.
5. Cerrá H08 con navegador 390×844, 360×800, capturas P04 y axe AA.
6. Corré batería final y pedí Ronda 4.

No toques `docs/revision-pr/**`.
