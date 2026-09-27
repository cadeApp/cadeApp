'use client';

/** A05: error boundary del detalle. Pendiente de implementación (T-124). */
export default function IncidentDetailError(_props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return null;
}
