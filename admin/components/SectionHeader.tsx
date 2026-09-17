type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export default function SectionHeader({ title, subtitle, actions }: SectionHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        <div className="page-title">{title}</div>
        {subtitle ? <div className="page-subtitle">{subtitle}</div> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  );
}
