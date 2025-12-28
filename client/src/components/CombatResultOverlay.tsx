import { useEffect } from 'react';
import './CombatResultOverlay.css';

interface CombatResultOverlayProps {
  result: 'victory' | 'defeat';
  onComplete: () => void;
}

export default function CombatResultOverlay({ result, onComplete }: CombatResultOverlayProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2000); // Show for 2 seconds

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`combat-result-overlay ${result}`}>
      <div className="result-text">{result === 'victory' ? 'VICTORY!' : 'DEFEAT'}</div>
    </div>
  );
}

