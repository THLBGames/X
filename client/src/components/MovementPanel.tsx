import { useState, useEffect } from 'react';
import './MovementPanel.css';

interface MovementPanelProps {
  currentPoints: number;
  maxPoints: number;
  regenRate: number;
}

export default function MovementPanel({ currentPoints, maxPoints, regenRate }: MovementPanelProps) {
  const [timeUntilNext, setTimeUntilNext] = useState<number>(0);

  useEffect(() => {
    if (currentPoints >= maxPoints) {
      setTimeUntilNext(0);
      return;
    }

    const hoursUntilNext = 1 / regenRate;
    const msUntilNext = hoursUntilNext * 60 * 60 * 1000;
    setTimeUntilNext(msUntilNext);

    const interval = setInterval(() => {
      setTimeUntilNext(prev => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentPoints, maxPoints, regenRate]);

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="movement-panel">
      <h4>Movement Points</h4>
      <div className="movement-display">
        <div className="movement-bar">
          <div
            className="movement-fill"
            style={{ width: `${(currentPoints / maxPoints) * 100}%` }}
          />
        </div>
        <div className="movement-text">
          {currentPoints.toFixed(1)} / {maxPoints}
        </div>
      </div>
      {currentPoints < maxPoints && (
        <div className="regen-info">
          Next point in: {formatTime(timeUntilNext)}
        </div>
      )}
    </div>
  );
}
