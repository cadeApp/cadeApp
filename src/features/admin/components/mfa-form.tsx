'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/ui/input-otp';
import { notify } from '@/ui/notify';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { verifyAdminMfaAction } from '../actions';
import { adminMfaSchema } from '../schemas';
import { ADMIN_COPY } from '../copy';

export interface MfaFormProps {
  redirectTo?: string;
}

const mfaCodeSchema = adminMfaSchema.pick({ code: true });
type MfaFormData = { code: string };

function getTotpSecondsRemaining(nowMs = Date.now()): number {
  const seconds = Math.floor(nowMs / 1000);
  const elapsed = seconds % 30;
  return elapsed === 0 ? 30 : 30 - elapsed;
}

export function MfaForm({ redirectTo = '/admin/applicants' }: MfaFormProps = {}) {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = React.useState(() =>
    getTotpSecondsRemaining()
  );

  React.useEffect(() => {
    const update = () => {
      setSecondsRemaining(getTotpSecondsRemaining());
    };

    update();
    const timer = window.setInterval(update, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const {
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MfaFormData>({
    resolver: zodResolver(mfaCodeSchema),
    defaultValues: { code: '' },
  });

  const code = watch('code');

  const onSubmit = handleSubmit(async (data) => {
    setErrorMsg(null);

    try {
      const res = await verifyAdminMfaAction({ code: data.code, redirectTo });

      if (!res.ok) {
        setErrorMsg(
          res.code === 'VALIDATION_ERROR'
            ? ADMIN_COPY.mfa.invalidCode
            : getDomainErrorMessage(res.code)
        );
        return;
      }

      notify.success(ADMIN_COPY.mfa.success);
      router.push(res.data.redirectTo);
      router.refresh();
    } catch {
      setErrorMsg(ADMIN_COPY.mfa.connectionError);
    }
  });

  return (
    <Card className="w-full max-w-md shadow-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <CardTitle className="font-display text-xl font-bold tracking-tight">
          {ADMIN_COPY.mfa.title}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {ADMIN_COPY.mfa.description}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-3">
            <label
              htmlFor="totp-code"
              className="block text-center text-sm font-medium text-foreground"
            >
              {ADMIN_COPY.mfa.codeLabel}
            </label>
            <div className="flex justify-center">
              <InputOTP
                id="totp-code"
                maxLength={6}
                value={code}
                onChange={(val) => setValue('code', val, { shouldValidate: true })}
                disabled={isSubmitting}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <p className="text-center text-sm text-muted-foreground" aria-live="polite">
              {ADMIN_COPY.mfa.countdown(secondsRemaining)}
            </p>
            {errors.code ? (
              <p className="text-center text-sm font-medium text-destructive" role="alert">
                {errors.code.message ?? ADMIN_COPY.mfa.validationFallback}
              </p>
            ) : null}
          </div>

          {errorMsg ? (
            <div
              className="rounded-lg bg-destructive/10 p-3 text-center text-sm font-medium text-destructive"
              role="alert"
            >
              {errorMsg}
            </div>
          ) : null}

          <Button
            type="submit"
            className="h-11 w-full text-base font-semibold"
            disabled={isSubmitting || code.length !== 6}
          >
            {isSubmitting ? ADMIN_COPY.mfa.verifyingButton : ADMIN_COPY.mfa.verifyButton}
          </Button>

          <div className="pt-2 text-center text-sm text-muted-foreground">
            <p className="text-sm">{ADMIN_COPY.mfa.troubleshoot}</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
