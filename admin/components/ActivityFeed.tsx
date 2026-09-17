type ActivityItem = {
  title: string;
  meta: string;
};

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="activity">
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className="activity-item">
          <div style={{ fontWeight: 600 }}>{item.title}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{item.meta}</div>
        </div>
      ))}
    </div>
  );
}
