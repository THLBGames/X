import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character } from '@idle-rpg/shared';
import { LabyrinthClient } from '../systems/labyrinth/LabyrinthClient';
import { useLabyrinthState } from '../systems/labyrinth/LabyrinthState';
import { useGameState } from '../systems/GameState';
import './LabyrinthCombat.css';

interface LabyrinthCombatProps {
  labyrinthClient: LabyrinthClient;
}

export default function LabyrinthCombat({ labyrinthClient }: LabyrinthCombatProps) {
  const { t } = useTranslation('ui');
  const combatId = useLabyrinthState((state) => state.combatId);
  const combatPrepared = useLabyrinthState((state) => state.combatPrepared);
  const preparedCombatId = useLabyrinthState((state) => state.preparedCombatId);
  const combatState = useLabyrinthState((state) => state.combatState);
  const currentParticipant = useLabyrinthState((state) => state.currentParticipant);
  const character = useGameState((state) => state.character);
  const [preparedCombatData, setPreparedCombatData] = useState<any>(null);

  // Setup combat event listeners
  useEffect(() => {
    const onCombatPrepared = (data: any) => {
      useLabyrinthState.getState().setCombatPrepared(true, data.combat_instance_id);
      setPreparedCombatData(data);
    };

    const onCombatInitiated = (data: any) => {
      useLabyrinthState.getState().setInCombat(true, data.combat_instance_id);
      useLabyrinthState.getState().setCombatPrepared(false, null);
    };

    const onCombatState = (data: any) => {
      useLabyrinthState.getState().setCombatState(data);
    };

    const onCombatEnded = (data: any) => {
      useLabyrinthState.getState().setInCombat(false, null);
      useLabyrinthState.getState().setCombatPrepared(false, null);
      useLabyrinthState.getState().setCombatState(null);
      setPreparedCombatData(null);
    };

    labyrinthClient.callbacks.onCombatPrepared = onCombatPrepared;
    labyrinthClient.callbacks.onCombatInitiated = onCombatInitiated;
    labyrinthClient.callbacks.onCombatState = onCombatState;
    labyrinthClient.callbacks.onCombatEnded = onCombatEnded;

    return () => {
      delete labyrinthClient.callbacks.onCombatPrepared;
      delete labyrinthClient.callbacks.onCombatInitiated;
      delete labyrinthClient.callbacks.onCombatState;
      delete labyrinthClient.callbacks.onCombatEnded;
    };
  }, [labyrinthClient]);

  const handleStartCombat = () => {
    if (!preparedCombatId || !currentParticipant || !character) return;

    labyrinthClient.initiateCombat(
      currentParticipant.id,
      preparedCombatId,
      undefined,
      'pve',
      character
    );
  };

  const handleJoinCombat = () => {
    if (!preparedCombatId || !currentParticipant || !character) return;

    labyrinthClient.joinCombat(currentParticipant.id, preparedCombatId, character);
  };

  return (
    <div className="labyrinth-combat">
      <h3>{t('labyrinth.combat', { defaultValue: 'Combat' })}</h3>
      <div className="combat-content">
        {combatId ? (
          <div className="combat-active">
            <div className="combat-message">
              {t('labyrinth.combatInProgress', { defaultValue: 'Combat in progress...' })}
            </div>
            {combatState && (
              <div className="combat-state">
                {/* TODO: Display combat state UI with participants, monsters, actions, etc. */}
                <pre>{JSON.stringify(combatState, null, 2)}</pre>
              </div>
            )}
          </div>
        ) : combatPrepared && preparedCombatData ? (
          <div className="combat-prepared">
            <div className="combat-message">
              {t('labyrinth.combatReady', { defaultValue: 'Combat ready!' })}
            </div>
            <div className="combat-preview">
              <div className="monsters-count">
                {t('labyrinth.monsters', { defaultValue: 'Monsters' })}: {preparedCombatData.monsters?.length || 0}
              </div>
              <div className="participants-count">
                {t('labyrinth.participants', { defaultValue: 'Participants' })}: {preparedCombatData.participant_ids?.length || 0}
              </div>
            </div>
            <div className="combat-actions">
              <button onClick={handleStartCombat} className="btn-start-combat">
                {t('labyrinth.startCombat', { defaultValue: 'Start Combat' })}
              </button>
              {preparedCombatData.participant_ids && !preparedCombatData.participant_ids.includes(currentParticipant?.id || '') && (
                <button onClick={handleJoinCombat} className="btn-join-combat">
                  {t('labyrinth.joinCombat', { defaultValue: 'Join Combat' })}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="combat-message">
            {t('labyrinth.waitingForCombat', { defaultValue: 'Waiting for combat...' })}
          </div>
        )}
      </div>
    </div>
  );
}
