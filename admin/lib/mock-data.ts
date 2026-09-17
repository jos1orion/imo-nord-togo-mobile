export type PropertyStatus = 'approved' | 'pending' | 'rejected';

export type Property = {
  id: string;
  title: string;
  location: string;
  price: number;
  status: PropertyStatus;
  agent: string;
  createdAt: string;
};

export type User = {
  id: string;
  name: string;
  role: 'Owner' | 'Agent' | 'Client';
  status: 'Active' | 'Pending' | 'Suspended';
  lastActive: string;
};

export type Message = {
  id: string;
  from: string;
  to: string;
  preview: string;
  channel: 'In-app' | 'WhatsApp' | 'Email';
  status: 'Open' | 'Closed';
  createdAt: string;
};

export type Review = {
  id: string;
  property: string;
  rating: number;
  status: 'Verified' | 'Flagged';
  createdAt: string;
};

export type Agent = {
  id: string;
  name: string;
  region: string;
  totalSales: number;
  rating: number;
};

export type Transaction = {
  id: string;
  property: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Disputed';
  createdAt: string;
};

export type Document = {
  id: string;
  title: string;
  type: 'Mandate' | 'Identity' | 'Contract';
  status: 'Signed' | 'Draft' | 'Expired';
  updatedAt: string;
};

export type LogEntry = {
  id: string;
  actor: string;
  action: string;
  scope: string;
  createdAt: string;
};

export const properties: Property[] = [
  {
    id: 'P-1024',
    title: 'Villa moderne avec piscine',
    location: 'Lome - Tokoin',
    price: 185000000,
    status: 'pending',
    agent: 'Komi Ata',
    createdAt: '2026-03-20',
  },
  {
    id: 'P-1025',
    title: 'Appartement 3 chambres',
    location: 'Kara - Centre',
    price: 42000000,
    status: 'approved',
    agent: 'Yawo Essi',
    createdAt: '2026-03-18',
  },
  {
    id: 'P-1026',
    title: 'Terrain viabilise 600m2',
    location: 'Sokode - Zongo',
    price: 12000000,
    status: 'approved',
    agent: 'Afi Dede',
    createdAt: '2026-03-17',
  },
  {
    id: 'P-1027',
    title: 'Studio meuble haut standing',
    location: 'Lome - Hedzranawoe',
    price: 18500000,
    status: 'pending',
    agent: 'Komi Ata',
    createdAt: '2026-03-16',
  },
  {
    id: 'P-1028',
    title: 'Local commercial premium',
    location: 'Lome - Avepozo',
    price: 98000000,
    status: 'rejected',
    agent: 'Yawo Essi',
    createdAt: '2026-03-15',
  },
];

export const users: User[] = [
  { id: 'U-2201', name: 'Hanna Kossi', role: 'Owner', status: 'Active', lastActive: '2026-03-25 19:40' },
  { id: 'U-2202', name: 'Felix Mensah', role: 'Agent', status: 'Pending', lastActive: '2026-03-25 18:12' },
  { id: 'U-2203', name: 'Awa Douti', role: 'Client', status: 'Active', lastActive: '2026-03-25 20:05' },
  { id: 'U-2204', name: 'Gedeon Amouzou', role: 'Agent', status: 'Suspended', lastActive: '2026-03-21 10:30' },
];

export const messages: Message[] = [
  {
    id: 'M-91',
    from: 'Awa Douti',
    to: 'Komi Ata',
    preview: 'Bonjour, la villa est-elle disponible ?',
    channel: 'In-app',
    status: 'Open',
    createdAt: '2026-03-25 20:12',
  },
  {
    id: 'M-92',
    from: 'Felix Mensah',
    to: 'Support',
    preview: 'Besoin d aide pour valider mon compte.',
    channel: 'Email',
    status: 'Open',
    createdAt: '2026-03-25 19:55',
  },
  {
    id: 'M-93',
    from: 'Support',
    to: 'Gedeon Amouzou',
    preview: 'Compte suspendu suite a un document manquant.',
    channel: 'In-app',
    status: 'Closed',
    createdAt: '2026-03-24 11:08',
  },
];

export const reviews: Review[] = [
  { id: 'R-301', property: 'Villa moderne avec piscine', rating: 4.8, status: 'Verified', createdAt: '2026-03-25' },
  { id: 'R-302', property: 'Appartement 3 chambres', rating: 3.9, status: 'Verified', createdAt: '2026-03-24' },
  { id: 'R-303', property: 'Local commercial premium', rating: 2.1, status: 'Flagged', createdAt: '2026-03-23' },
];

export const agents: Agent[] = [
  { id: 'A-11', name: 'Komi Ata', region: 'Lome', totalSales: 24, rating: 4.7 },
  { id: 'A-12', name: 'Afi Dede', region: 'Sokode', totalSales: 18, rating: 4.5 },
  { id: 'A-13', name: 'Yawo Essi', region: 'Kara', totalSales: 14, rating: 4.2 },
];

export const transactions: Transaction[] = [
  { id: 'T-7001', property: 'Villa moderne avec piscine', amount: 3200000, status: 'Paid', createdAt: '2026-03-24' },
  { id: 'T-7002', property: 'Appartement 3 chambres', amount: 1450000, status: 'Pending', createdAt: '2026-03-23' },
  { id: 'T-7003', property: 'Terrain viabilise 600m2', amount: 980000, status: 'Disputed', createdAt: '2026-03-21' },
];

export const documents: Document[] = [
  { id: 'D-801', title: 'Mandat exclusif - Villa', type: 'Mandate', status: 'Signed', updatedAt: '2026-03-25' },
  { id: 'D-802', title: 'Piece identite - Agent', type: 'Identity', status: 'Draft', updatedAt: '2026-03-24' },
  { id: 'D-803', title: 'Contrat location - Studio', type: 'Contract', status: 'Expired', updatedAt: '2026-03-20' },
];

export const logs: LogEntry[] = [
  { id: 'L-9001', actor: 'System', action: 'Sync data', scope: 'Supabase', createdAt: '2026-03-25 20:30' },
  { id: 'L-9002', actor: 'Admin', action: 'Approve property', scope: 'P-1025', createdAt: '2026-03-25 18:10' },
  { id: 'L-9003', actor: 'Admin', action: 'Suspend agent', scope: 'U-2204', createdAt: '2026-03-24 09:22' },
];
