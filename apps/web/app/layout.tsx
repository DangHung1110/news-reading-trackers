import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { QueryProvider } from '../components/query-provider';

import './globals.css';

export const metadata: Metadata = {
  title: 'News Reading Activity Tracker',
  description: 'Dashboard for active news-reading sessions.',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="vi">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
