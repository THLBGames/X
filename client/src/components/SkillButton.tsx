import type { Skill } from '@idle-rpg/shared';
import './SkillButton.css';

interface SkillButtonProps {
  skill: Skill;
  mana: number;
  onUse: () => void;
  disabled?: boolean;
}

export default function SkillButton({ skill, mana, onUse, disabled }: SkillButtonProps) {
  const canUse = !disabled && mana >= (skill.manaCost || 0);
  const manaCost = skill.manaCost || 0;

  return (
    <button
      className={`skill-button ${!canUse ? 'disabled' : ''}`}
      onClick={onUse}
      disabled={!canUse}
      title={skill.description}
    >
      <div className="skill-button-name">{skill.name}</div>
      {manaCost > 0 && (
        <div className="skill-button-cost">
          <span className="mana-icon">⚡</span>
          {manaCost}
        </div>
      )}
    </button>
  );
}

