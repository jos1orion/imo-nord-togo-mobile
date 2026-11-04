import type { Metadata } from 'next';
import PublicLegalPage from '../../components/PublicLegalPage';

export const metadata: Metadata = {
  title: 'Conditions d’utilisation | Imo Prestige',
  description: 'Conditions d’utilisation des services Imo Prestige.',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return <PublicLegalPage document="terms" />;
}
