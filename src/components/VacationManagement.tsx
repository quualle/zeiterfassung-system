import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface Vacation {
  id: string;
  userId: string;
  userName?: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason: string;
  daysCount: number;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

interface Props {
  currentUser: User;
  isEmployee?: boolean;
}

export const VacationManagement: React.FC<Props> = ({ currentUser, isEmployee = false }) => {
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    userId: isEmployee ? currentUser.id : '',
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved'>('pending');

  useEffect(() => {
    loadVacations();
    if (!isEmployee) {
      loadUsers();
    }
  }, [isEmployee]);

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('users_zeiterfassung')
      .select('*')
      .order('name');

    if (!error && data) {
      setUsers(data);
    }
  };

  const loadVacations = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('vacations')
        .select(`
          *,
          users_zeiterfassung!vacations_user_id_fkey (name),
          approver:users_zeiterfassung!vacations_approved_by_fkey (name)
        `)
        .order('created_at', { ascending: false });

      // Mitarbeiter sehen nur ihre eigenen Urlaube
      if (isEmployee) {
        query = query.eq('user_id', currentUser.id);
      }

      const { data, error } = await query;

      if (!error && data) {
        const enrichedData = data.map(vacation => ({
          ...vacation,
          userId: vacation.user_id,
          userName: vacation.users_zeiterfassung?.name,
          startDate: vacation.start_date,
          endDate: vacation.end_date,
          daysCount: vacation.days_count,
          approvedBy: vacation.approved_by,
          approvedAt: vacation.approved_at,
          rejectionReason: vacation.rejection_reason,
          createdAt: vacation.created_at
        }));
        setVacations(enrichedData);
      }
    } catch (error) {
      console.error('Error loading vacations:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateWorkDays = (start: string, end: string): number => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    let workDays = 0;
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Nicht Samstag oder Sonntag
        workDays++;
      }
    }
    
    return workDays;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const userId = isEmployee ? currentUser.id : formData.userId;
    
    if (!userId || !formData.startDate || !formData.endDate) {
      alert('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      alert('Enddatum kann nicht vor Startdatum liegen');
      return;
    }

    const daysCount = calculateWorkDays(formData.startDate, formData.endDate);

    try {
      const insertData: any = {
        user_id: userId,
        start_date: formData.startDate,
        end_date: formData.endDate,
        reason: formData.reason,
        days_count: daysCount,
        status: isEmployee ? 'pending' : 'approved'
      };

      // Wenn Admin für sich selbst einträgt, automatisch genehmigt
      if (!isEmployee || currentUser.role === 'admin') {
        insertData.status = 'approved';
        insertData.approved_by = currentUser.id;
        insertData.approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('vacations')
        .insert(insertData);

      if (error) {
        console.error('Error creating vacation:', error);
        alert('Fehler beim Speichern des Urlaubs');
      } else {
        alert(isEmployee ? 'Urlaubsantrag erfolgreich eingereicht' : 'Urlaub erfolgreich eingetragen');
        setShowForm(false);
        setFormData({
          userId: isEmployee ? currentUser.id : '',
          startDate: '',
          endDate: '',
          reason: ''
        });
        loadVacations();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('vacations')
        .update({
          status: 'approved',
          approved_by: currentUser.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (!error) {
        alert('Urlaub genehmigt');
        loadVacations();
      }
    } catch (error) {
      console.error('Error approving vacation:', error);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Grund für Ablehnung:');
    if (!reason) return;

    try {
      const { error } = await supabase
        .from('vacations')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          approved_by: currentUser.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (!error) {
        alert('Urlaub abgelehnt');
        loadVacations();
      }
    } catch (error) {
      console.error('Error rejecting vacation:', error);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Urlaubsantrag wirklich stornieren?')) return;

    try {
      const { error } = await supabase
        .from('vacations')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (!error) {
        alert('Urlaub storniert');
        loadVacations();
      }
    } catch (error) {
      console.error('Error cancelling vacation:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Urlaub wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('vacations')
        .delete()
        .eq('id', id);

      if (!error) {
        loadVacations();
      }
    } catch (error) {
      console.error('Error deleting vacation:', error);
    }
  };

  const filteredVacations = vacations.filter(v => {
    if (activeTab === 'pending') return v.status === 'pending';
    if (activeTab === 'approved') return v.status === 'approved';
    return true;
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { class: 'badge-warning', text: 'Ausstehend' },
      approved: { class: 'badge-success', text: 'Genehmigt' },
      rejected: { class: 'badge-danger', text: 'Abgelehnt' },
      cancelled: { class: 'badge-secondary', text: 'Storniert' }
    };
    return badges[status as keyof typeof badges] || { class: '', text: status };
  };

  return (
    <div className="vacation-management">
      <div className="section-header">
        <h3>{isEmployee ? 'Meine Urlaube' : 'Urlaubsverwaltung'}</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Abbrechen' : (isEmployee ? 'Urlaub beantragen' : 'Urlaub eintragen')}
        </button>
      </div>

      {showForm && (
        <form className="vacation-form" onSubmit={handleSubmit}>
          {!isEmployee && (
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
          )}

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

          {formData.startDate && formData.endDate && (
            <div className="form-info">
              Arbeitstage: {calculateWorkDays(formData.startDate, formData.endDate)} Tage
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Grund / Bemerkung</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={3}
                placeholder="z.B. Sommerurlaub, Familienurlaub, etc."
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-success">
              {isEmployee ? 'Beantragen' : 'Speichern'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {!isEmployee && (
        <div className="tabs">
          <button 
            className={activeTab === 'pending' ? 'active' : ''} 
            onClick={() => setActiveTab('pending')}
          >
            Ausstehend ({vacations.filter(v => v.status === 'pending').length})
          </button>
          <button 
            className={activeTab === 'approved' ? 'active' : ''} 
            onClick={() => setActiveTab('approved')}
          >
            Genehmigt
          </button>
          <button 
            className={activeTab === 'all' ? 'active' : ''} 
            onClick={() => setActiveTab('all')}
          >
            Alle
          </button>
        </div>
      )}

      <div className="vacations-list">
        {loading ? (
          <p>Lade...</p>
        ) : filteredVacations.length === 0 ? (
          <p className="no-data">Keine Urlaube vorhanden</p>
        ) : (
          <table className="vacations-table">
            <thead>
              <tr>
                {!isEmployee && <th>Mitarbeiter</th>}
                <th>Von</th>
                <th>Bis</th>
                <th>Tage</th>
                <th>Grund</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredVacations.map(vacation => {
                const badge = getStatusBadge(vacation.status);
                return (
                  <tr key={vacation.id}>
                    {!isEmployee && <td>{vacation.userName}</td>}
                    <td>{new Date(vacation.startDate).toLocaleDateString('de-DE')}</td>
                    <td>{new Date(vacation.endDate).toLocaleDateString('de-DE')}</td>
                    <td>{vacation.daysCount}</td>
                    <td>{vacation.reason || '-'}</td>
                    <td>
                      <span className={`badge ${badge.class}`}>
                        {badge.text}
                      </span>
                      {vacation.rejectionReason && (
                        <div className="rejection-reason">
                          Grund: {vacation.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td>
                      {vacation.status === 'pending' && !isEmployee && (
                        <>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleApprove(vacation.id)}
                          >
                            Genehmigen
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleReject(vacation.id)}
                          >
                            Ablehnen
                          </button>
                        </>
                      )}
                      {vacation.status === 'pending' && isEmployee && (
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() => handleCancel(vacation.id)}
                        >
                          Stornieren
                        </button>
                      )}
                      {vacation.status === 'approved' && !isEmployee && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(vacation.id)}
                        >
                          Löschen
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <style jsx>{`
        .vacation-management {
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

        .vacation-form {
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

        .form-info {
          padding: 10px;
          background: #e7f3ff;
          border-radius: 4px;
          margin-bottom: 15px;
          color: #0066cc;
        }

        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }

        .tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          border-bottom: 2px solid #dee2e6;
        }

        .tabs button {
          padding: 10px 20px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          font-size: 14px;
          color: #6c757d;
          transition: all 0.3s;
        }

        .tabs button.active {
          color: #007bff;
          border-bottom-color: #007bff;
        }

        .tabs button:hover:not(.active) {
          color: #495057;
        }

        .vacations-table {
          width: 100%;
          border-collapse: collapse;
        }

        .vacations-table th,
        .vacations-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #dee2e6;
        }

        .vacations-table th {
          background: #f8f9fa;
          font-weight: 600;
        }

        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .badge-warning {
          background: #fff3cd;
          color: #856404;
        }

        .badge-success {
          background: #d4edda;
          color: #155724;
        }

        .badge-danger {
          background: #f8d7da;
          color: #721c24;
        }

        .badge-secondary {
          background: #e2e3e5;
          color: #383d41;
        }

        .rejection-reason {
          font-size: 12px;
          color: #dc3545;
          margin-top: 4px;
        }

        .btn-sm {
          padding: 4px 8px;
          font-size: 12px;
          margin-right: 5px;
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