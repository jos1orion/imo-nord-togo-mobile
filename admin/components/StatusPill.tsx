type StatusPillProps = {
  status: string;
  variant?: 'approved' | 'pending' | 'rejected';
};

const normalizeVariant = (status: string): StatusPillProps['variant'] => {
  const value = status.toLowerCase();
  if (value.includes('approve') || value.includes('paid') || value.includes('signed') || value.includes('active')) {
    return 'approved';
  }
  if (value.includes('pending') || value.includes('open') || value.includes('draft')) {
    return 'pending';
  }
  return 'rejected';
};

export default function StatusPill({ status, variant }: StatusPillProps) {
  const tone = variant ?? normalizeVariant(status);
  return <span className={`status ${tone}`}>{status}</span>;
}
