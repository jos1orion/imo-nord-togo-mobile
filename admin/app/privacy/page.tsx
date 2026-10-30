import type { Metadata } from 'next';
import PublicLegalPage from '../../components/PublicLegalPage';

export const metadata: Metadata = {
  title: 'Politique de confidentialité | ImoPrestige',
  description: 'Politique de confidentialité de l’application et des services ImoPrestige.',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return <PublicLegalPage document="privacy" />;
}
