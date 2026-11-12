import * as React from 'react';
import { EmbeddedPushPermissionPrompt, PUSH_COPY } from '@/features/notifications';

// T-431: el mismo componente que el repartidor, con los textos del comercio.
export default function MerchantNotificationsPage() {
  return <EmbeddedPushPermissionPrompt copy={PUSH_COPY.merchantPrompt} />;
}
