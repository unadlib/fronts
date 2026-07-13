import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Provider } from '@/components/provider';
import { revision } from '@/lib/shared';
import '../global.css';

export const metadata: Metadata = {
  description: 'Fronts 2.0 framework-neutral application runtime documentation.',
  icons: {
    icon: '/icon.svg',
  },
  title: 'Fronts 2.0 Documentation',
};

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="fronts-revision" content={revision} />
      </head>
      <body className="flex min-h-screen flex-col">
        <Provider locale="en">{children}</Provider>
      </body>
    </html>
  );
}
