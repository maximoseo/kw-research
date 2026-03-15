import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Providers } from '@/app/providers';
import ErrorBoundary from '@/components/ErrorBoundary';
import './globals.css';

const sans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-sans',
  weight: '100 900',
});

const mono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'KW Research',
  description:
    'Production keyword research workspace for pillar and cluster planning, cannibalization avoidance, and polished XLSX exports.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sans.variable} ${mono.variable} min-h-screen bg-background font-sans text-text-primary antialiased`}
      >
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
