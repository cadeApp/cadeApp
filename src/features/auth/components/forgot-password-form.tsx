'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '../schemas';
import { requestPasswordResetAction } from '../actions';
import { authCopy } from '../copy';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Card } from '@/ui/card';
import { Mail, CheckCircle2, ArrowLeft } from 'lucide-react';

export function ForgotPasswordForm() {
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setErrorMessage(null);
    try {
      const res = await requestPasswordResetAction(data);
      if (res.ok) {
        setIsSuccess(true);
      } else {
        // En caso de error de red o similar
        setErrorMessage('Ocurrió un error al enviar el enlace. Por favor, reintentá.');
      }
    } catch {
      setErrorMessage('Ocurrió un error inesperado. Por favor, reintentá.');
    }
  };

  if (isSuccess) {
    return (
      <Card className="space-y-4 border-success/30 bg-success/5 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-lg font-bold text-foreground">
            Instrucciones enviadas
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {authCopy.forgotPassword.successMessage}
          </p>
        </div>
        <div className="pt-2">
          <Link href="/login" className="block w-full">
            <Button variant="default" className="w-full">
              {authCopy.forgotPassword.backToLogin}
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {errorMessage ? (
        <Card className="border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          {errorMessage}
        </Card>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="forgot-email" className="block text-sm font-semibold text-foreground">
          {authCopy.forgotPassword.emailLabel}
        </label>
        <div className="relative">
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder={authCopy.forgotPassword.emailPlaceholder}
            className="h-12 pl-10"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'forgot-email-error' : undefined}
            {...register('email')}
          />
          <Mail className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
        {errors.email ? (
          <p id="forgot-email-error" className="text-sm font-medium text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        variant="default"
        size="lg"
        disabled={isSubmitting}
        className="w-full font-display font-bold"
      >
        {isSubmitting
          ? authCopy.forgotPassword.loadingButton
          : authCopy.forgotPassword.submitButton}
      </Button>

      <div className="text-center pt-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-dark hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {authCopy.forgotPassword.backToLogin}
        </Link>
      </div>
    </form>
  );
}
