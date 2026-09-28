/**
 * Textos del botón que abre el reporte. Viven aparte de `copy.ts` para que el bundle inicial de /trips/[id] no cargue
 * todos los textos de incidentes (formulario, bandeja y detalle admin) solo para pintar el botón (regla 25).
 */
export const REPORT_TRIGGER_COPY = {
  label: 'Reportar un problema',
  loading: 'Cargando el formulario',
} as const;
