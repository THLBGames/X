import { useState } from 'react';
import { useGameState } from '../systems';
import { SkillManager } from '../systems/skills/SkillManager';
import { getDataLoader } from '../data';
import './SkillTreeModal.css';

interface SkillTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SkillTreeModal({ isOpen, onClose }: SkillTreeModalProps) {
  const character = useGameState((state) => state.character);
  const setCharacter = useGameState((state) => state.setCharacter);
  const updateSkillBar = useGameState((state) => state.updateSkillBar);
  const [filter, setFilter] = useState<'all' | 'available' | 'learned' | 'locked'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen || !character) {
    return null;
  }

  const skillTree = SkillManager.getSkillTree(character);
  // const dataLoader = getDataLoader();

  // Filter skills
  let filteredSkills = skillTree;
  if (filter === 'available') {
    filteredSkills = skillTree.filter((s) => s.canLearn && !s.level);
  } else if (filter === 'learned') {
    filteredSkills = skillTree.filter((s) => s.level > 0);
  } else if (filter === 'locked') {
    filteredSkills = skillTree.filter((s) => !s.canLearn && !s.level);
  }

  // Search filter
  if (searchTerm) {
    filteredSkills = filteredSkills.filter((s) =>
      s.skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.skill.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  const handleLearnSkill = (skillId: string) => {
    const result = SkillManager.learnSkill(character, skillId, 1);
    if (result.success && result.character) {
      setCharacter(result.character);
    } else {
      alert(result.reason || 'Cannot learn skill');
    }
  };

  const handleAddToSkillBar = (skillId: string) => {
    if (!character) return;
    const currentSkillBar = character.skillBar || [];
    if (currentSkillBar.includes(skillId)) {
      // Remove from skill bar
      updateSkillBar(currentSkillBar.filter((id) => id !== skillId));
    } else if (currentSkillBar.length < 8) {
      // Add to skill bar
      updateSkillBar([...currentSkillBar, skillId]);
    } else {
      alert('Skill bar is full (max 8 skills)');
    }
  };

  const getSkillTypeColor = (type: string) => {
    switch (type) {
      case 'active':
        return '#4a9eff';
      case 'passive':
        return '#4ecdc4';
      default:
        return '#888';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="skill-tree-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Skill Tree</h2>
          <div className="skill-points-display">Skill Points: {character.skillPoints}</div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="skill-tree-controls">
            <div className="filter-buttons">
              <button
                className={filter === 'all' ? 'active' : ''}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                className={filter === 'available' ? 'active' : ''}
                onClick={() => setFilter('available')}
              >
                Available
              </button>
              <button
                className={filter === 'learned' ? 'active' : ''}
                onClick={() => setFilter('learned')}
              >
                Learned
              </button>
              <button
                className={filter === 'locked' ? 'active' : ''}
                onClick={() => setFilter('locked')}
              >
                Locked
              </button>
            </div>
            <input
              type="text"
              placeholder="Search skills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="skill-search"
            />
          </div>

          <div className="skill-list">
            {filteredSkills.length === 0 ? (
              <div className="no-skills">
                <div>No skills found</div>
                <div className="no-skills-hint">
                  {skillTree.length === 0
                    ? 'Skills may still be loading or your class has no skills assigned.'
                    : 'Try adjusting your filters or search terms.'}
                </div>
              </div>
            ) : (
              filteredSkills.map(({ skill, level, canLearn, reason, prerequisitesMet }) => {
                const isLearned = level > 0;
                const isMaxLevel = level >= skill.maxLevel;
                const cost = skill.unlockCost || 1;
                const requiredLevel = skill.unlockLevel || skill.requirements?.level;

                return (
                  <div
                    key={skill.id}
                    className={`skill-item ${isLearned ? 'learned' : ''} ${!canLearn ? 'locked' : ''}`}
                  >
                    <div
                      className="skill-icon"
                      style={{ backgroundColor: getSkillTypeColor(skill.type) }}
                    >
                      {skill.name.charAt(0)}
                    </div>
                    <div className="skill-details">
                      <div className="skill-header">
                        <div className="skill-name">{skill.name}</div>
                        {isLearned && (
                          <div className="skill-level-badge">
                            Level {level}/{skill.maxLevel}
                          </div>
                        )}
                        <div className="skill-type-badge">{skill.type}</div>
                      </div>
                      <div className="skill-description">{skill.description}</div>
                      <div className="skill-info">
                        {requiredLevel && (
                          <span className="skill-requirement">Level {requiredLevel}</span>
                        )}
                        {skill.prerequisites && skill.prerequisites.length > 0 && (
                          <span className="skill-requirement">
                            Requires: {skill.prerequisites.join(', ')}
                          </span>
                        )}
                        {skill.manaCost !== undefined && (
                          <span className="skill-info-item">Mana: {skill.manaCost}</span>
                        )}
                        {skill.cooldown !== undefined && (
                          <span className="skill-info-item">Cooldown: {skill.cooldown}s</span>
                        )}
                      </div>
                      {!prerequisitesMet && (
                        <div className="skill-warning">Prerequisites not met</div>
                      )}
                      {reason && !canLearn && (
                        <div className="skill-error">{reason}</div>
                      )}
                    </div>
                    <div className="skill-actions">
                      {isMaxLevel ? (
                        <div className="skill-maxed">MAX</div>
                      ) : isLearned ? (
                        <button
                          className="skill-upgrade-button"
                          onClick={() => handleLearnSkill(skill.id)}
                          disabled={!canLearn}
                          title={reason}
                        >
                          Upgrade ({cost} SP)
                        </button>
                      ) : (
                        <button
                          className="skill-learn-button"
                          onClick={() => handleLearnSkill(skill.id)}
                          disabled={!canLearn}
                          title={reason}
                        >
                          Learn ({cost} SP)
                        </button>
                      )}
                      {isLearned && skill.type === 'active' && !skill.category && (
                        <button
                          className={`skill-bar-button ${(character.skillBar || []).includes(skill.id) ? 'in-bar' : ''}`}
                          onClick={() => handleAddToSkillBar(skill.id)}
                          title={(character.skillBar || []).includes(skill.id) ? 'Remove from skill bar' : 'Add to skill bar'}
                        >
                          {(character.skillBar || []).includes(skill.id) ? '✓ Bar' : '+ Bar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

