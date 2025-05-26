import React, { useState } from 'react';
import { TimeEntry, ChangeRequest } from '../types';
import { createChangeRequest } from '../utils/storageProvider';
import { formatTime } from '../utils/time';

interface ChangeRequestModalProps {
  userId: string;
  entry: TimeEntry;
  onClose: () => void;
  onSuccess: () => void;
}

export const ChangeRequestModal: React.FC<ChangeRequestModalProps> = ({
  userId,
  entry,
  onClose,
  onSuccess
}) => {
  const [requestType, setRequestType] = useState<'time_entry' | 'break'>('time_entry');
  const [selectedBreakIndex, setSelectedBreakIndex] = useState<number>(0);
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [newReason, setNewReason] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!changeReason.trim()) {
      setError('Bitte geben Sie eine Begründung für die Änderung an.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const selectedBreak = requestType === 'break' ? entry.breaks[selectedBreakIndex] : null;
      
      const request: Omit<ChangeRequest, 'id' | 'createdAt' | 'status'> = {
        userId,
        timeEntryId: entry.id,
        requestType,
        breakId: selectedBreak?.id,
        changeReason,
        currentStartTime: requestType === 'time_entry' ? entry.startTime : selectedBreak?.startTime,
        currentEndTime: requestType === 'time_entry' ? entry.endTime : selectedBreak?.endTime,
        currentReason: selectedBreak?.reason,
        newStartTime: newStartTime ? new Date(`${entry.date}T${newStartTime}:00`).toISOString() : undefined,
        newEndTime: newEndTime ? new Date(`${entry.date}T${newEndTime}:00`).toISOString() : undefined,
        newReason: requestType === 'break' ? newReason || undefined : undefined
      };

      await createChangeRequest(request);
      onSuccess();
    } catch (err) {
      setError('Fehler beim Erstellen des Änderungsantrags.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentValues = () => {
    if (requestType === 'time_entry') {
      return {
        start: entry.startTime,
        end: entry.endTime || 'Läuft noch...',
        reason: null
      };
    } else {
      const break_ = entry.breaks[selectedBreakIndex];
      return {
        start: break_?.startTime || '',
        end: break_?.endTime || 'Läuft noch...',
        reason: break_?.reason || ''
      };
    }
  };

  const current = getCurrentValues();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Änderungsantrag stellen</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Was möchten Sie ändern?</label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as 'time_entry' | 'break')}
              className="form-select"
            >
              <option value="time_entry">Arbeitszeit</option>
              {entry.breaks.length > 0 && (
                <option value="break">Pause</option>
              )}
            </select>
          </div>

          {requestType === 'break' && entry.breaks.length > 0 && (
            <div className="form-group">
              <label>Welche Pause?</label>
              <select
                value={selectedBreakIndex}
                onChange={(e) => setSelectedBreakIndex(Number(e.target.value))}
                className="form-select"
              >
                {entry.breaks.map((break_, index) => (
                  <option key={index} value={index}>
                    Pause {index + 1}: {formatTime(break_.startTime)} - {break_.endTime ? formatTime(break_.endTime) : 'Läuft'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="current-values">
            <h3>Aktuelle Werte:</h3>
            <p><strong>Start:</strong> {formatTime(current.start)}</p>
            <p><strong>Ende:</strong> {current.end === 'Läuft noch...' ? current.end : formatTime(current.end)}</p>
            {current.reason && <p><strong>Grund:</strong> {current.reason}</p>}
          </div>

          <div className="form-group">
            <label>Neue Startzeit (HH:MM)</label>
            <input
              type="time"
              value={newStartTime}
              onChange={(e) => setNewStartTime(e.target.value)}
              className="form-input"
              step="60"
            />
            <small>Leer lassen für keine Änderung</small>
          </div>

          <div className="form-group">
            <label>Neue Endzeit (HH:MM)</label>
            <input
              type="time"
              value={newEndTime}
              onChange={(e) => setNewEndTime(e.target.value)}
              className="form-input"
              step="60"
            />
            <small>Leer lassen für keine Änderung</small>
          </div>

          {requestType === 'break' && (
            <div className="form-group">
              <label>Neuer Pausengrund</label>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                className="form-input"
                placeholder="Leer lassen für keine Änderung"
              />
            </div>
          )}

          <div className="form-group">
            <label>Begründung für die Änderung *</label>
            <textarea
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              className="form-textarea"
              rows={3}
              required
              placeholder="Bitte begründen Sie, warum diese Änderung notwendig ist..."
            />
          </div>

          {error && <p className="error">{error}</p>}

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Wird gesendet...' : 'Antrag stellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};