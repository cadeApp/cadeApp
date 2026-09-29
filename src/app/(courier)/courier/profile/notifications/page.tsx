'use client';

import dynamic from 'next/dynamic';
import type { PushPermissionPromptProps } from '@/features/notifications';

const PushPermissionPrompt = dynamic<PushPermissionPromptProps>(
  () => import('@/features/notifications').then((mod) => mod.PushPermissionPrompt),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-md p-6">
        <div className="h-64 w-full rounded-2xl bg-muted" />
      </div>
    ),
  }
);

export default function CourierProfileNotificationsPage() {
  return <PushPermissionPrompt embedded />;
}
