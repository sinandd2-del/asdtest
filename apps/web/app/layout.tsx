import './globals.css';
import type { Metadata, Viewport } from 'next';
import { QueryProvider } from '../components/query-provider';

export const metadata: Metadata = {
  title: 'Poker Platform MVP',
  description: 'Server-authoritative browser poker platform foundation'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
