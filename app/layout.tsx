import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'Video Speed Reader — 上傳影片，三分鐘內拿到逐字稿',
  description:
    'Upload your video, get a clean transcript in three minutes. Built for content creators, educators, and engineers.',
  authors: [{ name: 'Video Speed Reader' }],
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'Video Speed Reader',
    description:
      'Upload your video, get a clean transcript in three minutes. 上傳影片，三分鐘內拿到逐字稿。',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
