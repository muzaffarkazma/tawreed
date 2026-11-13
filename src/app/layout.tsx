import type { Metadata } from 'next';
import './globals.css';
import { getT } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Tawreed — AI procurement network',
  description: 'Source, buy, receive and pay on one AI-run B2B procurement network for Saudi Arabia.'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, dir } = await getT();
  return (
    <html lang={lang} dir={dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
