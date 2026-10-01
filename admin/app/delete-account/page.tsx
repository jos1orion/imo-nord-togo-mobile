import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Suppression de compte | Imo Nord Togo',
  description: 'Demandez la suppression de votre compte Imo Nord Togo et des données associées.',
};

const contactEmail = 'kondgbandi@gmail.com';
const emailSubject = encodeURIComponent('Suppression de compte Imo Nord Togo');
const emailBody = encodeURIComponent(
  'Bonjour,\n\nJe demande la suppression de mon compte Imo Nord Togo et des données personnelles associées.\n\nAdresse e-mail associée au compte : \n\n'
);

export default function DeleteAccountPage() {
  return (
    <main className="public-legal">
      <article className="public-legal-card">
        <Link className="public-legal-brand" href="/">
          IMO <span>NORD TOGO</span>
        </Link>
        <p className="public-legal-eyebrow">Vos données</p>
        <h1>Demande de suppression de compte</h1>
        <p className="public-legal-intro">
          Vous pouvez demander la suppression de votre compte Imo Nord Togo et des données
          personnelles qui lui sont associées, même si vous avez désinstallé l’application.
        </p>

        <div className="public-legal-sections">
          <section aria-labelledby="deletion-steps-title">
            <h2 id="deletion-steps-title">Comment faire la demande</h2>
            <ol>
              <li>Envoyez-nous un e-mail depuis l’adresse associée à votre compte.</li>
              <li>Gardez l’objet prérempli « Suppression de compte Imo Nord Togo ».</li>
              <li>Indiquez l’adresse e-mail de votre compte dans le message.</li>
            </ol>
            <p>
              Nous pouvons demander des informations raisonnables pour vérifier votre identité.
              Nous supprimerons le compte et les données associées, sauf celles que nous devons
              conserver pour des obligations légales, de sécurité ou de prévention de la fraude.
            </p>
          </section>
        </div>

        <a
          className="account-deletion-button"
          href={`mailto:${contactEmail}?subject=${emailSubject}&body=${emailBody}`}
        >
          Envoyer une demande par e-mail
        </a>
        <p className="public-legal-intro">
          Vous pouvez aussi écrire directement à{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
        <nav className="public-legal-nav" aria-label="Informations complémentaires">
          <Link href="/privacy">Politique de confidentialité</Link>
          <Link href="/terms">Conditions d’utilisation</Link>
        </nav>
      </article>
    </main>
  );
}
