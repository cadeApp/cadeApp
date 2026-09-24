import * as React from 'react';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[390px] sm:max-w-md md:max-w-lg flex-col bg-background text-foreground">
      {children}
    </div>
  );
}
