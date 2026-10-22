import type { Metadata } from 'next';
import { DesignSystemShowcase } from '@/ui/design-system-showcase';

export const metadata: Metadata = {
  title: 'Sistema de Diseño (S00) | cadeApp',
  description: 'Catálogo vivo de tokens y componentes base de cadeApp (D16).',
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return <DesignSystemShowcase />;
}
