export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="lg-greeting">{title}</h1>
        {subtitle && <p className="lg-gsub">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2 flex-wrap">{action}</div>}
    </div>
  );
}
