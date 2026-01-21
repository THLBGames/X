import { useState } from 'react';
import { AuthService } from '../AuthService';
import './ExportImportPanel.css';

interface ExportImportPanelProps {
  floorId: string;
  labyrinthId: string;
  onClose: () => void;
}

export default function ExportImportPanel({ floorId, labyrinthId, onClose }: ExportImportPanelProps) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      const result = await AuthService.apiRequest<{ success: boolean; data: any }>(
        `/api/admin/labyrinths/${labyrinthId}/floors/${floorId}/export`,
        { method: 'POST' }
      );

      if (result.success) {
        // Download as JSON file
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `floor-${floorId}-export.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Export successful!');
      }
    } catch (err) {
      alert('Export failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();
      const data = JSON.parse(text);

      const result = await AuthService.apiRequest(
        `/api/admin/labyrinths/${labyrinthId}/floors/${floorId}/import`,
        {
          method: 'POST',
          body: JSON.stringify({ data }),
        }
      );

      if (result.success) {
        alert('Import successful! Refreshing layout...');
        window.location.reload();
      }
    } catch (err) {
      alert('Import failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content export-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Export / Import Floor Layout</h3>
          <button className="modal-close-button" onClick={onClose}>×</button>
        </div>
        <div className="export-import-content">
          <div className="export-section">
            <h4>Export</h4>
            <p>Export the current floor layout as a JSON file.</p>
            <button className="btn-export" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export Layout'}
            </button>
          </div>

          <div className="import-section">
            <h4>Import</h4>
            <p>Import a floor layout from a JSON file. This will replace the current layout.</p>
            <label className="file-input-label">
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={importing}
                style={{ display: 'none' }}
              />
              <span className="file-input-button">
                {importing ? 'Importing...' : 'Choose File'}
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
