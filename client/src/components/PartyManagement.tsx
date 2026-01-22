import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameState } from '../systems';
import { LabyrinthClient } from '../systems/labyrinth/LabyrinthClient';
import { useLabyrinthState } from '../systems/labyrinth/LabyrinthState';
import './PartyManagement.css';

interface PartyManagementProps {
  labyrinthClient: LabyrinthClient;
}

export default function PartyManagement({ labyrinthClient }: PartyManagementProps) {
  const { t } = useTranslation('ui');
  const character = useGameState((state) => state.character);
  const currentParty = useLabyrinthState((state) => state.currentParty);
  const [partyName, setPartyName] = useState('');
  const currentLabyrinth = useLabyrinthState((state) => state.currentLabyrinth);

  const handleCreateParty = () => {
    if (!character || !currentLabyrinth) return;

    labyrinthClient.createParty(currentLabyrinth.id, character.id, partyName || undefined);
    setPartyName('');
  };

  // Handle joining a party - kept for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleJoinParty = (partyId: string) => {
    if (!character) return;

    labyrinthClient.joinParty(partyId, character.id);
  };

  const handleLeaveParty = () => {
    if (!character || !currentParty) return;

    labyrinthClient.leaveParty(currentParty.id, character.id);
  };

  if (!currentLabyrinth) {
    return (
      <div className="party-management">
        <div className="party-message">{t('labyrinth.noActiveLabyrinth', { defaultValue: 'No active labyrinth' })}</div>
      </div>
    );
  }

  return (
    <div className="party-management">
      <h3>{t('labyrinth.partyManagement', { defaultValue: 'Party Management' })}</h3>

      {currentParty ? (
        <div className="current-party">
          <div className="party-info">
            <h4>{currentParty.name || t('labyrinth.unnamedParty', { defaultValue: 'Unnamed Party' })}</h4>
            <div className="party-members">
              <div className="party-member-label">{t('labyrinth.members', { defaultValue: 'Members' })}:</div>
              {currentParty.members.map((memberId) => (
                <div key={memberId} className={`party-member ${memberId === currentParty.leader_character_id ? 'leader' : ''}`}>
                  {memberId} {memberId === currentParty.leader_character_id && '(Leader)'}
                </div>
              ))}
            </div>
          </div>
          <button className="party-leave-button" onClick={handleLeaveParty}>
            {t('labyrinth.leaveParty', { defaultValue: 'Leave Party' })}
          </button>
        </div>
      ) : (
        <div className="party-creation">
          <div className="party-create-form">
            <input
              type="text"
              placeholder={t('labyrinth.partyNamePlaceholder', { defaultValue: 'Party name (optional)' })}
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              className="party-name-input"
            />
            <button className="party-create-button" onClick={handleCreateParty} disabled={!labyrinthClient.isConnected()}>
              {t('labyrinth.createParty', { defaultValue: 'Create Party' })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
