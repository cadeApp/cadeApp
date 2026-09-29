import React from 'react';
import dynamic from 'next/dynamic';
import { loadNotFoundView } from '@/features/notifications';

const NotFoundView = dynamic(loadNotFoundView);

export default function NotFound() {
  return <NotFoundView />;
}
