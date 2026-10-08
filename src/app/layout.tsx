import type { Metadata } from 'next';
import './globals.css';
import SessionTimeoutWatcher from '@/components/SessionTimeoutWatcher';

export const metadata: Metadata = {
  title: 'MEMOu Controller - Website Service Studio',
  description: 'Manage, customize, and edit website service templates with live preview and photo management.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#f8fafc] text-[#0f172a] min-h-screen antialiased selection:bg-[#0f172a] selection:text-white">
        <SessionTimeoutWatcher />
        {children}
      </body>
    </html>
  );
}
