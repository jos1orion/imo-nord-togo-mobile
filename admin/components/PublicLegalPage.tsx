import Link from 'next/link';

type LegalDocument = 'privacy' | 'terms';

type LegalSection = {
  title: string;
  body: string;
};

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;
const contactPhone = process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || null;
const contactDetails = [contactEmail, contactPhone].filter(Boolean).join(' / ');

const documents: Record<LegalDocument, { title: string; intro: string; sections: LegalSection[] }> = {
  privacy: {
    title: 'Politique de confidentialité | Privacy policy',
    intro:
      'Cette politique décrit les informations traitées par ImoPrestige lorsque vous utilisez l’application mobile et les services associés. / This policy explains how ImoPrestige handles information when you use the mobile app and related services.',
    sections: [
      {
        title: 'Responsable et contact | Controller and contact',
        body: `ImoPrestige, Kara, Togo. Pour toute question concernant vos données, contactez l’équipe via les coordonnées configurées dans l’application${contactDetails ? ` : ${contactDetails}` : ''}. / ImoPrestige, Kara, Togo. For questions about your data, contact the team using the details configured in the app${contactDetails ? `: ${contactDetails}` : ''}.`,
      },
      {
        title: 'Informations traitées | Information we handle',
        body:
          'Selon les fonctions utilisées, nous traitons les informations de compte que vous fournissez (nom, adresse e-mail et téléphone), les annonces que vous créez (description, prix, ville, quartier, caractéristiques et photos), ainsi que les échanges, avis, favoris, recherches et alertes que vous choisissez d’utiliser. Si vous envoyez une demande de suppression, nous enregistrons l’adresse e-mail fournie et l’état de traitement de la demande. Des données techniques nécessaires à l’authentification, à la sécurité et au fonctionnement du service peuvent également être générées. / Depending on the features you use, we handle account details you provide (name, email address and phone number), listings you create (description, price, city, neighborhood, features and photos), and messages, reviews, favorites, searches and alerts you choose to use. If you submit a deletion request, we store the email address you provide and the request status. Technical data needed for authentication, security and service operation may also be generated.',
      },
      {
        title: 'Photos et localisation | Photos and location',
        body:
          'L’application accède à la caméra ou à la photothèque uniquement lorsque vous choisissez d’ajouter des photos et après autorisation de votre appareil. La ville et le quartier saisis dans une annonce servent à décrire le bien. L’application ne demande pas l’accès à la position GPS de votre appareil. / The app accesses your camera or photo library only when you choose to add photos and grant device permission. The city and neighborhood entered in a listing describe the property. The app does not request access to your device’s GPS location.',
      },
      {
        title: 'Recherche vocale | Voice search',
        body:
          'La recherche vocale est facultative et n’active le microphone qu’après votre action et votre autorisation. La reconnaissance est effectuée par le service vocal configuré sur votre appareil, qui peut traiter l’audio selon ses propres conditions et sa politique de confidentialité. ImoPrestige utilise le texte reconnu pour renseigner la recherche. / Voice search is optional and accesses the microphone only after you choose the feature and grant permission. Speech recognition is provided by the service configured on your device, which may process audio under its own terms and privacy policy. ImoPrestige uses the recognized text to fill in your search.',
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
          `Vous pouvez demander l’accès, la correction ou la suppression de vos données et de votre compte via le formulaire en ligne. Un administrateur vérifiera la demande et traitera manuellement la suppression; l’envoi du formulaire ne supprime pas immédiatement le compte. L’adresse e-mail est effacée du dossier lorsque la demande est terminée ou refusée, tandis que le statut et les dates de traitement sont conservés. ${contactEmail ? `Vous pouvez aussi écrire à ${contactEmail}.` : ''} La suppression du compte entraîne la suppression ou la désassociation des données personnelles, sous réserve des informations que nous devons conserver pour des raisons légales ou de sécurité. / You may request access, correction or deletion of your data and account using the online form. An administrator will verify the request and handle account deletion manually; submitting the form does not delete the account immediately. The email address is cleared from the request when it is completed or rejected, while its status and processing dates are retained. ${contactEmail ? `You may also email ${contactEmail}.` : ''} Account deletion removes or de-links personal data, except information that must be retained for legal or security reasons.`,
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
      'En créant un compte ou en utilisant ImoPrestige, vous acceptez les présentes conditions. / By creating an account or using ImoPrestige, you agree to these terms.',
    sections: [
      {
        title: 'Service | Service',
        body:
          'ImoPrestige met en relation des personnes intéressées par des biens immobiliers et permet la consultation, la publication et la gestion d’annonces de vente ou de location. / ImoPrestige connects people interested in real estate and enables users to browse, publish and manage sale or rental listings.',
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
          'ImoPrestige fournit un service de mise en relation et n’est pas partie aux transactions conclues entre utilisateurs. Vérifiez les informations, l’identité de votre interlocuteur et le bien avant tout paiement ou engagement. / ImoPrestige provides a connection service and is not a party to transactions between users. Verify information, the other party’s identity and the property before making a payment or commitment.',
      },
      {
        title: 'Disponibilité et responsabilité | Availability and liability',
        body:
          'Nous nous efforçons de maintenir le service disponible et de modérer les annonces, mais ne garantissons ni l’absence d’interruption ni l’exactitude de tous les contenus publiés par les utilisateurs. Dans la mesure permise par la loi, ImoPrestige n’est pas responsable des accords ou pertes résultant directement des transactions entre utilisateurs. / We work to keep the service available and moderate listings, but do not guarantee uninterrupted service or the accuracy of all user-posted content. To the extent permitted by law, ImoPrestige is not responsible for agreements or losses arising directly from transactions between users.',
      },
      {
        title: 'Suspension, modifications et droit applicable | Suspension, changes and governing law',
        body:
          'Nous pouvons suspendre ou fermer un compte en cas de violation des présentes conditions ou pour protéger les utilisateurs et le service. Les conditions peuvent être mises à jour sur cette page. Elles sont régies par les lois de la République Togolaise, sous réserve des règles impératives applicables. / We may suspend or close an account if these terms are violated or to protect users and the service. These terms may be updated on this page. They are governed by the laws of the Togolese Republic, subject to applicable mandatory rules.',
      },
      {
        title: 'Contact | Contact',
        body: `Pour toute question, contactez l’équipe via les coordonnées configurées dans l’application${contactDetails ? ` : ${contactDetails}` : ''}. / For questions, contact the team using the details configured in the app${contactDetails ? `: ${contactDetails}` : ''}.`,
      },
    ],
  },
};

export default function PublicLegalPage({ document }: { document: LegalDocument }) {
  const content = documents[document];
  return (
    <main className="public-legal">
      <article className="public-legal-card">
        <Link className="public-legal-brand" href="/" aria-label="ImoPrestige">
          IMO <span>NORD TOGO</span>
        </Link>
        <p className="public-legal-eyebrow">ImoPrestige</p>
        <h1>{content.title}</h1>
        <p className="public-legal-intro">{content.intro}</p>
        <p className="public-legal-date">Dernière mise à jour / Last updated: 20 octobre 2026 / October 20, 2026</p>
        <nav className="public-legal-nav" aria-label="Documents légaux / Legal documents">
          <Link href="/privacy">Confidentialité / Privacy</Link>
          <Link href="/terms">Conditions / Terms</Link>
          {contactEmail ? <a href={`mailto:${contactEmail}`}>Contact</a> : null}
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
          {contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : null}
        </footer>
      </article>
    </main>
  );
}
