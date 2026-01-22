import './StairDialog.css';

interface StairDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUseStairs: () => void;
  targetFloor: number;
}

export default function StairDialog({ isOpen, onClose, onUseStairs, targetFloor }: StairDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content stair-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Stairs to Floor {targetFloor}</h3>
        <p>Do you want to proceed to the next floor?</p>
        <div className="dialog-actions">
          <button className="btn-primary" onClick={onUseStairs}>
            Proceed
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
