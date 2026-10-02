export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(value);

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lome',
  }).format(new Date(value));
