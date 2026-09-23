import type { Metadata } from 'next';
import { DesignSystemShowcase } from '@/ui/design-system-showcase';

export const metadata: Metadata = {
  title: 'Sistema de Diseño (S00) | Cade',
  description: 'Catálogo vivo de tokens y componentes base de cadeApp (D16).',
};

export default function DesignSystemPage() {
  return <DesignSystemShowcase />;
}
