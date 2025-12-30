import { useState, useMemo, useEffect } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { StatisticsManager } from '../systems/statistics/StatisticsManager';
import { AchievementManager } from '../systems/achievements/AchievementManager';
// Achievement type imported but not used directly
import './StatisticsPanel.css';

export default function StatisticsPanel() {
  const character = useGameState((state) => state.character);
  const claimAchievementRewards = useGameState((state) => state.claimAchievementRewards);
  // Subscribe to statistics directly using a selector that tracks the statistics object
  // This ensures re-renders when statistics change
  const statistics = useGameState((state) => state.character?.statistics);

  const [activeTab, setActiveTab] = useState<'statistics' | 'achievements' | 'completion'>(
    'statistics'
  );
  const [achievementCategoryFilter, setAchievementCategoryFilter] = useState<string>('all');
  const dataLoader = getDataLoader();

  // Debug: Log when statistics change to verify re-renders
  useEffect(() => {
    if (statistics) {
      console.debug('StatisticsPanel: Statistics updated', {
        totalCombats: statistics.totalCombats,
        totalExperienceEarned: statistics.totalExperienceEarned,
      });
    }
  }, [
    statistics?.totalCombats,
    statistics?.totalExperienceEarned,
    statistics?.monsterKills,
    statistics?.itemsCollected,
    statistics?.skillActions,
  ]);

  // Calculate completion stats
  const completionStats = useMemo(() => {
    if (!character || !statistics) {
      return {
        overall: 0,
        monsters: { completed: 0, total: 0, percentage: 0 },
        items: { completed: 0, total: 0, percentage: 0 },
        skills: { completed: 0, total: 0, percentage: 0 },
      };
    }

    const monsterCompletion = StatisticsManager.getMonsterCompletion(statistics);
    const itemCompletion = StatisticsManager.getItemCompletion(statistics);
    const skillCompletion = StatisticsManager.getSkillCompletion(character);
    const overall = StatisticsManager.getCompletionPercentage(statistics, character);

    return {
      overall,
      monsters: monsterCompletion,
      items: itemCompletion,
      skills: skillCompletion,
    };
  }, [character, statistics]);

  // Get all achievements
  const allAchievements = useMemo(() => {
    return dataLoader.getAllAchievements();
  }, []);

  // Filter achievements
  const filteredAchievements = useMemo(() => {
    let achievements = allAchievements;

    // Filter by category
    if (achievementCategoryFilter !== 'all') {
      achievements = achievements.filter((a) => a.category === achievementCategoryFilter);
    }

    // Sort: completed first, then by category
    return achievements.sort((a, b) => {
      const aCompleted = AchievementManager.isAchievementCompleted(character!, a.id);
      const bCompleted = AchievementManager.isAchievementCompleted(character!, b.id);
      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1; // Completed last
      }
      return a.category.localeCompare(b.category);
    });
  }, [allAchievements, achievementCategoryFilter, character]);

  // Format play time
  const formatPlayTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Handle claim rewards
  const handleClaimRewards = (achievementId: string) => {
    if (!character) return;

    try {
      // Use the GameState action which handles both character and inventory updates atomically
      // This ensures React properly detects the state changes and updates the UI
      claimAchievementRewards(achievementId);
      // Success feedback is handled by the GameState action (alert on error)
    } catch (error) {
      // Error handling is done in GameState, but log for debugging
      console.error('Failed to claim achievement rewards:', error);
    }
  };

  if (!character || !statistics) {
    return (
      <div className="statistics-panel">
        <div className="no-statistics">No statistics available</div>
      </div>
    );
  }

  return (
    <div className="statistics-panel">
      <div className="statistics-header">
        <h2>Statistics & Achievements</h2>
      </div>

      <div className="statistics-tabs">
        <button
          className={`statistics-tab ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          Statistics
        </button>
        <button
          className={`statistics-tab ${activeTab === 'achievements' ? 'active' : ''}`}
          onClick={() => setActiveTab('achievements')}
        >
          Achievements
        </button>
        <button
          className={`statistics-tab ${activeTab === 'completion' ? 'active' : ''}`}
          onClick={() => setActiveTab('completion')}
        >
          Completion
        </button>
      </div>

      {activeTab === 'statistics' && (
        <div className="statistics-content">
          <div className="statistics-section">
            <h3>Combat Statistics</h3>
            <div className="statistics-grid">
              <div className="stat-item">
                <div className="stat-label">Total Combats</div>
                <div className="stat-value">{statistics.totalCombats}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Victories</div>
                <div className="stat-value">{statistics.totalCombatVictories}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Defeats</div>
                <div className="stat-value">{statistics.totalCombatDefeats}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Total Gold Earned</div>
                <div className="stat-value">{statistics.totalGoldEarned.toLocaleString()}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Total Experience</div>
                <div className="stat-value">
                  {statistics.totalExperienceEarned.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="statistics-section">
            <h3>Skill Statistics</h3>
            <div className="statistics-grid">
              <div className="stat-item">
                <div className="stat-label">Total Skill Actions</div>
                <div className="stat-value">{statistics.totalSkillActions}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Total Skill Experience</div>
                <div className="stat-value">{statistics.totalSkillExperience.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="statistics-section">
            <h3>Monster Kills</h3>
            <div className="statistics-list">
              {Object.entries(statistics.monsterKills)
                .sort(([, a], [, b]) => b - a)
                .map(([monsterId, count]) => {
                  const monster = dataLoader.getMonster(monsterId);
                  return (
                    <div key={monsterId} className="stat-list-item">
                      <div className="stat-list-name">{monster?.name || monsterId}</div>
                      <div className="stat-list-value">{count}</div>
                    </div>
                  );
                })}
              {Object.keys(statistics.monsterKills).length === 0 && (
                <div className="no-stats">No monsters killed yet</div>
              )}
            </div>
          </div>

          <div className="statistics-section">
            <h3>Items Collected</h3>
            <div className="statistics-list">
              {Object.entries(statistics.itemsCollected)
                .filter(([itemId]) => itemId !== 'gold') // Filter out gold
                .sort(([, a], [, b]) => b - a)
                .map(([itemId, quantity]) => {
                  const item = dataLoader.getItem(itemId);
                  return (
                    <div key={itemId} className="stat-list-item">
                      <div className="stat-list-name">{item?.name || itemId}</div>
                      <div className="stat-list-value">{quantity}</div>
                    </div>
                  );
                })}
              {Object.keys(statistics.itemsCollected).filter((id) => id !== 'gold').length ===
                0 && <div className="no-stats">No items collected yet</div>}
            </div>
          </div>

          <div className="statistics-section">
            <h3>Skill Actions</h3>
            <div className="statistics-list">
              {Object.entries(statistics.skillActions)
                .sort(([, a], [, b]) => b - a)
                .map(([skillId, count]) => {
                  const skill = dataLoader.getSkill(skillId);
                  return (
                    <div key={skillId} className="stat-list-item">
                      <div className="stat-list-name">{skill?.name || skillId}</div>
                      <div className="stat-list-value">{count}</div>
                    </div>
                  );
                })}
              {Object.keys(statistics.skillActions).length === 0 && (
                <div className="no-stats">No skill actions completed yet</div>
              )}
            </div>
          </div>

          <div className="statistics-section">
            <h3>Play Time</h3>
            <div className="statistics-grid">
              <div className="stat-item">
                <div className="stat-label">Total Play Time</div>
                <div className="stat-value">{formatPlayTime(statistics.totalPlayTime)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">First Played</div>
                <div className="stat-value">
                  {new Date(statistics.firstPlayed).toLocaleDateString()}
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Last Played</div>
                <div className="stat-value">
                  {new Date(statistics.lastPlayed).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'achievements' && (
        <div className="achievements-content">
          <div className="achievements-filters">
            <button
              className={`filter-button ${achievementCategoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => setAchievementCategoryFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-button ${achievementCategoryFilter === 'combat' ? 'active' : ''}`}
              onClick={() => setAchievementCategoryFilter('combat')}
            >
              Combat
            </button>
            <button
              className={`filter-button ${achievementCategoryFilter === 'collection' ? 'active' : ''}`}
              onClick={() => setAchievementCategoryFilter('collection')}
            >
              Collection
            </button>
            <button
              className={`filter-button ${achievementCategoryFilter === 'skilling' ? 'active' : ''}`}
              onClick={() => setAchievementCategoryFilter('skilling')}
            >
              Skilling
            </button>
            <button
              className={`filter-button ${achievementCategoryFilter === 'completion' ? 'active' : ''}`}
              onClick={() => setAchievementCategoryFilter('completion')}
            >
              Completion
            </button>
            <button
              className={`filter-button ${achievementCategoryFilter === 'milestone' ? 'active' : ''}`}
              onClick={() => setAchievementCategoryFilter('milestone')}
            >
              Milestone
            </button>
          </div>

          <div className="achievements-list">
            {filteredAchievements.map((achievement) => {
              const isCompleted = AchievementManager.isAchievementCompleted(
                character,
                achievement.id
              );
              const completedAchievement = character.completedAchievements?.find(
                (ca) => ca.achievementId === achievement.id
              );
              // Calculate progress - this will recalculate when statistics or character changes
              // because the component re-renders when those values change
              const progress = AchievementManager.getAchievementProgress(
                achievement,
                statistics,
                character
              );

              return (
                <div
                  key={`${achievement.id}-${statistics?.totalCombats || 0}-${statistics?.monsterKills ? Object.keys(statistics.monsterKills).length : 0}`}
                  className={`achievement-card ${isCompleted ? 'completed' : ''} ${achievement.hidden && !isCompleted ? 'hidden' : ''}`}
                >
                  <div className="achievement-header">
                    <div className="achievement-name">{achievement.name}</div>
                    {isCompleted && <div className="achievement-badge">✓ Completed</div>}
                  </div>
                  <div className="achievement-description">{achievement.description}</div>
                  <div className="achievement-category">{achievement.category}</div>

                  {!isCompleted && (
                    <div className="achievement-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                      <div className="progress-text">
                        {(() => {
                          // Show detailed progress based on achievement requirements
                          const req = achievement.requirements;
                          if (req.totalCombats !== undefined) {
                            const currentCombats = statistics?.totalCombats || 0;
                            return `${currentCombats} / ${req.totalCombats} combats completed`;
                          }
                          if (req.monsterKills) {
                            const kills = Object.entries(req.monsterKills)
                              .map(([monsterId, required]) => {
                                const actual = statistics.monsterKills[monsterId] || 0;
                                const monster = dataLoader.getMonster(monsterId);
                                return `${monster?.name || monsterId}: ${actual}/${required}`;
                              })
                              .join(', ');
                            return kills || `${progress.progress} / ${progress.total}`;
                          }
                          if (req.itemsCollected) {
                            const items = Object.entries(req.itemsCollected)
                              .map(([itemId, required]) => {
                                const actual = statistics.itemsCollected[itemId] || 0;
                                const item = dataLoader.getItem(itemId);
                                return `${item?.name || itemId}: ${actual}/${required}`;
                              })
                              .join(', ');
                            return items || `${progress.progress} / ${progress.total}`;
                          }
                          if (req.skillActions) {
                            const actions = Object.entries(req.skillActions)
                              .map(([skillId, required]) => {
                                const actual = statistics.skillActions[skillId] || 0;
                                const skill = dataLoader.getSkill(skillId);
                                return `${skill?.name || skillId}: ${actual}/${required}`;
                              })
                              .join(', ');
                            return actions || `${progress.progress} / ${progress.total}`;
                          }
                          // Fallback to generic progress
                          return `${progress.progress} / ${progress.total} (${progress.percentage.toFixed(1)}%)`;
                        })()}
                      </div>
                    </div>
                  )}

                  {isCompleted && completedAchievement && (
                    <div className="achievement-completed-info">
                      Completed: {new Date(completedAchievement.completedAt).toLocaleDateString()}
                    </div>
                  )}

                  {isCompleted && achievement.rewards && (
                    <div className="achievement-rewards">
                      <div className="rewards-label">Rewards:</div>
                      {achievement.rewards.gold && (
                        <div className="reward-item">Gold: {achievement.rewards.gold}</div>
                      )}
                      {achievement.rewards.items && achievement.rewards.items.length > 0 && (
                        <div className="reward-item">
                          Items:{' '}
                          {achievement.rewards.items
                            .map((item) => {
                              const itemData = dataLoader.getItem(item.itemId);
                              return `${item.quantity}x ${itemData?.name || item.itemId}`;
                            })
                            .join(', ')}
                        </div>
                      )}
                      {achievement.rewards.title && (
                        <div className="reward-item">Title: {achievement.rewards.title}</div>
                      )}
                      {completedAchievement && !completedAchievement.rewardsClaimed && (
                        <button
                          className="claim-rewards-button"
                          onClick={() => handleClaimRewards(achievement.id)}
                        >
                          Claim Rewards
                        </button>
                      )}
                      {completedAchievement && completedAchievement.rewardsClaimed && (
                        <div className="rewards-claimed">Rewards Claimed</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredAchievements.length === 0 && (
              <div className="no-achievements">No achievements found</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'completion' && (
        <div className="completion-content">
          <div className="completion-overview">
            <h3>Overall Completion</h3>
            <div className="completion-percentage">
              <div className="percentage-value">{completionStats.overall.toFixed(2)}%</div>
              <div className="progress-bar-large">
                <div
                  className="progress-fill-large"
                  style={{ width: `${completionStats.overall}%` }}
                />
              </div>
            </div>
          </div>

          <div className="completion-breakdown">
            <div className="completion-category">
              <div className="category-header">
                <div className="category-name">Monsters</div>
                <div className="category-percentage">
                  {completionStats.monsters.percentage.toFixed(2)}%
                </div>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${completionStats.monsters.percentage}%` }}
                />
              </div>
              <div className="category-stats">
                {completionStats.monsters.completed} / {completionStats.monsters.total} monsters
                killed
              </div>
            </div>

            <div className="completion-category">
              <div className="category-header">
                <div className="category-name">Items</div>
                <div className="category-percentage">
                  {completionStats.items.percentage.toFixed(2)}%
                </div>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${completionStats.items.percentage}%` }}
                />
              </div>
              <div className="category-stats">
                {completionStats.items.completed} / {completionStats.items.total} items collected
              </div>
            </div>

            <div className="completion-category">
              <div className="category-header">
                <div className="category-name">Skills</div>
                <div className="category-percentage">
                  {completionStats.skills.percentage.toFixed(2)}%
                </div>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${completionStats.skills.percentage}%` }}
                />
              </div>
              <div className="category-stats">
                {completionStats.skills.completed} / {completionStats.skills.total} skills maxed
              </div>
            </div>
          </div>

          <div className="completion-requirements">
            <h3>Remaining Requirements</h3>
            <div className="requirements-list">
              {completionStats.monsters.completed < completionStats.monsters.total && (
                <div className="requirement-item">
                  Kill {completionStats.monsters.total - completionStats.monsters.completed} more
                  unique monsters
                </div>
              )}
              {completionStats.items.completed < completionStats.items.total && (
                <div className="requirement-item">
                  Collect {completionStats.items.total - completionStats.items.completed} more
                  unique items
                </div>
              )}
              {completionStats.skills.completed < completionStats.skills.total && (
                <div className="requirement-item">
                  Max level {completionStats.skills.total - completionStats.skills.completed} more
                  skills
                </div>
              )}
              {completionStats.overall >= 100 && (
                <div className="requirement-item completed">100% Completion Achieved!</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
