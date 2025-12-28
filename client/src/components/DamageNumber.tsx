import { useEffect, useState } from 'react';
import './DamageNumber.css';

interface DamageNumberProps {
  value: number;
  isCritical?: boolean;
  isHealing?: boolean;
  x: number;
  y: number;
  onComplete: () => void;
}

export default function DamageNumber({
  value,
  isCritical = false,
  isHealing = false,
  x,
  y,
  onComplete,
}: DamageNumberProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 300); // Wait for fade out animation
    }, 1500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const className = `damage-number ${isCritical ? 'critical' : ''} ${isHealing ? 'healing' : ''} ${!isVisible ? 'fade-out' : ''}`;

  return (
    <div
      className={className}
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      {isCritical && 'CRIT! '}
      {isHealing ? '+' : '-'}
      {value}
    </div>
  );
}

