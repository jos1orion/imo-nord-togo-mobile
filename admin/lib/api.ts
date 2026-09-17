import {
  agents,
  documents,
  logs,
  messages,
  properties,
  reviews,
  transactions,
  users,
  type Agent,
  type Document,
  type LogEntry,
  type Message,
  type Property,
  type Review,
  type Transaction,
  type User,
} from './mock-data';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

const fetchOrFallback = async <T>(path: string, fallback: T): Promise<T> => {
  // Demo records must never be presented as real business data in production.
  if (!apiBase) return process.env.NODE_ENV === 'production' ? ([] as unknown as T) : fallback;
  const response = await fetch(`${apiBase}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    return process.env.NODE_ENV === 'production' ? ([] as unknown as T) : fallback;
  }
  return (await response.json()) as T;
};

export const getProperties = () => fetchOrFallback<Property[]>('/properties', properties);
export const getUsers = () => fetchOrFallback<User[]>('/users', users);
export const getMessages = () => fetchOrFallback<Message[]>('/messages', messages);
export const getReviews = () => fetchOrFallback<Review[]>('/reviews', reviews);
export const getAgents = () => fetchOrFallback<Agent[]>('/agents', agents);
export const getTransactions = () => fetchOrFallback<Transaction[]>('/transactions', transactions);
export const getDocuments = () => fetchOrFallback<Document[]>('/documents', documents);
export const getLogs = () => fetchOrFallback<LogEntry[]>('/logs', logs);

export const getDashboardStats = async () => {
  const [props, userList, txList, msgList] = await Promise.all([
    getProperties(),
    getUsers(),
    getTransactions(),
    getMessages(),
  ]);

  const totalVolume = txList.reduce((acc, tx) => acc + tx.amount, 0);

  return {
    properties: props.length,
    pending: props.filter(p => p.status === 'pending').length,
    users: userList.length,
    transactions: txList.length,
    revenue: totalVolume,
    messages: msgList.filter(m => m.status === 'Open').length,
  };
};
