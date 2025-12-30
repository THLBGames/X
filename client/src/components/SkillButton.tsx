import type { Skill } from '@idle-rpg/shared';
import './SkillButton.css';

interface SkillButtonProps {
  skill: Skill;
  mana: number;
  onUse: () => void;
  disabled?: boolean;
  cooldownRemaining?: number; // Remaining cooldown in seconds
}

export default function SkillButton({
  skill,
  mana,
  onUse,
  disabled,
  cooldownRemaining = 0,
}: SkillButtonProps) {
  const canUse = !disabled && mana >= (skill.manaCost || 0) && cooldownRemaining === 0;
  const manaCost = skill.manaCost || 0;
  const isOnCooldown = cooldownRemaining > 0;

  return (
    <button
      className={`skill-button ${!canUse ? 'disabled' : ''} ${isOnCooldown ? 'on-cooldown' : ''}`}
      onClick={onUse}
      disabled={!canUse}
      title={
        isOnCooldown ? `${skill.description}\nCooldown: ${cooldownRemaining}s` : skill.description
      }
    >
      <div className="skill-button-name">{skill.name}</div>
      {isOnCooldown ? (
        <div className="skill-button-cooldown">{cooldownRemaining}s</div>
      ) : (
        manaCost > 0 && (
          <div className="skill-button-cost">
            <span className="mana-icon">⚡</span>
            {manaCost}
          </div>
        )
      )}
      {isOnCooldown && skill.cooldown && (
        <div
          className="skill-button-cooldown-overlay"
          style={{
            height: `${((skill.cooldown - cooldownRemaining) / skill.cooldown) * 100}%`,
          }}
        />
      )}
    </button>
  );
}
