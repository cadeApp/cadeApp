'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PushPermissionPrompt } from '@/features/notifications';

export default function CourierProfileNotificationsPage() {
  const router = useRouter();

  return (
    <PushPermissionPrompt
      onSuccess={() => router.push('/courier/profile')}
      onDismiss={() => router.push('/courier/profile')}
    />
  );
}
