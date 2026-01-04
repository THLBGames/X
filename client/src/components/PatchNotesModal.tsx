import { useTranslation } from 'react-i18next';
import { getDataLoader } from '../data';
import type { PatchNoteVersion } from '../data/DataLoader';
import './PatchNotesModal.css';

interface PatchNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PatchNotesModal({ isOpen, onClose }: PatchNotesModalProps) {
  const { t } = useTranslation('ui');
  const dataLoader = getDataLoader();
  const patchNotes = dataLoader.getPatchNotes();

  if (!isOpen) {
    return null;
  }

  if (!patchNotes || !patchNotes.versions || patchNotes.versions.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="patch-notes-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{t('patchNotes.title')}</h2>
            <button className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="modal-content">
            <div className="no-patch-notes">{t('patchNotes.noNotes')}</div>
          </div>
          <div className="modal-footer">
            <button className="button-confirm" onClick={onClose}>
              {t('patchNotes.close')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Sort versions in reverse chronological order (newest first)
  const sortedVersions = [...patchNotes.versions].sort((a, b) => {
    // Try to parse dates, fallback to version string comparison
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (!isNaN(dateA) && !isNaN(dateB)) {
      return dateB - dateA;
    }
    // Fallback to version string comparison
    return b.version.localeCompare(a.version);
  });

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const renderCategory = (title: string, items: string[] | undefined, className: string) => {
    if (!items || items.length === 0) {
      return null;
    }

    return (
      <div className={`patch-category ${className}`}>
        <h4 className="category-title">{title}</h4>
        <ul className="category-list">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    );
  };

  const renderVersion = (version: PatchNoteVersion) => {
    return (
      <div key={version.version} className="patch-version-card">
        <div className="version-header">
          <h3 className="version-number">{t('patchNotes.version', { version: version.version })}</h3>
          <span className="version-date">{t('patchNotes.date', { date: formatDate(version.date) })}</span>
        </div>
        <div className="version-content">
          {renderCategory(t('patchNotes.added'), version.categories.added, 'category-added')}
          {renderCategory(t('patchNotes.changed'), version.categories.changed, 'category-changed')}
          {renderCategory(t('patchNotes.fixed'), version.categories.fixed, 'category-fixed')}
          {renderCategory(t('patchNotes.removed'), version.categories.removed, 'category-removed')}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="patch-notes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('patchNotes.title')}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-content">
          <div className="patch-notes-list">
            {sortedVersions.map(renderVersion)}
          </div>
        </div>
        <div className="modal-footer">
          <button className="button-confirm" onClick={onClose}>
            {t('patchNotes.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

