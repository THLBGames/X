import { useState, useEffect } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { IdleSkillSystem } from '../systems/skills/IdleSkillSystem';
import SkillDetailView from './SkillDetailView';
import type { Skill } from '@idle-rpg/shared';
import './SkillsPanel.css';

export default function SkillsPanel() {
  const character = useGameState((state) => state.character);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [displaySkillId, setDisplaySkillId] = useState<string | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);

  if (!character) {
    return null;
  }

  const dataLoader = getDataLoader();
  const allSkills = dataLoader.getAllSkills();
  const idleSkills = allSkills.filter(
    (skill) => skill.category === 'gathering' || skill.category === 'production' || skill.category === 'hybrid'
  );

  // Group skills by category
  const gatheringSkills = idleSkills.filter((s) => s.category === 'gathering');
  const productionSkills = idleSkills.filter((s) => s.category === 'production');
  const hybridSkills = idleSkills.filter((s) => s.category === 'hybrid');

  const getSkillLevel = (skillId: string) => {
    return IdleSkillSystem.getSkillLevel(character, skillId);
  };

  const getSkillExperience = (skillId: string) => {
    return IdleSkillSystem.getSkillExperience(character, skillId);
  };

  // Handle smooth transition between skills
  useEffect(() => {
    if (selectedSkillId !== displaySkillId) {
      if (displaySkillId !== null) {
        // Fade out current skill
        setIsFadingOut(true);
        const fadeOutTimer = setTimeout(() => {
          setDisplaySkillId(selectedSkillId);
          setIsFadingOut(false);
        }, 300); // Wait for fade-out transition to complete (0.3s)
        return () => clearTimeout(fadeOutTimer);
      } else {
        // First time selecting a skill - no fade out needed
        setDisplaySkillId(selectedSkillId);
      }
    }
  }, [selectedSkillId, displaySkillId]);

  return (
    <div className="skills-panel">
      <h2>Idle Skills</h2>

      <div className="skills-content">
        <div className="skills-list">
          <div className="skill-category">
            <h3>Gathering Skills</h3>
            {gatheringSkills.map((skill) => {
              const level = getSkillLevel(skill.id);
              const experience = getSkillExperience(skill.id);
              const skillData = character.idleSkills?.find((s) => s.skillId === skill.id);
              const expToNext = skillData?.experienceToNext || 100;

              return (
                <div
                  key={skill.id}
                  className={`skill-item ${selectedSkillId === skill.id ? 'selected' : ''}`}
                  onClick={() => setSelectedSkillId(skill.id)}
                >
                  <div className="skill-header">
                    <span className="skill-name">{skill.name}</span>
                    <span className="skill-level">Level {level}</span>
                  </div>
                  <div className="skill-exp">
                    {experience} / {expToNext} XP
                  </div>
                  <div className="skill-exp-bar">
                    <div
                      className="skill-exp-bar-fill"
                      style={{ width: `${(experience / expToNext) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="skill-category">
            <h3>Production Skills</h3>
            {productionSkills.map((skill) => {
              const level = getSkillLevel(skill.id);
              const experience = getSkillExperience(skill.id);
              const skillData = character.idleSkills?.find((s) => s.skillId === skill.id);
              const expToNext = skillData?.experienceToNext || 100;

              return (
                <div
                  key={skill.id}
                  className={`skill-item ${selectedSkillId === skill.id ? 'selected' : ''}`}
                  onClick={() => setSelectedSkillId(skill.id)}
                >
                  <div className="skill-header">
                    <span className="skill-name">{skill.name}</span>
                    <span className="skill-level">Level {level}</span>
                  </div>
                  <div className="skill-exp">
                    {experience} / {expToNext} XP
                  </div>
                  <div className="skill-exp-bar">
                    <div
                      className="skill-exp-bar-fill"
                      style={{ width: `${(experience / expToNext) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {hybridSkills.length > 0 && (
            <div className="skill-category">
              <h3>Hybrid Skills</h3>
              {hybridSkills.map((skill) => {
                const level = getSkillLevel(skill.id);
                const experience = getSkillExperience(skill.id);
                const skillData = character.idleSkills?.find((s) => s.skillId === skill.id);
                const expToNext = skillData?.experienceToNext || 100;

                return (
                  <div
                    key={skill.id}
                    className={`skill-item ${selectedSkillId === skill.id ? 'selected' : ''}`}
                    onClick={() => setSelectedSkillId(skill.id)}
                  >
                    <div className="skill-header">
                      <span className="skill-name">{skill.name}</span>
                      <span className="skill-level">Level {level}</span>
                    </div>
                    <div className="skill-exp">
                      {experience} / {expToNext} XP
                    </div>
                    <div className="skill-exp-bar">
                      <div
                        className="skill-exp-bar-fill"
                        style={{ width: `${(experience / expToNext) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {displaySkillId && (
          <div className={`skill-detail-container ${isFadingOut ? 'fade-out' : 'fade-in'}`}>
            <SkillDetailView key={displaySkillId} skillId={displaySkillId} />
          </div>
        )}
      </div>
    </div>
  );
}

