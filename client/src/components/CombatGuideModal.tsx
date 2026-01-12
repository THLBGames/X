import { useTranslation } from 'react-i18next';
import './CombatGuideModal.css';

interface CombatGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CombatGuideModal({ isOpen, onClose }: CombatGuideModalProps) {
  const { t } = useTranslation('ui');

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="combat-guide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('combatGuide.title')}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="guide-section">
            <h3>{t('combatGuide.turnOrder.title')}</h3>
            <p>{t('combatGuide.turnOrder.description')}</p>
            <ul>
              <li>{t('combatGuide.turnOrder.speedBased')}</li>
              <li>{t('combatGuide.turnOrder.fasterFirst')}</li>
              <li>{t('combatGuide.turnOrder.roundBased')}</li>
            </ul>
          </div>

          <div className="guide-section">
            <h3>{t('combatGuide.damage.title')}</h3>
            <p>{t('combatGuide.damage.description')}</p>
            <div className="formula-box">
              <code>{t('combatGuide.damage.formula')}</code>
            </div>
            <p>{t('combatGuide.damage.explanation')}</p>
          </div>

          <div className="guide-section">
            <h3>{t('combatGuide.criticalHits.title')}</h3>
            <p>{t('combatGuide.criticalHits.description')}</p>
            <ul>
              <li>{t('combatGuide.criticalHits.damage')}</li>
              <li>{t('combatGuide.criticalHits.chance')}</li>
              <li>{t('combatGuide.criticalHits.formula')}</li>
            </ul>
          </div>

          <div className="guide-section">
            <h3>{t('combatGuide.defense.title')}</h3>
            <p>{t('combatGuide.defense.description')}</p>
            <div className="formula-box">
              <code>{t('combatGuide.defense.formula')}</code>
            </div>
            <p>{t('combatGuide.defense.explanation')}</p>
          </div>

          <div className="guide-section">
            <h3>{t('combatGuide.statusEffects.title')}</h3>
            <p>{t('combatGuide.statusEffects.description')}</p>
            <ul>
              <li>{t('combatGuide.statusEffects.duration')}</li>
              <li>{t('combatGuide.statusEffects.stacking')}</li>
              <li>{t('combatGuide.statusEffects.expiration')}</li>
            </ul>
          </div>

          <div className="guide-section">
            <h3>{t('combatGuide.tips.title')}</h3>
            <ul>
              <li>{t('combatGuide.tips.speed')}</li>
              <li>{t('combatGuide.tips.defense')}</li>
              <li>{t('combatGuide.tips.critical')}</li>
              <li>{t('combatGuide.tips.skills')}</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="button-confirm" onClick={onClose}>
            {t('combatGuide.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
