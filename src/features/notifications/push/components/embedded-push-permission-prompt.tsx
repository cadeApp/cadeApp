'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import type { PushPermissionPromptProps } from './push-permission-prompt';

// T-431: carga diferida sin SSR (usa APIs del navegador), compartida por las páginas de avisos de cada rol.
const PushPermissionPrompt = dynamic<PushPermissionPromptProps>(
  () => import('./push-permission-prompt').then((mod) => mod.PushPermissionPrompt),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-md p-6">
        <div className="h-64 w-full rounded-2xl bg-muted" />
      </div>
    ),
  }
);

export function EmbeddedPushPermissionPrompt({ copy }: Pick<PushPermissionPromptProps, 'copy'>) {
  return <PushPermissionPrompt embedded copy={copy} />;
}
