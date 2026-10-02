import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Suppression de compte | Imo Nord Togo',
  description: 'Demandez la suppression de votre compte Imo Nord Togo et des données associées.',
  robots: { index: true, follow: true },
};

const contactEmail = 'kondgbandi@gmail.com';
const emailSubject = encodeURIComponent('Suppression de compte Imo Nord Togo');
const emailBody = encodeURIComponent(
  'Bonjour,\n\nJe demande la suppression de mon compte Imo Nord Togo et des données personnelles associées.\n\nAdresse e-mail associée au compte : \n\n'
);

export default function DeleteAccountPage() {
  return (
    <main className="account-deletion-page">
      <article className="account-deletion-card">
        <div className="account-deletion-brand" aria-label="Imo Nord Togo">
          <span>IMO</span>
          <span>NORD TOGO</span>
        </div>
        <p className="account-deletion-eyebrow">Imo Nord Togo</p>
        <h1>Demande de suppression de compte</h1>
        <p>
          Vous pouvez demander la suppression de votre compte Imo Nord Togo et des données
          personnelles qui lui sont associées, même si vous avez désinstallé l’application.
        </p>

        <section className="account-deletion-steps" aria-labelledby="deletion-steps-title">
          <h2 id="deletion-steps-title">Comment faire la demande</h2>
          <ol>
            <li>Envoyez-nous un e-mail depuis l’adresse associée à votre compte.</li>
            <li>Gardez l’objet prérempli « Suppression de compte Imo Nord Togo ».</li>
            <li>Indiquez l’adresse e-mail de votre compte dans le message.</li>
          </ol>
          <p>
            Nous pouvons vous demander des informations raisonnables pour vérifier votre identité.
            Nous traiterons la demande dans un délai raisonnable et supprimerons le compte et les
            données associées, sauf celles que nous devons conserver pour des obligations légales,
            de sécurité ou de prévention de la fraude.
          </p>
        </section>

        <a
          className="account-deletion-button"
          href={`mailto:${contactEmail}?subject=${emailSubject}&body=${emailBody}`}
        >
          Envoyer une demande par e-mail
        </a>
        <p className="account-deletion-contact">
          Vous pouvez aussi écrire directement à <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
        <nav className="account-deletion-links" aria-label="Informations complémentaires">
          <a href="/privacy">Politique de confidentialité</a>
          <a href="/terms">Conditions d’utilisation</a>
        </nav>
      </article>
    </main>
  );
}
