import { MfaForm } from '@/features/admin';

export const metadata = {
  title: 'MFA | cadeApp Admin',
  description: 'Verificación en dos pasos para administradores',
};

interface AdminMfaPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function AdminMfaPage({ searchParams }: AdminMfaPageProps) {
  const resolvedParams = await searchParams;
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <MfaForm redirectTo={resolvedParams.redirectTo} />
    </div>
  );
}
