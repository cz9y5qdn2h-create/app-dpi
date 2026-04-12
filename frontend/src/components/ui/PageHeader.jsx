export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="font-cormorant text-h1 text-text-primary">{title}</h1>
        {subtitle && (
          <p className="font-dm-sans text-sm text-text-secondary mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
