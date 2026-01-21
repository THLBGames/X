import { useState, useEffect } from 'react';
import './FloorTimer.css';

interface FloorTimerProps {
  timeRemaining: number; // milliseconds
}

export default function FloorTimer({ timeRemaining }: FloorTimerProps) {
  const [displayTime, setDisplayTime] = useState(timeRemaining);

  useEffect(() => {
    setDisplayTime(timeRemaining);
    const interval = setInterval(() => {
      setDisplayTime(prev => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining]);

  const days = Math.floor(displayTime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((displayTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((displayTime % (1000 * 60 * 60)) / (1000 * 60));

  const isLow = displayTime < 24 * 60 * 60 * 1000; // Less than 24 hours
  const isCritical = displayTime < 60 * 60 * 1000; // Less than 1 hour

  return (
    <div className={`floor-timer ${isLow ? 'low' : ''} ${isCritical ? 'critical' : ''}`}>
      <h4>Time Remaining</h4>
      <div className="timer-display">
        {days > 0 && <span>{days}d </span>}
        <span>{hours}h </span>
        <span>{minutes}m</span>
      </div>
      {isCritical && <div className="warning">WARNING: Time running out!</div>}
    </div>
  );
}
