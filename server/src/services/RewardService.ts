import { LabyrinthRewardModel, type LabyrinthReward } from '../models/LabyrinthReward.js';
import type { LabyrinthParticipant } from '../models/LabyrinthParticipant.js';

export interface RewardConfig {
  floor_reached?: number;
  final_rank?: number;
  total_participants?: number;
  eliminations?: number;
}

export class RewardService {
  /**
   * Calculate and award rewards based on participant performance
   */
  static async awardRewards(
    labyrinth_id: string,
    participant: LabyrinthParticipant,
    config: RewardConfig
  ): Promise<LabyrinthReward[]> {
    const rewards: LabyrinthReward[] = [];

    // Participation reward (everyone gets something)
    rewards.push(
      await LabyrinthRewardModel.create({
        labyrinth_id,
        character_id: participant.character_id,
        reward_type: 'loot_box',
        reward_id: 'labyrinth_participation_chest',
        quantity: 1,
      })
    );

    // Floor-based rewards
    if (config.floor_reached) {
      if (config.floor_reached >= 5) {
        rewards.push(
          await LabyrinthRewardModel.create({
            labyrinth_id,
            character_id: participant.character_id,
            reward_type: 'title',
            reward_id: `labyrinth_floor_${config.floor_reached}_explorer`,
            quantity: 1,
          })
        );
      }
    }

    // Ranking rewards
    if (config.final_rank && config.total_participants) {
      const rankPercentage = (config.total_participants - config.final_rank + 1) / config.total_participants;

      if (rankPercentage >= 0.9) {
        // Top 10%
        rewards.push(
          await LabyrinthRewardModel.create({
            labyrinth_id,
            character_id: participant.character_id,
            reward_type: 'loot_box',
            reward_id: 'labyrinth_top_performer_chest',
            quantity: 1,
          })
        );
      }

      if (rankPercentage >= 0.95) {
        // Top 5%
        rewards.push(
          await LabyrinthRewardModel.create({
            labyrinth_id,
            character_id: participant.character_id,
            reward_type: 'title',
            reward_id: 'labyrinth_elite_competitor',
            quantity: 1,
          })
        );
      }
    }

    // Winner reward (only for winner)
    if (participant.status === 'winner') {
      rewards.push(
        await LabyrinthRewardModel.create({
          labyrinth_id,
          character_id: participant.character_id,
          reward_type: 'title',
          reward_id: 'labyrinth_champion',
          quantity: 1,
        })
      );
      rewards.push(
        await LabyrinthRewardModel.create({
          labyrinth_id,
          character_id: participant.character_id,
          reward_type: 'loot_box',
          reward_id: 'labyrinth_victor_chest',
          quantity: 1,
        })
      );
      rewards.push(
        await LabyrinthRewardModel.create({
          labyrinth_id,
          character_id: participant.character_id,
          reward_type: 'achievement',
          reward_id: 'labyrinth_victor',
          quantity: 1,
        })
      );
    }

    // Elimination-based rewards
    if (config.eliminations && config.eliminations > 0) {
      if (config.eliminations >= 5) {
        rewards.push(
          await LabyrinthRewardModel.create({
            labyrinth_id,
            character_id: participant.character_id,
            reward_type: 'title',
            reward_id: 'labyrinth_hunter',
            quantity: 1,
          })
        );
      }
    }

    return rewards;
  }

  /**
   * Get all unclaimed rewards for a character
   */
  static async getUnclaimedRewards(character_id: string): Promise<LabyrinthReward[]> {
    return await LabyrinthRewardModel.findUnclaimedByCharacter(character_id);
  }

  /**
   * Mark a reward as claimed
   */
  static async claimReward(reward_id: string): Promise<void> {
    await LabyrinthRewardModel.markClaimed(reward_id);
  }
}
