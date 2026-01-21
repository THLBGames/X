import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameState } from '../systems';
import { LabyrinthClient } from '../systems/labyrinth/LabyrinthClient';
import { useLabyrinthState } from '../systems/labyrinth/LabyrinthState';
import type { LabyrinthReward } from '@idle-rpg/shared';
import './LabyrinthRewards.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface LabyrinthRewardsProps {
  labyrinthClient: LabyrinthClient | null;
}

export default function LabyrinthRewards({ labyrinthClient }: LabyrinthRewardsProps) {
  const { t } = useTranslation('ui');
  const character = useGameState((state) => state.character);
  const rewards = useLabyrinthState((state) => state.rewards);
  const addReward = useLabyrinthState((state) => state.addReward);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!character) return;

    fetchRewards();
  }, [character]);

  const fetchRewards = async () => {
    if (!character) return;

    try {
      setLoading(true);
      const response = await fetch(`${SERVER_URL}/api/labyrinth/rewards/${character.id}`);
      const result = await response.json();
      if (result.success) {
        // Update state with rewards
        result.rewards.forEach((reward: LabyrinthReward) => {
          addReward(reward);
        });
      }
    } catch (error) {
      console.error('Failed to fetch rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = (rewardId: string) => {
    if (!character || !labyrinthClient) return;

    labyrinthClient.claimRewards(character.id, [rewardId]);
    // Remove from state
    useLabyrinthState.setState((state) => ({
      rewards: state.rewards.filter((r) => r.id !== rewardId),
    }));
  };

  const unclaimedRewards = rewards.filter((r) => !r.claimed);

  if (loading) {
    return <div className="labyrinth-rewards-loading">{t('labyrinth.loading', { defaultValue: 'Loading...' })}</div>;
  }

  return (
    <div className="labyrinth-rewards">
      <h3>{t('labyrinth.rewards', { defaultValue: 'Rewards' })}</h3>
      {unclaimedRewards.length === 0 ? (
        <div className="labyrinth-rewards-empty">{t('labyrinth.noRewards', { defaultValue: 'No rewards available' })}</div>
      ) : (
        <div className="rewards-list">
          {unclaimedRewards.map((reward) => (
            <div key={reward.id} className={`reward-item reward-type-${reward.reward_type}`}>
              <div className="reward-info">
                <div className="reward-type">{reward.reward_type}</div>
                <div className="reward-id">{reward.reward_id}</div>
                {reward.quantity > 1 && <div className="reward-quantity">x{reward.quantity}</div>}
              </div>
              <button className="reward-claim-button" onClick={() => handleClaimReward(reward.id)}>
                {t('labyrinth.claim', { defaultValue: 'Claim' })}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
