# Informe de revisión — PR #188 / T-324 — Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/188  
**SHA funcional revisado:** `c5964452bf1624669e69a56483bb5be4c8562139`  
**Base:** `develop@db2cf1709178383ea027e984e1a6783ee74766fa`  
**Fecha:** 2026-10-02

## Resultado

**CON 1 BLOQUEANTE (PR188-H05 · medio).**

Los cuatro hallazgos de Ronda 1 quedaron resueltos y verificados de forma independiente en el SHA actual.

## Verificación de hallazgos anteriores

### PR188-H01 — arreglado-verificado

- `StatusViewProps.documents` es obligatorio.
- La página canónica autentica con `auth.getUser()`.
- `authError` se propaga como error seguro.
- usuario nulo redirige a `/login?redirectTo=/courier/onboarding/status`.
- usuario válido llama `getCourierDocumentsStatus(user.id)` y pasa el resultado a `<StatusView documents={documents} />`.
- `queries.test.ts` invoca la página real y comprueba redirect + wiring.

### PR188-H02 — arreglado-verificado

- `selfie: rejected` → `Observado`.
- `insurance: rejected` → `Observado`.
- ambos tests impiden `Listo`; el opcional también impide `No cargado (opcional)`.

### PR188-H03 — arreglado-verificado

- Query selecciona únicamente `kind, status, uploaded_at`.
- filtra por `courier_id`.
- ordena `uploaded_at DESC`.
- conserva la primera fila de cada `kind`.
- el retorno elimina `uploaded_at` y nunca selecciona `storage_path`.
- test usa histórico viejo/nuevo para license e insurance.

### PR188-H04 — arreglado-verificado

- test con solo dni_front → Pendiente.
- test con solo dni_back → Pendiente.
- test con avatar ausente → Pendiente.
- implementación exige ambos lados del DNI para estado uploaded.

## PR188-H05 — DNI parcialmente rechazado pierde la prioridad de “Observado”

**Severidad:** medio  
**Archivo:** `src/features/courier-onboarding/components/status-view.tsx:59-73`  
**Estado:** [ANÁLISIS]

### Diagnóstico

La decisión P1 fue general: `rejected` debe verse como **Observado** para documentos obligatorios y opcionales.

La fila “DNI frente y dorso” agrupa dos documentos, pero la implementación solo mira `rejected` dentro de:

```ts
if (hasDni) {
  if (dniFront?.status === 'rejected' || dniBack?.status === 'rejected') {
    dniStatus = 'rejected';
  }
}
```

Por eso:

```ts
[
  { kind: 'dni_front', status: 'rejected' }
]
```

produce `Pendiente`, porque `hasDni === false`. Lo mismo ocurre si solo está rechazado el dorso.

Eso contradice la semántica ya usada en `CourierProfileView`: el test existente afirma `combineDniDocumentStatus('rejected', 'none') === 'rejected'`.

### Arreglo

La precedencia debe ser:

1. si **cualquiera** de los dos lados existentes está `rejected` → `rejected / Observado`;
2. si ambos existen y ambos son `submitted|verified` → `uploaded / Listo`;
3. cualquier otro caso → `pending / Pendiente`.

Ejemplo:

```ts
let dniStatus: ItemStatus = 'pending';

if (dniFront?.status === 'rejected' || dniBack?.status === 'rejected') {
  dniStatus = 'rejected';
} else if (
  dniFront &&
  dniBack &&
  (dniFront.status === 'submitted' || dniFront.status === 'verified') &&
  (dniBack.status === 'submitted' || dniBack.status === 'verified')
) {
  dniStatus = 'uploaded';
}
```

### Test requerido

Agregar `it.each` con:
- solo `dni_front: rejected`;
- solo `dni_back: rejected`.

En ambos:
- “DNI frente y dorso” contiene `Observado`;
- no contiene `Pendiente`;
- no contiene `Listo`.

### Mutación requerida

Volver temporalmente a envolver la detección de rejected dentro de `if (dniFront && dniBack)`. Los dos tests deben quedar rojos. Revertir sin commit.

## CI

CI #853 del SHA revisado:
- typecheck ✅
- lint ✅
- unit ✅ **111 files / 1642 tests**
- DB ✅ **13 files / 1621 tests**
- audit ✅
- bundle-budget ✅
- build: primer intento ❌ en `src/app/layout.tsx -> next/font`, fuera de T-324; rerun exacto del mismo job ✅.

El build inicial se clasifica como ruido transitorio porque el mismo SHA y mismo job pasaron sin cambio de código.

## NO TOCAR

| Tema | Motivo |
|---|---|
| `Vehículo y consentimientos` hardcodeado `Listo` | Fuera del origen `courier_documents`; R1 ya fijó no ampliar T-324 |
| RLS/migraciones | No hacen falta; consulta self está protegida por RLS existente |
| `uploaded_at` en UI | No se expone; solo se usa server-side para deduplicar |
| `storage_path` | No se selecciona ni se retorna |
| next/font | Fallo transitorio fuera del diff; rerun verde |

## Checklist para Ronda 3

- [ ] H05 corregido con precedencia rejected antes de completitud.
- [ ] Dos combinaciones DNI rejected + lado ausente cubiertas.
- [ ] Mutación H05 demuestra rojo.
- [ ] targeted verde.
- [ ] typecheck/lint/test verdes.
- [ ] diff limitado a `status-view.tsx`, `components.test.tsx` y bitácora.
- [ ] sin tocar `docs/revision-pr/**`.

## Metodología

Inspección independiente del SHA exacto, comparación contra R1, lectura del esquema/contrato existente y verificación mediante CI #853. Se reintentó únicamente el job build fallido; el rerun exacto fue verde. No se levantó Supabase/Docker local.
