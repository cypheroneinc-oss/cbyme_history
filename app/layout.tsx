import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '診断',
  description: '診断の結果ページです。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#f9fafb', color: '#111827' }}>
        {children}
      </body>
    </html>
  );
}
