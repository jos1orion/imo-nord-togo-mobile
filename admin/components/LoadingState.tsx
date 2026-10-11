type LoadingStateProps = {
  label?: string;
};

export default function LoadingState({ label = 'Chargement...' }: LoadingStateProps) {
  return (
    <div className="card loading-state" role="status" aria-label={label} aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="loading-state-heading" />
      <div className="loading-state-row">
        <span />
        <span />
        <span />
      </div>
      <div className="loading-state-row">
        <span />
        <span />
        <span />
      </div>
      <div className="loading-state-row">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
