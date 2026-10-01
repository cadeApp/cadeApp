'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updatePasswordSchema, type UpdatePasswordInput } from '../schemas';
import { updatePasswordAction } from '../actions';
import { authCopy } from '../copy';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Card } from '@/ui/card';
import { Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';

export interface ResetPasswordFormProps {
  hasSession: boolean;
}

export function ResetPasswordForm({ hasSession }: ResetPasswordFormProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  if (!hasSession) {
    return (
      <Card className="border-warning/30 bg-warning/5 space-y-4 p-6 text-center">
        <div className="bg-warning/10 text-warning mx-auto flex h-12 w-12 items-center justify-center rounded-full">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-lg font-bold text-foreground">
            {authCopy.resetPassword.invalidLinkTitle}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {authCopy.resetPassword.invalidLinkSubtitle}
          </p>
        </div>
        <div className="pt-2">
          <Link href="/forgot-password" className="block w-full">
            <Button variant="default" className="w-full">
              {authCopy.resetPassword.requestNewLink}
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  const onSubmit = async (data: UpdatePasswordInput) => {
    setErrorMessage(null);
    try {
      const res = await updatePasswordAction(data);
      if (res.ok) {
        router.push(res.data.redirectTo);
        router.refresh();
      } else {
        if (res.code === 'VALIDATION_ERROR') {
          setErrorMessage(authCopy.resetPassword.errorWeak);
        } else if (res.code === 'RATE_LIMITED') {
          setErrorMessage(authCopy.resetPassword.errorRateLimited);
        } else if (res.code === 'UNAUTHENTICATED') {
          setErrorMessage(authCopy.resetPassword.invalidLinkSubtitle);
        } else {
          setErrorMessage(authCopy.resetPassword.errorGeneric);
        }
      }
    } catch {
      setErrorMessage(authCopy.resetPassword.errorGeneric);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {errorMessage ? (
        <Card
          className="border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          {errorMessage}
        </Card>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="reset-password" className="block text-sm font-semibold text-foreground">
          {authCopy.resetPassword.passwordLabel}
        </label>
        <div className="relative">
          <Input
            id="reset-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="h-12 pl-10 pr-10"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'reset-password-error' : 'reset-password-helper'}
            {...register('password')}
          />
          <Lock
            className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground focus:outline-none"
            aria-label={showPassword ? authCopy.login.hidePassword : authCopy.login.showPassword}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {errors.password ? (
          <p id="reset-password-error" className="text-sm font-medium text-destructive">
            {errors.password.message}
          </p>
        ) : (
          <p id="reset-password-helper" className="text-sm text-muted-foreground">
            {authCopy.resetPassword.passwordHelper}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="reset-confirm-password" className="block text-sm font-semibold text-foreground">
          {authCopy.resetPassword.passwordConfirmLabel}
        </label>
        <div className="relative">
          <Input
            id="reset-confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="h-12 pl-10 pr-10"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? 'reset-confirm-password-error' : undefined}
            {...register('confirmPassword')}
          />
          <Lock
            className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground focus:outline-none"
            aria-label={showConfirmPassword ? authCopy.login.hidePassword : authCopy.login.showPassword}
          >
            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {errors.confirmPassword ? (
          <p id="reset-confirm-password-error" className="text-sm font-medium text-destructive">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" variant="default" className="h-12 w-full text-base font-semibold" disabled={isSubmitting}>
        {isSubmitting ? authCopy.resetPassword.loadingButton : authCopy.resetPassword.submitButton}
      </Button>
    </form>
  );
}
