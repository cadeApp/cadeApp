'use client';

import { useState, useCallback } from 'react';
import type { ZodSchema } from 'zod';

export type FieldErrors<T> = {
  [K in keyof T]?: { message?: string };
};

export interface FormState<T> {
  readonly errors: FieldErrors<T>;
  readonly isSubmitting: boolean;
}

export interface UseFormOptions<T extends Record<string, unknown>> {
  readonly resolver: (values: unknown) => { values: T; errors: FieldErrors<T> };
  readonly defaultValues: T;
}

export interface UseFormReturn<T extends Record<string, unknown>> {
  readonly register: (
    name: keyof T,
    options?: { setValueAs?: (val: string) => unknown }
  ) => {
    name: keyof T;
    value: string | number | readonly string[] | undefined;
    checked?: boolean;
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => void;
  };
  readonly handleSubmit: (
    onSubmit: (data: T) => Promise<void> | void
  ) => (e?: React.FormEvent) => Promise<void>;
  readonly setValue: <K extends keyof T>(
    name: K,
    val: T[K],
    options?: { shouldValidate?: boolean }
  ) => void;
  readonly watch: <K extends keyof T>(name: K) => T[K];
  readonly formState: FormState<T>;
}

export function zodResolver<T extends Record<string, unknown>>(schema: ZodSchema<T>) {
  return (values: unknown): { values: T; errors: FieldErrors<T> } => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    const errors: FieldErrors<T> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof T;
      if (field && !errors[field]) {
        errors[field] = { message: issue.message };
      }
    }
    return { values: values as T, errors };
  };
}

export function useForm<T extends Record<string, unknown>>({
  resolver,
  defaultValues,
}: UseFormOptions<T>): UseFormReturn<T> {
  const [values, setValues] = useState<T>(defaultValues);
  const [errors, setErrors] = useState<FieldErrors<T>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const register = useCallback(
    (name: keyof T, options?: { setValueAs?: (val: string) => unknown }) => {
      const val = values[name];
      const isBool = typeof val === 'boolean';

      return {
        name,
        value: isBool
          ? undefined
          : ((val ?? '') as string | number | readonly string[] | undefined),
        checked: isBool ? val : undefined,
        onChange: (
          e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
        ) => {
          const nextVal =
            e.target.type === 'checkbox'
              ? (e.target as HTMLInputElement).checked
              : options?.setValueAs
                ? options.setValueAs(e.target.value)
                : e.target.value;

          setValues((prev) => ({ ...prev, [name]: nextVal }));
          // Limpia el error del campo al modificarlo
          setErrors((prev) => {
            if (!prev[name]) return prev;
            const updated = { ...prev };
            delete updated[name];
            return updated;
          });
        },
      };
    },
    [values]
  );

  const setValue = useCallback(
    <K extends keyof T>(name: K, val: T[K], options?: { shouldValidate?: boolean }) => {
      setValues((prev) => ({ ...prev, [name]: val }));
      if (options?.shouldValidate) {
        setErrors((prevErrors) => {
          const res = resolver({ ...values, [name]: val });
          const nextErrors = { ...prevErrors };
          if (res.errors[name]) {
            nextErrors[name] = res.errors[name];
          } else {
            delete nextErrors[name];
          }
          return nextErrors;
        });
      }
    },
    [resolver, values]
  );

  const watch = useCallback(<K extends keyof T>(name: K): T[K] => values[name], [values]);

  const handleSubmit = useCallback(
    (onSubmit: (data: T) => Promise<void> | void) => async (e?: React.FormEvent) => {
      e?.preventDefault();
      const res = resolver(values);
      setErrors(res.errors);
      if (Object.keys(res.errors).length > 0) {
        return;
      }
      setIsSubmitting(true);
      try {
        await onSubmit(res.values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [resolver, values]
  );

  return {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: {
      errors,
      isSubmitting,
    },
  };
}
