import type { Metadata } from 'next';
import PublicLegalPage from '../../components/PublicLegalPage';

export const metadata: Metadata = {
  title: 'Conditions d’utilisation | Imo Nord Togo',
  description: 'Conditions d’utilisation des services Imo Nord Togo.',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return <PublicLegalPage document="terms" />;
}
