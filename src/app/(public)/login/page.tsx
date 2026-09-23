import { LoginForm } from '@/features/auth';

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const initialRedirectTo = params?.redirectTo;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <LoginForm initialRedirectTo={initialRedirectTo} />
    </main>
  );
}
