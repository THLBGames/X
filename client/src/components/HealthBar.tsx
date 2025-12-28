import './HealthBar.css';

interface HealthBarProps {
  current: number;
  max: number;
  label?: string;
  showNumbers?: boolean;
  barColor?: string;
  backgroundColor?: string;
  height?: number;
}

export default function HealthBar({
  current,
  max,
  label,
  showNumbers = true,
  barColor,
  backgroundColor,
  height = 20,
}: HealthBarProps) {
  const percentage = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const displayColor = barColor || (percentage > 50 ? '#4a9eff' : percentage > 25 ? '#ffa500' : '#ff4444');

  return (
    <div className="health-bar-container">
      {label && <div className="health-bar-label">{label}</div>}
      <div
        className="health-bar"
        style={{
          height: `${height}px`,
          backgroundColor: backgroundColor || '#1a1a1a',
        }}
      >
        <div
          className="health-bar-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: displayColor,
          }}
        />
        {showNumbers && (
          <div className="health-bar-numbers">
            {Math.floor(current)} / {max}
          </div>
        )}
      </div>
    </div>
  );
}

