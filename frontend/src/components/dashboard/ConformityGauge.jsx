export default function ConformityGauge({ score }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#C8A96E' : '#ef4444';
  const label = score >= 80 ? 'Conforme' : score >= 50 ? 'En cours' : 'Attention';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
        {/* Fond */}
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke="rgba(200,169,110,0.1)"
          strokeWidth="8"
        />
        {/* Progress */}
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-cormorant text-3xl font-light" style={{ color }}>{score}%</span>
        <span className="font-dm-mono text-xs text-text-secondary mt-0.5">{label}</span>
      </div>
    </div>
  );
}
