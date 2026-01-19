import { useState, useEffect } from 'react';
import { useGameState } from '../systems';
import { GuildManager } from '../systems/city/GuildManager';
import { CityManager } from '../systems/city/CityManager';
import type { Guild } from '@idle-rpg/shared';
import { IdleSkillSystem } from '../systems/skills/IdleSkillSystem';
import { getDataLoader } from '../data';
import './GuildPanel.css';

export default function GuildPanel() {
  const character = useGameState((state) => state.character);
  const joinGuild = useGameState((state) => state.joinGuild);
  const switchPrimaryGuild = useGameState((state) => state.switchPrimaryGuild);
  const rankUpGuild = useGameState((state) => state.rankUpGuild);
  const setCharacter = useGameState((state) => state.setCharacter);

  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [canJoinChecks, setCanJoinChecks] = useState<Record<string, { canJoin: boolean; reason?: string }>>({});
  const [canRankUpChecks, setCanRankUpChecks] = useState<Record<string, { canRankUp: boolean; reason?: string }>>({});

  useEffect(() => {
    const loadGuilds = async () => {
      const allGuilds = await GuildManager.getAllGuilds();
      setGuilds(allGuilds);

      if (character) {
        // Check join status for all guilds
        const joinChecks: Record<string, { canJoin: boolean; reason?: string }> = {};
        const rankChecks: Record<string, { canRankUp: boolean; reason?: string }> = {};
        
        for (const guild of allGuilds) {
          const canJoin = await GuildManager.canJoinGuild(character, guild.id);
          joinChecks[guild.id] = canJoin;
          
          const city = character.city;
          if (city) {
            const progress = GuildManager.getGuildProgress(city, guild.id);
            if (progress) {
              const canRank = await GuildManager.canRankUp(character, guild.id);
              rankChecks[guild.id] = canRank;
            }
          }
        }
        
        setCanJoinChecks(joinChecks);
        setCanRankUpChecks(rankChecks);
      }
    };
    loadGuilds();
  }, [character]);

  if (!character) {
    return <div className="guild-panel">No character loaded</div>;
  }

  const city = character.city || CityManager.initializeCity();
  const dataLoader = getDataLoader();

  const handleJoinGuild = async (guildId: string, asPrimary: boolean) => {
    const result = await GuildManager.joinGuild(character, guildId, asPrimary);
    if (result.success && result.character) {
      setCharacter(result.character);
    } else {
      alert(result.reason || 'Failed to join guild');
    }
  };

  const handleSwitchPrimary = async (guildId: string) => {
    const result = await GuildManager.switchPrimaryGuild(character, guildId);
    if (result.success && result.character) {
      setCharacter(result.character);
    } else {
      alert(result.reason || 'Failed to switch primary guild');
    }
  };

  const handleRankUp = async (guildId: string) => {
    const result = await GuildManager.rankUp(character, guildId);
    if (result.success && result.character) {
      setCharacter(result.character);
    } else {
      alert(result.reason || 'Failed to rank up');
    }
  };

  const isPrimaryGuild = (guildId: string) => city.primaryGuildId === guildId;
  const isSecondaryGuild = (guildId: string) => city.secondaryGuildIds.includes(guildId);
  const isGuildMember = (guildId: string) => isPrimaryGuild(guildId) || isSecondaryGuild(guildId);

  const GuildCard = ({ guild }: { guild: Guild }) => {
    const progress = GuildManager.getGuildProgress(city, guild.id);
    const isMember = isGuildMember(guild.id);
    const isPrimary = isPrimaryGuild(guild.id);
    const currentRank = progress?.rank || 0;
    const rankData = guild.ranks.find((r) => r.rank === currentRank);
    const canJoin = canJoinChecks[guild.id] || { canJoin: false };
    const canRank = canRankUpChecks[guild.id] || { canRankUp: false };
    const guildHallLevel = CityManager.getBuildingLevel(city, guild.buildingId);

    return (
      <div className={`guild-card ${isPrimary ? 'primary' : isMember ? 'secondary' : 'not-member'}`}>
        <div className="guild-header">
          <h3 className="guild-name">{guild.name}</h3>
          {isPrimary && <div className="primary-badge">Primary</div>}
          {isSecondaryGuild(guild.id) && <div className="secondary-badge">Secondary</div>}
        </div>
        <div className="guild-description">{guild.description}</div>

        {guildHallLevel === 0 && (
          <div className="guild-requirement">
            Requires {guild.buildingId} to be built
          </div>
        )}

        {isMember && progress && (
          <div className="guild-progress">
            <div className="guild-rank">
              Rank: {rankData?.name || `Rank ${currentRank}`}
            </div>
            <div className="guild-experience">
              Experience: {progress.experience} / {progress.experienceToNext}
            </div>
            {canRank.canRankUp && (
              <button className="rank-up-button" onClick={() => handleRankUp(guild.id)}>
                Rank Up
              </button>
            )}
            {!canRank.canRankUp && canRank.reason && (
              <div className="rank-up-reason">{canRank.reason}</div>
            )}
          </div>
        )}

        {isMember && rankData && (
          <div className="guild-benefits">
            <h4>Current Benefits:</h4>
            <div className="benefits-list">
              <div>Experience Bonus: +{(rankData.benefits.experienceMultiplier * 100).toFixed(0)}%</div>
              {rankData.benefits.vendorDiscount > 0 && (
                <div>Vendor Discount: {(rankData.benefits.vendorDiscount * 100).toFixed(0)}%</div>
              )}
              {Object.keys(guild.skillBonuses).length > 0 && (
                <div className="skill-bonuses">
                  <div>Skill Bonuses:</div>
                  {Object.entries(guild.skillBonuses).map(([skillId, multiplier]) => {
                    const skill = dataLoader.getSkill(skillId);
                    const bonus = isPrimary ? multiplier : multiplier * 0.5;
                    return (
                      <div key={skillId} className="skill-bonus-item">
                        {skill?.name || skillId}: +{((bonus - 1) * 100).toFixed(0)}% XP
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {!isMember && guildHallLevel > 0 && (
          <div className="guild-actions">
            {!city.primaryGuildId && (
              <button
                className="join-primary-button"
                onClick={() => handleJoinGuild(guild.id, true)}
                disabled={!canJoin.canJoin}
              >
                Join as Primary
              </button>
            )}
            {city.secondaryGuildIds.length < 3 && (
              <button
                className="join-secondary-button"
                onClick={() => handleJoinGuild(guild.id, false)}
                disabled={!canJoin.canJoin}
              >
                Join as Secondary
              </button>
            )}
            {!canJoin.canJoin && canJoin.reason && (
              <div className="join-reason">{canJoin.reason}</div>
            )}
          </div>
        )}

        {isSecondaryGuild(guild.id) && !isPrimary && (
          <button
            className="switch-primary-button"
            onClick={() => handleSwitchPrimary(guild.id)}
          >
            Switch to Primary
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="guild-panel">
      <div className="guild-header">
        <h2>Guilds</h2>
        <div className="guild-info">
          <div className="info-item">
            Primary: {city.primaryGuildId ? 'Yes' : 'None'}
          </div>
          <div className="info-item">
            Secondary: {city.secondaryGuildIds.length} / 3
          </div>
        </div>
      </div>

      <div className="guilds-list">
        {guilds.map((guild) => (
          <GuildCard key={guild.id} guild={guild} />
        ))}
      </div>
    </div>
  );
}
