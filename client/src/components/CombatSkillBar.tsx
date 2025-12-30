import { useEffect, useState } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import SkillButton from './SkillButton';
import SkillTreeModal from './SkillTreeModal';
import './CombatSkillBar.css';

interface CombatSkillBarProps {
  onSkillUse: (skillId: string) => void;
}

export default function CombatSkillBar({ onSkillUse }: CombatSkillBarProps) {
  const character = useGameState((state) => state.character);
  const currentCombatState = useGameState((state) => state.currentCombatState);
  const isPlayerTurn = currentCombatState?.currentActor === 'player';
  const playerMana = currentCombatState?.playerMana || 0;
  const dataLoader = getDataLoader();
  const [showSkillTree, setShowSkillTree] = useState(false);

  // Handle keyboard shortcuts (1-8)
  useEffect(() => {
    if (!isPlayerTurn || !character?.skillBar) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      const key = e.key;
      if (key >= '1' && key <= '8') {
        const index = parseInt(key) - 1;
        if (character.skillBar && character.skillBar[index]) {
          const skillId = character.skillBar[index];
          const skill = dataLoader.getSkill(skillId);
          if (skill && playerMana >= (skill.manaCost || 0)) {
            onSkillUse(skillId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlayerTurn, character?.skillBar, playerMana, onSkillUse, dataLoader]);

  if (!character || !character.skillBar || character.skillBar.length === 0) {
    return (
      <>
        <div className="combat-skill-bar empty">
          <div className="skill-bar-message">
            <div className="skill-bar-message-text">No skills assigned to skill bar.</div>
            <button className="skill-bar-open-tree-button" onClick={() => setShowSkillTree(true)}>
              Open Skill Tree
            </button>
          </div>
        </div>
        <SkillTreeModal isOpen={showSkillTree} onClose={() => setShowSkillTree(false)} />
      </>
    );
  }

  // Ensure we have exactly 8 slots (pad with nulls)
  const skillSlots: (string | null)[] = [...character.skillBar];
  while (skillSlots.length < 8) {
    skillSlots.push(null);
  }
  skillSlots.splice(8); // Limit to 8

  return (
    <div className="combat-skill-bar">
      <div className="skill-bar-slots">
        {skillSlots.map((skillId, index) => {
          if (!skillId) {
            return (
              <div key={index} className="skill-slot empty">
                <div className="skill-slot-number">{index + 1}</div>
              </div>
            );
          }

          const skill = dataLoader.getSkill(skillId);
          if (!skill) {
            return (
              <div key={index} className="skill-slot empty">
                <div className="skill-slot-number">{index + 1}</div>
              </div>
            );
          }

          const canUse = playerMana >= (skill.manaCost || 0);
          const skillLevel =
            character.learnedSkills.find((ls) => ls.skillId === skillId)?.level || 0;

          return (
            <div key={index} className={`skill-slot ${!canUse || !isPlayerTurn ? 'disabled' : ''}`}>
              <div className="skill-slot-number">{index + 1}</div>
              <SkillButton
                skill={skill}
                mana={playerMana}
                onUse={() => onSkillUse(skillId)}
                disabled={!canUse || !isPlayerTurn}
              />
              {skillLevel > 0 && <div className="skill-level-indicator">Lv.{skillLevel}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
