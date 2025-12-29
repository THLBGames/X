import './OfflineProgressModal.css';

interface OfflineProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  hoursOffline: number;
  progress: {
    combatsCompleted?: number;
    actionsCompleted?: number;
    experience: number;
    gold: number;
    items: Array<{ itemId: string; quantity: number }>;
    died?: boolean;
  };
  actionType: 'combat' | 'skill' | null;
}

export default function OfflineProgressModal({
  isOpen,
  onClose,
  hoursOffline,
  progress,
  actionType,
}: OfflineProgressModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content offline-progress-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Offline Progress</h2>
          <button className="modal-close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="offline-time">
            You were offline for <strong>{hoursOffline.toFixed(2)} hours</strong>
          </div>
          
          {progress.died ? (
            <div className="offline-died">
              <p className="died-message">⚠️ You died during offline combat!</p>
              <p>Processed {progress.combatsCompleted || 0} combats before death.</p>
            </div>
          ) : (
            <>
              {actionType === 'combat' && (
                <div className="offline-stats">
                  <div className="stat-row">
                    <span>Combats Completed:</span>
                    <span className="stat-value">{progress.combatsCompleted || 0}</span>
                  </div>
                  <div className="stat-row">
                    <span>Experience Gained:</span>
                    <span className="stat-value">+{progress.experience}</span>
                  </div>
                  <div className="stat-row">
                    <span>Gold Gained:</span>
                    <span className="stat-value">+{progress.gold}</span>
                  </div>
                  <div className="stat-row">
                    <span>Items Found:</span>
                    <span className="stat-value">{progress.items.length}</span>
                  </div>
                </div>
              )}
              
              {actionType === 'skill' && (
                <div className="offline-stats">
                  <div className="stat-row">
                    <span>Actions Completed:</span>
                    <span className="stat-value">{progress.actionsCompleted || 0}</span>
                  </div>
                  <div className="stat-row">
                    <span>Experience Gained:</span>
                    <span className="stat-value">+{progress.experience}</span>
                  </div>
                  <div className="stat-row">
                    <span>Items Gathered:</span>
                    <span className="stat-value">{progress.items.length}</span>
                  </div>
                </div>
              )}
              
              {progress.items.length > 0 && (
                <div className="offline-items">
                  <h3>Items Gained:</h3>
                  <div className="items-list">
                    {progress.items.map((item, idx) => (
                      <div key={idx} className="item-gain">
                        {item.itemId} x{item.quantity}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="modal-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

