import './globals.css';
import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ImoPrestige — Back-office',
  description: 'Back-office professionnel ImoPrestige pour la gestion immobilière.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
