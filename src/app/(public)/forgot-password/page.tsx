import Link from 'next/link';
import { TopBar } from '@/ui/top-bar';
import { Button } from '@/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ForgotPasswordForm, authCopy } from '@/features/auth';

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar
        leftAction={
          <Link href="/login" aria-label="Volver al ingreso">
            <Button
              variant="ghost"
              size="icon"
              className="min-h-12 min-w-12 text-background hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
          </Link>
        }
      />

      <main className="flex-1 px-4 py-8">
        <div className="space-y-6">
          <div className="space-y-1.5 text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {authCopy.forgotPassword.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {authCopy.forgotPassword.subtitle}
            </p>
          </div>

          <ForgotPasswordForm />
        </div>
      </main>
    </div>
  );
}
