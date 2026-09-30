import type { Metadata } from 'next';
import PublicLegalPage from '../../components/PublicLegalPage';

export const metadata: Metadata = {
  title: 'Politique de confidentialité | Imo Nord Togo',
  description: 'Politique de confidentialité de l’application et des services Imo Nord Togo.',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return <PublicLegalPage document="privacy" />;
}
