import { useState, useEffect, useMemo } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { IdleSkillSystem } from '../systems/skills/IdleSkillSystem';
import SkillDetailView from './SkillDetailView';
import type { Skill } from '@idle-rpg/shared';
import './SkillsPanel.css';

export default function SkillsPanel() {
  const character = useGameState((state) => state.character);
  const activeAction = useGameState((state) => state.activeAction);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [displaySkillId, setDisplaySkillId] = useState<string | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    idle: true,
    gathering: true,
    production: true,
    hybrid: true,
  });

  if (!character) {
    return null;
  }

  const dataLoader = getDataLoader();
  const allSkills = dataLoader.getAllSkills();

  // Organize skills into categories
  const skillCategories = useMemo(() => {
    const idleSkills = allSkills.filter(
      (skill) =>
        skill.category === 'gathering' ||
        skill.category === 'production' ||
        skill.category === 'hybrid'
    );

    return {
      idle: {
        gathering: idleSkills.filter((s) => s.category === 'gathering'),
        production: idleSkills.filter((s) => s.category === 'production'),
        hybrid: idleSkills.filter((s) => s.category === 'hybrid'),
      },
    };
  }, [allSkills]);

  const getSkillLevel = (skillId: string): number => {
    // All skills in this panel are idle skills
    return IdleSkillSystem.getSkillLevel(character, skillId);
  };

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryKey]: !prev[categoryKey],
    }));
  };

  // Auto-select skill if there's an active action
  useEffect(() => {
    console.log('SkillsPanel auto-select effect', { activeAction, selectedSkillId });
    if (activeAction && activeAction.type === 'skill' && !selectedSkillId) {
      console.log('Auto-selecting skill:', activeAction.skillId);
      setSelectedSkillId(activeAction.skillId);
    }
  }, [activeAction, selectedSkillId]);

  // Handle smooth transition between skills
  useEffect(() => {
    if (selectedSkillId !== displaySkillId) {
      if (displaySkillId !== null) {
        setIsFadingOut(true);
        const fadeOutTimer = setTimeout(() => {
          setDisplaySkillId(selectedSkillId);
          setIsFadingOut(false);
        }, 300);
        return () => clearTimeout(fadeOutTimer);
      } else {
        setDisplaySkillId(selectedSkillId);
      }
    }
  }, [selectedSkillId, displaySkillId]);

  const renderSkillItem = (skill: Skill) => {
    const level = getSkillLevel(skill.id);
    const isSelected = selectedSkillId === skill.id;
    const skillTypeColor =
      skill.type === 'active'
        ? '#4a9eff'
        : skill.type === 'passive'
          ? '#4ecdc4'
          : skill.category === 'gathering'
            ? '#90ee90'
            : skill.category === 'production'
              ? '#ffa500'
              : '#888';

    return (
      <div
        key={skill.id}
        className={`skill-item ${isSelected ? 'selected' : ''}`}
        onClick={() => setSelectedSkillId(skill.id)}
      >
        <div className="skill-item-icon" style={{ backgroundColor: skillTypeColor }}>
          {skill.name.charAt(0)}
        </div>
        <div className="skill-item-content">
          <div className="skill-item-name">{skill.name}</div>
          {level > 0 && <div className="skill-item-level">Lv.{level}</div>}
        </div>
      </div>
    );
  };

  const renderCategorySection = (title: string, categoryKey: string, skills: Skill[]) => {
    if (skills.length === 0) return null;

    const isExpanded = expandedCategories[categoryKey] ?? true;

    return (
      <div className="skill-category-section">
        <div className="skill-category-header" onClick={() => toggleCategory(categoryKey)}>
          <span className="category-chevron">{isExpanded ? '▼' : '▶'}</span>
          <span className="category-title">{title}</span>
          <span className="category-count">({skills.length})</span>
        </div>
        {isExpanded && (
          <div className="skill-category-items">
            {skills.map((skill) => renderSkillItem(skill))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="skills-panel">
      <div className="skills-sidebar">
        <div className="skills-sidebar-header">
          <h2>Skills</h2>
        </div>

        <div className="skills-sidebar-content">
          {/* Idle Skills Section */}
          <div className="skills-main-category">
            {expandedCategories.idle && (
              <div className="skills-subcategories">
                {renderCategorySection('Gathering', 'gathering', skillCategories.idle.gathering)}
                {renderCategorySection('Production', 'production', skillCategories.idle.production)}
                {renderCategorySection('Hybrid', 'hybrid', skillCategories.idle.hybrid)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="skills-main-content">
        {displaySkillId ? (
          <div className={`skill-detail-container ${isFadingOut ? 'fade-out' : 'fade-in'}`}>
            <SkillDetailView key={displaySkillId} skillId={displaySkillId} />
          </div>
        ) : (
          <div className="skills-empty-state">
            <div className="empty-state-icon">⚔️</div>
            <div className="empty-state-text">Select a skill to view details</div>
          </div>
        )}
      </div>
    </div>
  );
}
