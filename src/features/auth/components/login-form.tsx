'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { loginAction } from '../actions';
import { authCopy } from '../copy';

export function LoginForm({ initialRedirectTo }: { initialRedirectTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsPending(true);

    try {
      const result = await loginAction({ email, password });
      if (!result.ok) {
        if (result.code === 'UNAUTHENTICATED') {
          setErrorMessage(authCopy.login.errorInvalidCredentials);
        } else {
          setErrorMessage(authCopy.login.errorGeneric);
        }
        setIsPending(false);
        return;
      }

      const targetUrl = initialRedirectTo || result.data.redirectTo;
      router.push(targetUrl);
      router.refresh();
    } catch {
      setErrorMessage(authCopy.login.errorGeneric);
      setIsPending(false);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {authCopy.login.title}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            {authCopy.login.emailLabel}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={authCopy.login.emailPlaceholder}
            className="flex h-12 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              {authCopy.login.passwordLabel}
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary-dark hover:underline focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {authCopy.login.forgotPassword}
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex h-12 w-full rounded-md border border-input bg-card px-3 py-2 pr-10 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mt-2 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-base font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending ? authCopy.login.loadingButton : authCopy.login.submitButton}
        </button>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        <span>{authCopy.login.noAccount} </span>
        <Link
          href="/register"
          className="font-medium text-primary-dark hover:underline focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {authCopy.login.registerLink}
        </Link>
      </div>
    </div>
  );
}
