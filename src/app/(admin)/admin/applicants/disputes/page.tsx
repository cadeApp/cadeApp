import * as React from 'react';
import { DisputeCandidates } from '@/features/admin';

export const metadata = {
  title: 'Disputas de DNI | cadeApp Admin',
  description: 'Búsqueda del titular real de un DNI reservado por otra cuenta',
};

/**
 * CC-050 (D4-B, PR711-H02): las búsquedas van por server actions (POST) desde el componente; la página no lee
 * los parámetros de la URL, así el teléfono, el UUID o el DNI nunca quedan en ella.
 */
export default function DisputesPage(): React.ReactElement {
  return <DisputeCandidates />;
}
