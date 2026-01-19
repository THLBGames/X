import { useState, useMemo, useEffect } from 'react';
import { useGameState } from '../systems';
import { ChronicleManager } from '../systems/chronicle/ChronicleManager';
import type { ChronicleCategory, LegendTitle } from '@idle-rpg/shared';
import './ChroniclePanel.css';

export default function ChroniclePanel() {
  const character = useGameState((state) => state.character);
  const setActiveTitle = useGameState((state) => state.setActiveTitle);
  const recordNarrativeChoice = useGameState((state) => state.recordNarrativeChoice);

  const [selectedCategory, setSelectedCategory] = useState<ChronicleCategory | 'all'>('all');
  const [pendingChoice, setPendingChoice] = useState<any>(null);
  const [legendTitles, setLegendTitles] = useState<Record<string, LegendTitle>>({});

  // Load legend titles
  useEffect(() => {
    const loadTitles = async () => {
      try {
        const response = await fetch('/data/chronicle/legend_titles.json');
        if (response.ok) {
          const data = await response.json();
          setLegendTitles(data.titles || {});
        }
      } catch (error) {
        console.error('Failed to load legend titles:', error);
      }
    };
    loadTitles();
  }, []);

  // Check for pending choices
  useEffect(() => {
    if (!character?.chronicle) return;

    const checkForChoices = async () => {
      const chronicle = character.chronicle!;
      // Find unresolved choices
      const unresolvedChoice = chronicle.choiceHistory.find((c) => !c.resolvedAt);
      if (unresolvedChoice) {
        setPendingChoice(unresolvedChoice);
      }
    };

    checkForChoices();
  }, [character]);

  const chronicle = character?.chronicle || ChronicleManager.initializeChronicle();
  const entries = chronicle.entries || [];
  const activeTitleId = chronicle.activeTitleId;
  const unlockedTitles = chronicle.unlockedTitles || [];

  // Filter entries by category
  const filteredEntries = useMemo(() => {
    if (selectedCategory === 'all') {
      return entries;
    }
    return entries.filter((entry) => entry.category === selectedCategory);
  }, [entries, selectedCategory]);

  // Get active title
  const activeTitle = activeTitleId ? legendTitles[activeTitleId] : null;

  // Get unlocked title objects
  const unlockedTitleObjects = useMemo(() => {
    return unlockedTitles
      .map((titleId) => legendTitles[titleId])
      .filter((title): title is LegendTitle => title !== undefined);
  }, [unlockedTitles, legendTitles]);

  if (!character) {
    return <div className="chronicle-panel">No character loaded</div>;
  }

  const handleSelectTitle = (titleId: string | undefined) => {
    setActiveTitle(titleId);
  };

  const handleChoiceOption = (choiceId: string, optionId: string) => {
    recordNarrativeChoice(choiceId, optionId);
    setPendingChoice(null);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const categories: Array<{ value: ChronicleCategory | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'combat', label: 'Combat' },
    { value: 'crafting', label: 'Crafting' },
    { value: 'exploration', label: 'Exploration' },
    { value: 'achievement', label: 'Achievements' },
    { value: 'milestone', label: 'Milestones' },
    { value: 'general', label: 'General' },
  ];

  return (
    <div className="chronicle-panel">
      <div className="chronicle-header">
        <h2>Chronicle</h2>
        <div className="chronicle-subtitle">Your Legend Unfolds</div>
      </div>

      {/* Narrative Choice Dialog */}
      {pendingChoice && (
        <div className="chronicle-choice-dialog-overlay">
          <div className="chronicle-choice-dialog">
            <h3>Narrative Choice</h3>
            <p className="choice-prompt">{pendingChoice.prompt}</p>
            <div className="choice-options">
              {pendingChoice.options.map((option: any) => (
                <button
                  key={option.id}
                  className="choice-option-button"
                  onClick={() => handleChoiceOption(pendingChoice.id, option.id)}
                >
                  <div className="choice-option-text">{option.text}</div>
                  {option.description && (
                    <div className="choice-option-description">{option.description}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="chronicle-content">
        {/* Title Management Section */}
        <div className="chronicle-titles-section">
          <h3>Legend Titles</h3>
          {activeTitle && (
            <div className="active-title">
              <div className="active-title-label">Active Title:</div>
              <div className="active-title-name">{activeTitle.name}</div>
              <div className="active-title-description">{activeTitle.description}</div>
            </div>
          )}
          <div className="titles-list">
            <div className="title-entry" onClick={() => handleSelectTitle(undefined)}>
              <div className={`title-name ${!activeTitleId ? 'selected' : ''}`}>None</div>
              <div className="title-description">No active title</div>
            </div>
            {unlockedTitleObjects.map((title) => (
              <div
                key={title.id}
                className={`title-entry ${activeTitleId === title.id ? 'selected' : ''}`}
                onClick={() => handleSelectTitle(title.id)}
              >
                <div className="title-name">{title.name}</div>
                <div className="title-description">{title.description}</div>
                {title.bonuses && (
                  <div className="title-bonuses">
                    {title.bonuses.statBonus && (
                      <div>Stat Bonuses: {JSON.stringify(title.bonuses.statBonus)}</div>
                    )}
                    {title.bonuses.combatStatBonus && (
                      <div>Combat Bonuses: {JSON.stringify(title.bonuses.combatStatBonus)}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Story Viewer Section */}
        <div className="chronicle-story-section">
          <div className="story-filters">
            {categories.map((cat) => (
              <button
                key={cat.value}
                className={`filter-button ${selectedCategory === cat.value ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.value)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="story-entries">
            {filteredEntries.length === 0 ? (
              <div className="no-entries">No story entries yet. Your legend begins now!</div>
            ) : (
              filteredEntries.map((entry) => (
                <div key={entry.id} className="story-entry">
                  <div className="entry-header">
                    <div className="entry-title">{entry.title}</div>
                    <div className="entry-date">{formatDate(entry.timestamp)}</div>
                  </div>
                  <div className="entry-category">{entry.category}</div>
                  <div className="entry-narrative">{entry.narrative}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
