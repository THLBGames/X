import { useTranslation } from 'react-i18next';
import './OnboardingModal.css';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const { t } = useTranslation('ui');

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    // Mark onboarding as seen
    localStorage.setItem('onboardingShown', 'true');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="onboarding-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('onboarding.title')}</h2>
          <button className="modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="onboarding-welcome">
            <p>{t('onboarding.welcome')}</p>
          </div>

          <div className="onboarding-section">
            <h3>{t('onboarding.combat.title')}</h3>
            <p>{t('onboarding.combat.description')}</p>
            <ul>
              <li>{t('onboarding.combat.step1')}</li>
              <li>{t('onboarding.combat.step2')}</li>
              <li>{t('onboarding.combat.step3')}</li>
            </ul>
          </div>

          <div className="onboarding-section">
            <h3>{t('onboarding.skills.title')}</h3>
            <p>{t('onboarding.skills.description')}</p>
            <ul>
              <li>{t('onboarding.skills.step1')}</li>
              <li>{t('onboarding.skills.step2')}</li>
              <li>{t('onboarding.skills.step3')}</li>
            </ul>
          </div>

          <div className="onboarding-section">
            <h3>{t('onboarding.character.title')}</h3>
            <p>{t('onboarding.character.description')}</p>
            <ul>
              <li>{t('onboarding.character.step1')}</li>
              <li>{t('onboarding.character.step2')}</li>
              <li>{t('onboarding.character.step3')}</li>
            </ul>
          </div>

          <div className="onboarding-section">
            <h3>{t('onboarding.firstSteps.title')}</h3>
            <ul>
              <li>{t('onboarding.firstSteps.step1')}</li>
              <li>{t('onboarding.firstSteps.step2')}</li>
              <li>{t('onboarding.firstSteps.step3')}</li>
            </ul>
          </div>

          <div className="onboarding-tip">
            <strong>{t('onboarding.tip')}</strong>
            <p>{t('onboarding.tipDescription')}</p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="button-confirm" onClick={handleClose}>
            {t('onboarding.start')}
          </button>
        </div>
      </div>
    </div>
  );
}
