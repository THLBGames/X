import { useTranslation } from 'react-i18next';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { DungeonManager } from '../systems/dungeon';
import './ProgressionPanel.css';

export default function ProgressionPanel() {
  const { t } = useTranslation(['ui', 'common']);
  const character = useGameState((state) => state.character);
  const dungeonProgress = useGameState((state) => state.dungeonProgress);
  const inventory = useGameState((state) => state.inventory);

  if (!character) {
    return null;
  }

  const dataLoader = getDataLoader();
  const allDungeons = dataLoader.getAllDungeons();
  const completedDungeonIds = dungeonProgress.filter((p) => p.completed).map((p) => p.dungeonId);

  // Find recommended dungeons for current level
  const recommendedDungeons = allDungeons
    .filter((dungeon) => {
      if (DungeonManager.isDungeonUnlocked(dungeon, character.level, completedDungeonIds)) {
        const requiredLevel = dungeon.requiredLevel || 1;
        const levelDiff = character.level - requiredLevel;
        return levelDiff >= -2 && levelDiff <= 5; // Within 2 levels below or 5 levels above
      }
      return false;
    })
    .sort((a, b) => {
      const levelA = a.requiredLevel || 1;
      const levelB = b.requiredLevel || 1;
      return levelA - levelB;
    })
    .slice(0, 3);

  // Calculate XP needed for next level
  const xpNeeded = character.experienceToNext - character.experience;
  const xpPercent = (character.experience / character.experienceToNext) * 100;

  // Check if player has skill points to spend
  const hasSkillPoints = character.skillPoints > 0;

  // Check if player has equipment that can be upgraded
  const equipmentSlots = ['weapon', 'offhand', 'helmet', 'chest', 'legs', 'boots', 'gloves', 'ring1', 'ring2', 'amulet'] as const;
  const hasEmptySlots = equipmentSlots.some((slot) => !character.equipment[slot]);

  return (
    <div className="progression-panel">
      <h2>{t('progression.title')}</h2>

      <div className="progression-section">
        <h3>{t('progression.levelProgress.title')}</h3>
        <div className="progress-info">
          <div className="progress-row">
            <span>{t('character.level')}:</span>
            <span className="value">{character.level}</span>
          </div>
          <div className="progress-row">
            <span>{t('character.experience')}:</span>
            <span className="value">{character.experience.toLocaleString()} / {character.experienceToNext.toLocaleString()}</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
            <div className="progress-text">{xpNeeded.toLocaleString()} {t('progression.xpNeeded')}</div>
          </div>
        </div>
      </div>

      <div className="progression-section">
        <h3>{t('progression.recommendedActions.title')}</h3>
        <div className="recommended-actions">
          {recommendedDungeons.length > 0 && (
            <div className="recommended-item">
              <div className="recommended-icon">⚔️</div>
              <div className="recommended-content">
                <div className="recommended-title">{t('progression.recommendedActions.dungeon')}</div>
                <div className="recommended-description">
                  {recommendedDungeons.map((dungeon, index) => (
                    <span key={dungeon.id}>
                      {dataLoader.getTranslatedName(dungeon)}
                      {index < recommendedDungeons.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {hasSkillPoints && (
            <div className="recommended-item">
              <div className="recommended-icon">⭐</div>
              <div className="recommended-content">
                <div className="recommended-title">{t('progression.recommendedActions.skillPoints')}</div>
                <div className="recommended-description">
                  {t('progression.recommendedActions.skillPointsDesc', { count: character.skillPoints })}
                </div>
              </div>
            </div>
          )}

          {hasEmptySlots && (
            <div className="recommended-item">
              <div className="recommended-icon">🎒</div>
              <div className="recommended-content">
                <div className="recommended-title">{t('progression.recommendedActions.equipment')}</div>
                <div className="recommended-description">
                  {t('progression.recommendedActions.equipmentDesc')}
                </div>
              </div>
            </div>
          )}

          <div className="recommended-item">
            <div className="recommended-icon">🏆</div>
            <div className="recommended-content">
              <div className="recommended-title">{t('progression.recommendedActions.quests')}</div>
              <div className="recommended-description">
                {t('progression.recommendedActions.questsDesc')}
              </div>
            </div>
          </div>

          <div className="recommended-item">
            <div className="recommended-icon">⚙️</div>
            <div className="recommended-content">
              <div className="recommended-title">{t('progression.recommendedActions.skills')}</div>
              <div className="recommended-description">
                {t('progression.recommendedActions.skillsDesc')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="progression-section">
        <h3>{t('progression.nextLevelBenefits.title')}</h3>
        <div className="benefits-list">
          <div className="benefit-item">
            <span className="benefit-icon">+</span>
            <span>{t('progression.nextLevelBenefits.skillPoint')}</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">+</span>
            <span>{t('progression.nextLevelBenefits.stats')}</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">+</span>
            <span>{t('progression.nextLevelBenefits.unlock')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
