import type { Metadata } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';

import { Header, Footer, ErrorBoundary } from '@/components/layout';
import { ThemeProvider } from '@/components/providers/theme-provider';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: 'JADDL Fantasy Football League',
    template: '%s | JADDL',
  },
  description: 'The premier fantasy football league bringing together competitive players for an epic battle of strategy, skill, and a little bit of luck.',
  keywords: ['fantasy football', 'league', 'JADDL', 'sports', 'competition'],
  authors: [{ name: 'JADDL Commissioner' }],
  creator: 'JADDL League',
  publisher: 'JADDL League',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    siteName: 'JADDL Fantasy Football League',
    title: 'JADDL Fantasy Football League',
    description: 'The premier fantasy football league bringing together competitive players for an epic battle of strategy, skill, and a little bit of luck.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'JADDL Fantasy Football League',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JADDL Fantasy Football League',
    description: 'The premier fantasy football league bringing together competitive players for an epic battle of strategy, skill, and a little bit of luck.',
    images: ['/og-image.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Rubik+One:wght@400&family=IBM+Plex+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=IBM+Plex+Serif:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex flex-col font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </ErrorBoundary>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
