import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface SickLeave {
  id: string;
  userId: string;
  userName?: string;
  startDate: string;
  endDate: string;
  reason: string;
  certificateRequired: boolean;
  certificateSubmitted: boolean;
  createdAt: string;
  createdBy: string;
}

interface Props {
  currentUser: User;
}

export const SickLeaveManagement: React.FC<Props> = ({ currentUser }) => {
  const [sickLeaves, setSickLeaves] = useState<SickLeave[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    userId: '',
    startDate: '',
    endDate: '',
    reason: '',
    certificateRequired: false
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSickLeaves();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('users_zeiterfassung')
      .select('*')
      .neq('role', 'admin')
      .order('name');

    if (!error && data) {
      setUsers(data);
    }
  };

  const loadSickLeaves = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sick_leaves')
        .select(`
          *,
          users_zeiterfassung!sick_leaves_user_id_fkey (name)
        `)
        .order('start_date', { ascending: false });

      if (!error && data) {
        const enrichedData = data.map(leave => ({
          ...leave,
          userId: leave.user_id,
          userName: leave.users_zeiterfassung?.name,
          startDate: leave.start_date,
          endDate: leave.end_date,
          certificateRequired: leave.certificate_required,
          certificateSubmitted: leave.certificate_submitted,
          createdAt: leave.created_at,
          createdBy: leave.created_by
        }));
        setSickLeaves(enrichedData);
      }
    } catch (error) {
      console.error('Error loading sick leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.userId || !formData.startDate || !formData.endDate) {
      alert('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      alert('Enddatum kann nicht vor Startdatum liegen');
      return;
    }

    try {
      const { error } = await supabase
        .from('sick_leaves')
        .insert({
          user_id: formData.userId,
          start_date: formData.startDate,
          end_date: formData.endDate,
          reason: formData.reason,
          certificate_required: formData.certificateRequired,
          certificate_submitted: false,
          created_by: currentUser.id
        });

      if (error) {
        console.error('Error creating sick leave:', error);
        alert('Fehler beim Speichern der Krankmeldung');
      } else {
        alert('Krankmeldung erfolgreich gespeichert');
        setShowForm(false);
        setFormData({
          userId: '',
          startDate: '',
          endDate: '',
          reason: '',
          certificateRequired: false
        });
        loadSickLeaves();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const toggleCertificate = async (id: string, submitted: boolean) => {
    try {
      const { error } = await supabase
        .from('sick_leaves')
        .update({ certificate_submitted: submitted })
        .eq('id', id);

      if (!error) {
        loadSickLeaves();
      }
    } catch (error) {
      console.error('Error updating certificate status:', error);
    }
  };

  const deleteSickLeave = async (id: string) => {
    if (!window.confirm('Krankmeldung wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('sick_leaves')
        .delete()
        .eq('id', id);

      if (!error) {
        loadSickLeaves();
      }
    } catch (error) {
      console.error('Error deleting sick leave:', error);
    }
  };

  const calculateDays = (start: string, end: string): number => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  return (
    <div className="sick-leave-management">
      <div className="section-header">
        <h3>Krankmeldungen verwalten</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Abbrechen' : 'Neue Krankmeldung'}
        </button>
      </div>

      {showForm && (
        <form className="sick-leave-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Mitarbeiter *</label>
              <select
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                required
              >
                <option value="">Wählen...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Von *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Bis *</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                min={formData.startDate}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Grund / Bemerkung</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={3}
                placeholder="z.B. Grippe, Erkältung, etc."
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.certificateRequired}
                  onChange={(e) => setFormData({ ...formData, certificateRequired: e.target.checked })}
                />
                Attest erforderlich
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-success">Speichern</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              Abbrechen
            </button>
          </div>
        </form>
      )}

      <div className="sick-leaves-list">
        {loading ? (
          <p>Lade...</p>
        ) : sickLeaves.length === 0 ? (
          <p className="no-data">Keine Krankmeldungen vorhanden</p>
        ) : (
          <table className="sick-leaves-table">
            <thead>
              <tr>
                <th>Mitarbeiter</th>
                <th>Von</th>
                <th>Bis</th>
                <th>Tage</th>
                <th>Grund</th>
                <th>Attest</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {sickLeaves.map(leave => (
                <tr key={leave.id}>
                  <td>{leave.userName}</td>
                  <td>{new Date(leave.startDate).toLocaleDateString('de-DE')}</td>
                  <td>{new Date(leave.endDate).toLocaleDateString('de-DE')}</td>
                  <td>{calculateDays(leave.startDate, leave.endDate)}</td>
                  <td>{leave.reason || '-'}</td>
                  <td>
                    {leave.certificateRequired ? (
                      <label className="certificate-status">
                        <input
                          type="checkbox"
                          checked={leave.certificateSubmitted}
                          onChange={(e) => toggleCertificate(leave.id, e.target.checked)}
                        />
                        {leave.certificateSubmitted ? ' Vorhanden' : ' Ausstehend'}
                      </label>
                    ) : (
                      <span className="text-muted">Nicht erforderlich</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteSickLeave(leave.id)}
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style jsx>{`
        .sick-leave-management {
          padding: 20px;
          background: white;
          border-radius: 8px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .sick-leave-form {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .form-row {
          display: flex;
          gap: 20px;
          margin-bottom: 15px;
        }

        .form-group {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          margin-bottom: 5px;
          font-weight: 500;
          color: #495057;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
        }

        .checkbox-group {
          flex-direction: row;
          align-items: center;
        }

        .checkbox-group input {
          margin-right: 8px;
        }

        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }

        .sick-leaves-table {
          width: 100%;
          border-collapse: collapse;
        }

        .sick-leaves-table th,
        .sick-leaves-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #dee2e6;
        }

        .sick-leaves-table th {
          background: #f8f9fa;
          font-weight: 600;
        }

        .certificate-status {
          display: flex;
          align-items: center;
        }

        .certificate-status input {
          margin-right: 5px;
        }

        .text-muted {
          color: #6c757d;
        }

        .btn-sm {
          padding: 4px 8px;
          font-size: 12px;
        }

        .no-data {
          text-align: center;
          padding: 40px;
          color: #6c757d;
        }
      `}</style>
    </div>
  );
};