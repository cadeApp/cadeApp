import * as React from 'react';
import { ANNOUNCEMENTS_COPY, AnnouncementsAdmin } from '@/features/announcements';
import {
  AnnouncementsHistory,
  getAdminAnnouncements,
  parseAdminAnnouncementsSearchParams,
} from '@/features/announcements/server';

const COPY = ANNOUNCEMENTS_COPY.admin;

export const metadata = {
  title: 'Novedades | cadeApp Admin',
  description: 'Novedades y promociones para comercios y repartidores, por push y en su inicio',
};

interface AnnouncementsPageProps {
  searchParams: Promise<{ cursor?: string | string[] }>;
}

export default async function AnnouncementsPage({ searchParams }: AnnouncementsPageProps) {
  const { cursor } = parseAdminAnnouncementsSearchParams(await searchParams);
  const result = await getAdminAnnouncements(cursor);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{COPY.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{COPY.description}</p>
      </div>
      <AnnouncementsAdmin />
      <AnnouncementsHistory result={result} isFirstPage={!cursor} />
    </div>
  );
}
