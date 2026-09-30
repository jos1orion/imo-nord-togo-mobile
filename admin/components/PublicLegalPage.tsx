import Link from 'next/link';

type LegalDocument = 'privacy' | 'terms';

type LegalSection = {
  title: string;
  body: string;
};

const contactEmail = 'contact@imonordtogo.com';
const contactPhone = '+228 99 21 08 81';

const documents: Record<LegalDocument, { title: string; intro: string; sections: LegalSection[] }> = {
  privacy: {
    title: 'Politique de confidentialité | Privacy policy',
    intro:
      'Cette politique décrit les informations traitées par Imo Nord Togo lorsque vous utilisez l’application mobile et les services associés. / This policy explains how Imo Nord Togo handles information when you use the mobile app and related services.',
    sections: [
      {
        title: 'Responsable et contact | Controller and contact',
        body: `Imo Nord Togo, Kara, Togo. Pour toute question concernant vos données : ${contactEmail} ou ${contactPhone}. / Imo Nord Togo, Kara, Togo. For questions about your data: ${contactEmail} or ${contactPhone}.`,
      },
      {
        title: 'Informations traitées | Information we handle',
        body:
          'Selon les fonctions utilisées, nous traitons les informations de compte que vous fournissez (nom, adresse e-mail et téléphone), les annonces que vous créez (description, prix, ville, quartier, caractéristiques et photos), ainsi que les échanges, avis, favoris, recherches et alertes que vous choisissez d’utiliser. Des données techniques nécessaires à l’authentification, à la sécurité et au fonctionnement du service peuvent également être générées. / Depending on the features you use, we handle account details you provide (name, email address and phone number), listings you create (description, price, city, neighborhood, features and photos), and messages, reviews, favorites, searches and alerts you choose to use. Technical data needed for authentication, security and service operation may also be generated.',
      },
      {
        title: 'Photos et localisation | Photos and location',
        body:
          'L’application accède à la caméra ou à la photothèque uniquement lorsque vous choisissez d’ajouter des photos et après autorisation de votre appareil. La ville et le quartier saisis dans une annonce servent à décrire le bien. L’application ne demande pas l’accès à la position GPS de votre appareil. / The app accesses your camera or photo library only when you choose to add photos and grant device permission. The city and neighborhood entered in a listing describe the property. The app does not request access to your device’s GPS location.',
      },
      {
        title: 'Utilisation | How we use information',
        body:
          'Les informations servent à créer et sécuriser votre compte, publier et gérer les annonces, permettre les contacts entre utilisateurs, fournir les fonctions de favoris et d’alertes, répondre aux demandes d’assistance et maintenir le service. / Information is used to create and secure accounts, publish and manage listings, enable contact between users, provide favorites and alerts, respond to support requests and operate the service.',
      },
      {
        title: 'Partage et prestataires | Sharing and service providers',
        body:
          'Les annonces publiées et les coordonnées que vous choisissez d’y inclure peuvent être visibles par les utilisateurs de l’application. Nous utilisons des prestataires techniques, notamment Supabase pour l’authentification, la base de données et le stockage, ainsi que Vercel pour héberger le site web. Ces prestataires traitent les données nécessaires à leurs services. Lorsque vous choisissez WhatsApp, l’appel ou l’e-mail, vous êtes redirigé vers le service correspondant, qui applique ses propres règles de confidentialité. / Published listings and contact details you choose to include may be visible to app users. We use technical providers, including Supabase for authentication, database and storage, and Vercel to host the website. These providers process data needed to provide their services. If you choose WhatsApp, phone or email contact, you are redirected to that service, which applies its own privacy terms.',
      },
      {
        title: 'Conservation et sécurité | Retention and security',
        body:
          'Les données sont conservées aussi longtemps que nécessaire au fonctionnement du compte et du service, puis supprimées ou conservées uniquement lorsque cela est nécessaire pour des obligations légales, la sécurité ou le règlement de litiges. Nous mettons en œuvre des mesures raisonnables pour protéger les données, sans pouvoir garantir une sécurité absolue. / Data is kept for as long as needed to operate the account and service, then deleted or retained only where needed for legal obligations, security or dispute resolution. We use reasonable safeguards, but cannot guarantee absolute security.',
      },
      {
        title: 'Vos choix et suppression du compte | Your choices and account deletion',
        body:
          `Vous pouvez demander l’accès, la correction ou la suppression de vos données et de votre compte en écrivant à ${contactEmail} depuis l’adresse associée au compte. Indiquez « Suppression de compte Imo Nord Togo » dans l’objet. Nous pouvons demander des éléments raisonnables pour vérifier votre identité. La suppression du compte entraîne la suppression ou la désassociation des données personnelles, sous réserve des informations que nous devons conserver pour des raisons légales ou de sécurité. / You may request access, correction or deletion of your data and account by emailing ${contactEmail} from the address linked to the account. Use “Imo Nord Togo account deletion” as the subject. We may ask for reasonable information to verify your identity. Account deletion removes or de-links personal data, except information that must be retained for legal or security reasons.`,
      },
      {
        title: 'Mineurs et modifications | Children and changes',
        body:
          'Le service n’est pas destiné aux personnes de moins de 18 ans. Nous pouvons mettre à jour cette politique ; la date de mise à jour sera alors modifiée sur cette page. / The service is not intended for anyone under 18. We may update this policy and will change the update date on this page.',
      },
    ],
  },
  terms: {
    title: 'Conditions d’utilisation | Terms of use',
    intro:
      'En créant un compte ou en utilisant Imo Nord Togo, vous acceptez les présentes conditions. / By creating an account or using Imo Nord Togo, you agree to these terms.',
    sections: [
      {
        title: 'Service | Service',
        body:
          'Imo Nord Togo met en relation des personnes intéressées par des biens immobiliers et permet la consultation, la publication et la gestion d’annonces de vente ou de location. / Imo Nord Togo connects people interested in real estate and enables users to browse, publish and manage sale or rental listings.',
      },
      {
        title: 'Compte | Account',
        body:
          'Vous devez fournir des informations exactes, protéger vos identifiants et nous signaler toute utilisation non autorisée. Le service est destiné aux personnes âgées d’au moins 18 ans. / You must provide accurate information, protect your sign-in credentials and notify us of unauthorized use. The service is intended for people aged 18 or older.',
      },
      {
        title: 'Annonces et conduite | Listings and conduct',
        body:
          'Vous êtes responsable du contenu que vous publiez et devez disposer des droits nécessaires sur les textes et photos. Les annonces doivent être exactes et ne pas être illégales, frauduleuses, trompeuses ou porter atteinte aux droits d’autrui. Nous pouvons retirer un contenu ou restreindre un compte en cas de violation de ces règles. / You are responsible for the content you post and must have the necessary rights to text and photos. Listings must be accurate and must not be illegal, fraudulent, misleading or infringe another person’s rights. We may remove content or restrict an account when these rules are violated.',
      },
      {
        title: 'Transactions | Transactions',
        body:
          'Imo Nord Togo fournit un service de mise en relation et n’est pas partie aux transactions conclues entre utilisateurs. Vérifiez les informations, l’identité de votre interlocuteur et le bien avant tout paiement ou engagement. / Imo Nord Togo provides a connection service and is not a party to transactions between users. Verify information, the other party’s identity and the property before making a payment or commitment.',
      },
      {
        title: 'Disponibilité et responsabilité | Availability and liability',
        body:
          'Nous nous efforçons de maintenir le service disponible et de modérer les annonces, mais ne garantissons ni l’absence d’interruption ni l’exactitude de tous les contenus publiés par les utilisateurs. Dans la mesure permise par la loi, Imo Nord Togo n’est pas responsable des accords ou pertes résultant directement des transactions entre utilisateurs. / We work to keep the service available and moderate listings, but do not guarantee uninterrupted service or the accuracy of all user-posted content. To the extent permitted by law, Imo Nord Togo is not responsible for agreements or losses arising directly from transactions between users.',
      },
      {
        title: 'Suspension, modifications et droit applicable | Suspension, changes and governing law',
        body:
          'Nous pouvons suspendre ou fermer un compte en cas de violation des présentes conditions ou pour protéger les utilisateurs et le service. Les conditions peuvent être mises à jour sur cette page. Elles sont régies par les lois de la République Togolaise, sous réserve des règles impératives applicables. / We may suspend or close an account if these terms are violated or to protect users and the service. These terms may be updated on this page. They are governed by the laws of the Togolese Republic, subject to applicable mandatory rules.',
      },
      {
        title: 'Contact | Contact',
        body: `Pour toute question, contactez ${contactEmail} ou ${contactPhone}. / For questions, contact ${contactEmail} or ${contactPhone}.`,
      },
    ],
  },
};

export default function PublicLegalPage({ document }: { document: LegalDocument }) {
  const content = documents[document];
  return (
    <main className="public-legal">
      <article className="public-legal-card">
        <Link className="public-legal-brand" href="/" aria-label="Imo Nord Togo">
          IMO <span>NORD TOGO</span>
        </Link>
        <p className="public-legal-eyebrow">Imo Nord Togo</p>
        <h1>{content.title}</h1>
        <p className="public-legal-intro">{content.intro}</p>
        <p className="public-legal-date">Dernière mise à jour / Last updated: 30 septembre 2026 / September 30, 2026</p>
        <nav className="public-legal-nav" aria-label="Documents légaux / Legal documents">
          <Link href="/privacy">Confidentialité / Privacy</Link>
          <Link href="/terms">Conditions / Terms</Link>
          <a href={`mailto:${contactEmail}`}>Contact</a>
        </nav>
        <div className="public-legal-sections">
          {content.sections.map(section => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
        <footer className="public-legal-footer">
          <span>Kara, Togo</span>
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </footer>
      </article>
    </main>
  );
}
