import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameState } from '../systems';
import { SkillManager } from '../systems/skills/SkillManager';
import { AutoSkillManager } from '../systems/combat/AutoSkillManager';
import { getDataLoader } from '../data';
import { MAX_SKILL_BAR_SLOTS } from '@idle-rpg/shared';
import { UI_MESSAGES } from '../constants/ui';
import AutoSkillConfigModal from './AutoSkillConfigModal';
import './SkillTreeModal.css';

interface SkillTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SkillTreeModal({ isOpen, onClose }: SkillTreeModalProps) {
  const { t } = useTranslation('ui');
  const character = useGameState((state) => state.character);
  const setCharacter = useGameState((state) => state.setCharacter);
  const updateSkillBar = useGameState((state) => state.updateSkillBar);
  const updateAutoSkillSetting = useGameState((state) => state.updateAutoSkillSetting);
  const [activeTab, setActiveTab] = useState<'skills' | 'auto-config'>('skills');
  const [filter, setFilter] = useState<'all' | 'available' | 'learned' | 'locked'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [configSkillId, setConfigSkillId] = useState<string | null>(null);

  if (!isOpen || !character) {
    return null;
  }

  const skillTree = SkillManager.getSkillTree(character);
  const dataLoader = getDataLoader();

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
    filteredSkills = filteredSkills.filter((s) => {
      const skillName = dataLoader.getTranslatedName(s.skill).toLowerCase();
      const skillDesc = dataLoader.getTranslatedDescription(s.skill).toLowerCase();
      return skillName.includes(searchTerm.toLowerCase()) || skillDesc.includes(searchTerm.toLowerCase());
    });
  }

  const handleLearnSkill = (skillId: string) => {
    const result = SkillManager.learnSkill(character, skillId, 1);
    if (result.success && result.character) {
      setCharacter(result.character);
    } else {
      alert(result.reason || UI_MESSAGES.CANNOT_LEARN_SKILL());
    }
  };

  const handleAddToSkillBar = (skillId: string) => {
    if (!character) return;
    const currentSkillBar = character.skillBar || [];
    if (currentSkillBar.includes(skillId)) {
      // Remove from skill bar
      updateSkillBar(currentSkillBar.filter((id) => id !== skillId));
    } else if (currentSkillBar.length < MAX_SKILL_BAR_SLOTS) {
      // Add to skill bar
      updateSkillBar([...currentSkillBar, skillId]);
    } else {
      alert(UI_MESSAGES.SKILL_BAR_FULL(MAX_SKILL_BAR_SLOTS));
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
          <h2>{t('skillTree.title')}</h2>
          <div className="skill-points-display">{t('character.skillPoints')}: {character.skillPoints}</div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="skill-tree-tabs">
          <button
            className={activeTab === 'skills' ? 'active' : ''}
            onClick={() => setActiveTab('skills')}
          >
            {t('skillTree.skills')}
          </button>
          <button
            className={activeTab === 'auto-config' ? 'active' : ''}
            onClick={() => setActiveTab('auto-config')}
          >
            {t('skillTree.autoConfig')}
          </button>
        </div>

        <div className="modal-content">
          {activeTab === 'skills' ? (
            <>
              <div className="skill-tree-controls">
                <div className="filter-buttons">
                  <button
                    className={filter === 'all' ? 'active' : ''}
                    onClick={() => setFilter('all')}
                  >
                    {t('skillTree.all')}
                  </button>
                  <button
                    className={filter === 'available' ? 'active' : ''}
                    onClick={() => setFilter('available')}
                  >
                    {t('skillTree.available')}
                  </button>
                  <button
                    className={filter === 'learned' ? 'active' : ''}
                    onClick={() => setFilter('learned')}
                  >
                    {t('skillTree.learned')}
                  </button>
                  <button
                    className={filter === 'locked' ? 'active' : ''}
                    onClick={() => setFilter('locked')}
                  >
                    {t('skillTree.locked')}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder={t('skillTree.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="skill-search"
                />
              </div>

              <div className="skill-list">
                {filteredSkills.length === 0 ? (
                  <div className="no-skills">
                    <div>{t('skillTree.noSkillsFound')}</div>
                    <div className="no-skills-hint">
                      {skillTree.length === 0
                        ? t('skillTree.noSkillsHint')
                        : t('skillTree.adjustFiltersHint')}
                    </div>
                  </div>
                ) : (
                  filteredSkills.map(({ skill, level, canLearn, reason, prerequisitesMet }) => {
                    const isLearned = level > 0;
                    const isMaxLevel = level >= skill.maxLevel;
                    const cost = skill.unlockCost || 1;
                    const requiredLevel = skill.unlockLevel || skill.requirements?.level;
                    const skillName = dataLoader.getTranslatedName(skill);
                    const skillDesc = dataLoader.getTranslatedDescription(skill);

                    return (
                      <div
                        key={skill.id}
                        className={`skill-item ${isLearned ? 'learned' : ''} ${!canLearn ? 'locked' : ''}`}
                      >
                        <div
                          className="skill-icon"
                          style={{ backgroundColor: getSkillTypeColor(skill.type) }}
                        >
                          {skillName.charAt(0)}
                        </div>
                        <div className="skill-details">
                          <div className="skill-header">
                            <div className="skill-name">{skillName}</div>
                            {isLearned && (
                              <div className="skill-level-badge">
                                {t('character.level')} {level}/{skill.maxLevel}
                              </div>
                            )}
                            <div className="skill-type-badge">{t(`common.skillType.${skill.type}`, { ns: 'common' })}</div>
                          </div>
                          <div className="skill-description">{skillDesc}</div>
                          <div className="skill-info">
                            {requiredLevel && (
                              <span className="skill-requirement">{t('character.level')} {requiredLevel}</span>
                            )}
                            {skill.prerequisites && skill.prerequisites.length > 0 && (
                              <span className="skill-requirement">
                                {t('skillTree.requires')}: {skill.prerequisites.join(', ')}
                              </span>
                            )}
                            {skill.manaCost !== undefined && (
                              <span className="skill-info-item">{t('common.combatStats.mana', { ns: 'common' })}: {skill.manaCost}</span>
                            )}
                            {skill.cooldown !== undefined && (
                              <span className="skill-info-item">{t('skill.cooldown')}: {skill.cooldown}s</span>
                            )}
                          </div>
                          {!prerequisitesMet && (
                            <div className="skill-warning">{t('skillTree.prerequisitesNotMet')}</div>
                          )}
                          {reason && !canLearn && <div className="skill-error">{reason}</div>}
                        </div>
                        <div className="skill-actions">
                          {isMaxLevel ? (
                            <div className="skill-maxed">{t('skillTree.max')}</div>
                          ) : isLearned ? (
                            <button
                              className="skill-upgrade-button"
                              onClick={() => handleLearnSkill(skill.id)}
                              disabled={!canLearn}
                              title={reason}
                            >
                              {t('skillTree.upgrade')} ({cost} {t('skillTree.skillPoints')})
                            </button>
                          ) : (
                            <button
                              className="skill-learn-button"
                              onClick={() => handleLearnSkill(skill.id)}
                              disabled={!canLearn}
                              title={reason}
                            >
                              {t('skillTree.learn')} ({cost} {t('skillTree.skillPoints')})
                            </button>
                          )}
                          {isLearned && skill.type === 'active' && !skill.category && (
                            <button
                              className={`skill-bar-button ${(character.skillBar || []).includes(skill.id) ? 'in-bar' : ''}`}
                              onClick={() => handleAddToSkillBar(skill.id)}
                              title={
                                (character.skillBar || []).includes(skill.id)
                                  ? t('skillTree.removeFromBar')
                                  : t('skillTree.addToBar')
                              }
                            >
                              {(character.skillBar || []).includes(skill.id) ? `✓ ${t('skillTree.bar')}` : `+ ${t('skillTree.bar')}`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="auto-config-tab">
              <div className="auto-config-header">
                <h3>{t('autoConfig.autoSkillConfigTitle')}</h3>
                <p className="auto-config-description">
                  {t('autoConfig.description')}
                </p>
              </div>
              <div className="auto-config-skill-list">
                {character.skillBar && character.skillBar.length > 0 ? (
                  character.skillBar.map((skillId) => {
                    const skill = dataLoader.getSkill(skillId);
                    if (!skill) return null;
                    const autoSetting = AutoSkillManager.getAutoSkillSetting(character, skillId);
                    const hasAutoUse = autoSetting.enabled && autoSetting.condition !== 'never';

                    const getConditionDescription = (): string => {
                      if (!autoSetting.enabled || autoSetting.condition === 'never') {
                        return t('tooltips.manualUseOnly');
                      }
                      switch (autoSetting.condition) {
                        case 'always':
                          return t('tooltips.autoAlwaysAvailable');
                        case 'player_health_below':
                          return t('tooltips.autoPlayerHealthBelow', { threshold: autoSetting.threshold });
                        case 'player_health_above':
                          return t('tooltips.autoPlayerHealthAbove', { threshold: autoSetting.threshold });
                        case 'player_mana_above':
                          return t('tooltips.autoPlayerManaAbove', { threshold: autoSetting.threshold });
                        case 'enemy_health_below':
                          return t('tooltips.autoEnemyHealthBelow', { threshold: autoSetting.threshold });
                        case 'enemy_health_above':
                          return t('tooltips.autoEnemyHealthAbove', { threshold: autoSetting.threshold });
                        default:
                          return t('tooltips.manualUseOnly');
                      }
                    };

                    return (
                      <div key={skillId} className="auto-config-skill-item">
                        <div className="auto-config-skill-info">
                          <div className="auto-config-skill-name">{dataLoader.getTranslatedName(skill)}</div>
                          <div className="auto-config-skill-description">{dataLoader.getTranslatedDescription(skill)}</div>
                          <div className="auto-config-skill-condition">
                            {hasAutoUse ? (
                              <span className="auto-config-active">
                                {t('autoConfig.active')}: {getConditionDescription()}
                              </span>
                            ) : (
                              <span className="auto-config-inactive">{t('tooltips.manualUseOnly')}</span>
                            )}
                          </div>
                        </div>
                        <button
                          className="auto-config-edit-button"
                          onClick={() => setConfigSkillId(skillId)}
                        >
                          {t('autoConfig.configure')}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="auto-config-empty">
                    <p>{t('autoConfig.noSkillsInBar')}</p>
                    <p className="auto-config-hint">
                      {t('autoConfig.addSkillsHint')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {configSkillId && character && (
        <AutoSkillConfigModal
          isOpen={true}
          skillId={configSkillId}
          currentSetting={AutoSkillManager.getAutoSkillSetting(character, configSkillId)}
          onClose={() => setConfigSkillId(null)}
          onSave={(setting) => {
            updateAutoSkillSetting(configSkillId, setting);
            setConfigSkillId(null);
          }}
        />
      )}
    </div>
  );
}
