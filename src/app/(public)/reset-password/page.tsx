import Link from 'next/link';
import { TopBar } from '@/ui/top-bar';
import { Card } from '@/ui/card';
import { ArrowLeft } from 'lucide-react';
import { ResetPasswordForm, authCopy } from '@/features/auth';
import { createClient } from '@/server/supabase/server';

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hasSession = Boolean(user);

  return (
    <div className="flex flex-1 flex-col bg-background">
      <TopBar
        leftAction={
          <Link
            href="/login"
            aria-label="Volver al ingreso"
            className="inline-flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-lg text-background transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        }
      />

      <main className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center px-4 py-8 sm:max-w-md sm:px-6 sm:py-12">
        <Card className="w-full space-y-6 p-6 sm:p-8">
          {hasSession ? (
            <div className="space-y-1.5 text-center sm:text-left">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {authCopy.resetPassword.title}
              </h1>
              <p className="text-sm text-muted-foreground">{authCopy.resetPassword.subtitle}</p>
            </div>
          ) : null}

          <ResetPasswordForm hasSession={hasSession} />
        </Card>
      </main>
    </div>
  );
}
