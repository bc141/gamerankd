import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import HeaderLegacy from '@/components/Header';
import { Header as HeaderV0 } from '@/components/v0-ui';
import { ToastProvider } from '@/components/ui/toast';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Gamebox',
  description: 'Rate, rank, and review games',
  metadataBase: new URL('https://gamdit.com'),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Gamebox',
    description: 'Rate, rank, and review games',
    url: 'https://gamdit.com',
    siteName: 'Gamebox',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gamebox',
    description: 'Rate, rank, and review games',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const useV0Header = process.env.NEXT_PUBLIC_USE_V0_HEADER === 'true'
  // Single global header; expose a CSS var for sticky offset
  const headerHeight = '56px'
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} style={{ ['--app-header-height' as any]: headerHeight }}>
        <ToastProvider>
          {useV0Header ? (
            <HeaderV0
              onSearch={() => {}}
              onNotifications={() => {}}
              onMessages={() => {}}
              onProfile={() => {}}
            />
          ) : (
            <HeaderLegacy />
          )}
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}