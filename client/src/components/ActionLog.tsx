import { useEffect, useRef } from 'react';
import type { CombatAction } from '@idle-rpg/shared';
import './ActionLog.css';

interface ActionLogProps {
  actions: CombatAction[];
}

export default function ActionLog({ actions }: ActionLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new actions are added
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [actions]);

  const formatAction = (action: CombatAction): string => {
    const actorName = action.actorId === 'player' ? 'You' : action.actorId;
    const targetName = action.targetId === 'player' ? 'You' : action.targetId;

    switch (action.type) {
      case 'attack':
        return `${actorName} attack${actorName !== 'You' ? 's' : ''} ${targetName} for ${action.damage || 0} damage`;
      case 'skill':
        return `${actorName} use${actorName !== 'You' ? 's' : ''} ${action.skillId || 'a skill'} on ${targetName} for ${action.damage || 0} damage`;
      case 'defend':
        return `${actorName} defend${actorName !== 'You' ? 's' : ''}`;
      case 'item':
        return `${actorName} use${actorName !== 'You' ? 's' : ''} ${action.itemId || 'an item'}`;
      default:
        return `${actorName} performs an action`;
    }
  };

  return (
    <div className="action-log" ref={logRef}>
      {actions.length === 0 ? (
        <div className="action-log-empty">Combat will begin...</div>
      ) : (
        actions.map((action, index) => {
          const isPlayerAction = action.actorId === 'player';
          return (
            <div key={index} className={`action-log-entry ${isPlayerAction ? 'player-action' : 'monster-action'}`}>
              {formatAction(action)}
            </div>
          );
        })
      )}
    </div>
  );
}

