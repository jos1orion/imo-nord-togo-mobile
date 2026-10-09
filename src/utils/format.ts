export const formatPrice = (price: number): string => {
  const value = Number.isFinite(price) ? Math.round(price) : 0;
  return `${value.toLocaleString('fr-FR')} FCFA`;
};
