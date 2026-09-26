import { MfaForm } from '@/features/admin';

export const metadata = {
  title: 'MFA | cadeApp Admin',
  description: 'Verificación en dos pasos para administradores',
};

export default function AdminMfaPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <MfaForm />
    </div>
  );
}
