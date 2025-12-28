import type { ActiveStatusEffect } from '@idle-rpg/shared';
import './StatusEffectBadge.css';

interface StatusEffectBadgeProps {
  effect: ActiveStatusEffect;
}

export default function StatusEffectBadge({ effect }: StatusEffectBadgeProps) {
  // Calculate remaining duration (simplified - assumes duration in seconds)
  const remainingSeconds = effect.remainingDuration === -1 
    ? -1 
    : Math.max(0, effect.remainingDuration - (Date.now() - effect.appliedAt) / 1000);

  return (
    <div className="status-effect-badge" title={effect.effectId}>
      <div className="status-effect-icon">{effect.effectId.charAt(0).toUpperCase()}</div>
      {remainingSeconds > 0 && remainingSeconds < 60 && (
        <div className="status-effect-duration">{Math.ceil(remainingSeconds)}s</div>
      )}
    </div>
  );
}

