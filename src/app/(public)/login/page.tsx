import { z } from 'zod';
import { LoginForm } from '@/features/auth';

const loginSearchParamsSchema = z.object({
  redirectTo: z.string().optional(),
});

interface LoginPageProps {
  searchParams: Promise<unknown>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const rawParams = await searchParams;
  const parsed = loginSearchParamsSchema.safeParse(rawParams);
  const initialRedirectTo = parsed.success ? parsed.data.redirectTo : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <LoginForm initialRedirectTo={initialRedirectTo} />
    </main>
  );
}
