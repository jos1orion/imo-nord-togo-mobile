export type SmartGuideContext =
  | 'home'
  | 'search'
  | 'publish'
  | 'property'
  | 'profile'
  | 'agent'
  | 'messages'
  | 'general';

export type SmartGuideTopic =
  | 'publish'
  | 'photos'
  | 'edit'
  | 'delete'
  | 'search'
  | 'price'
  | 'favorites'
  | 'contact'
  | 'visit'
  | 'agent'
  | 'moderation'
  | 'transaction'
  | 'unknown';

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase()
  .trim();

const TOPIC_KEYWORDS: Record<Exclude<SmartGuideTopic, 'unknown'>, string[]> = {
  delete: ['supprimer', 'effacer', 'retirer', 'delete', 'remove'],
  edit: ['modifier', 'changer', 'mettre a jour', 'edit', 'update'],
  photos: ['photo', 'image', 'photo', 'camera', 'galerie'],
  transaction: ['location', 'louer', 'loue', 'vente', 'vendre', 'transaction'],
  contact: ['contacter', 'contact', 'appeler', 'telephone', 'whatsapp', 'message', 'ecrire'],
  visit: ['visite', 'visiter', 'rendez-vous', 'appointment'],
  favorites: ['favori', 'favoris', 'coeur', 'aime', 'saved'],
  agent: ['agent', 'devenir agent', 'acces agent'],
  moderation: ['apparait', 'visible', 'valider', 'validation', 'refuse', 'publiee'],
  price: ['prix', 'budget', 'cout', 'fcfa'],
  search: ['chercher', 'rechercher', 'filtre', 'quartier', 'ville', 'resultat'],
  publish: ['publier', 'annonce', 'bien', 'maison', 'terrain'],
};

const CONTEXT_DEFAULTS: Partial<Record<SmartGuideContext, SmartGuideTopic>> = {
  home: 'search',
  search: 'search',
  publish: 'publish',
  property: 'contact',
  profile: 'favorites',
  agent: 'publish',
  messages: 'contact',
};

export const resolveSmartGuideTopic = (
  question: string,
  context: SmartGuideContext = 'general'
): SmartGuideTopic => {
  const normalized = normalize(question);
  if (!normalized) return CONTEXT_DEFAULTS[context] ?? 'unknown';

  const matches = (topic: Exclude<SmartGuideTopic, 'unknown'>) =>
    TOPIC_KEYWORDS[topic].some(keyword => normalized.includes(normalize(keyword)));

  const priority: Exclude<SmartGuideTopic, 'unknown'>[] = [
    'delete',
    'edit',
    'photos',
    'transaction',
    'visit',
    'contact',
    'favorites',
    'agent',
    'moderation',
    'price',
    'search',
    'publish',
  ];
  return priority.find(matches) ?? 'unknown';
};
