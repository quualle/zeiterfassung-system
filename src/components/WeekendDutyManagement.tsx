import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface WeekendDuty {
  id: string;
  userId: string;
  userName?: string;
  startDate: string;
  endDate: string;
  compensation: number;
  notes: string;
  createdAt: string;
  createdBy: string;
}

interface Props {
  currentUser: User;
  isEmployee?: boolean;
}

export const WeekendDutyManagement: React.FC<Props> = ({ currentUser, isEmployee = false }) => {
  const [weekendDuties, setWeekendDuties] = useState<WeekendDuty[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedWeekend, setSelectedWeekend] = useState('');
  const [formData, setFormData] = useState({
    userId: isEmployee ? currentUser.id : '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWeekendDuties();
    if (!isEmployee) {
      loadUsers();
    }
  }, [isEmployee, currentUser.id]);

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('users_zeiterfassung')
      .select('*')
      .order('name');

    if (!error && data) {
      setUsers(data);
    }
  };

  const loadWeekendDuties = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('weekend_duties')
        .select(`
          *,
          users_zeiterfassung!weekend_duties_user_id_fkey (name)
        `)
        .order('start_date', { ascending: false });

      // Mitarbeiter sehen nur ihre eigenen Bereitschaften
      if (isEmployee) {
        query = query.eq('user_id', currentUser.id);
      }

      const { data, error } = await query;

      if (!error && data) {
        const enrichedData = data.map(duty => ({
          ...duty,
          userId: duty.user_id,
          userName: duty.users_zeiterfassung?.name,
          startDate: duty.start_date,
          endDate: duty.end_date,
          createdAt: duty.created_at,
          createdBy: duty.created_by
        }));
        setWeekendDuties(enrichedData);
      }
    } catch (error) {
      console.error('Error loading weekend duties:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generiere die nächsten 8 Wochenenden
  const getUpcomingWeekends = () => {
    const weekends = [];
    const today = new Date();
    
    for (let i = 0; i < 8; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + (i * 7));
      
      // Finde den nächsten Samstag
      const daysUntilSaturday = (6 - date.getDay() + 7) % 7 || 7;
      const saturday = new Date(date);
      saturday.setDate(date.getDate() + daysUntilSaturday);
      
      const sunday = new Date(saturday);
      sunday.setDate(saturday.getDate() + 1);
      
      weekends.push({
        value: saturday.toISOString().split('T')[0],
        label: `${saturday.toLocaleDateString('de-DE')} - ${sunday.toLocaleDateString('de-DE')}`,
        saturday: saturday.toISOString().split('T')[0],
        sunday: sunday.toISOString().split('T')[0]
      });
    }
    
    return weekends;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const userId = isEmployee ? currentUser.id : formData.userId;
    
    if (!userId || !selectedWeekend) {
      alert('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    const weekend = getUpcomingWeekends().find(w => w.value === selectedWeekend);
    if (!weekend) {
      alert('Ungültiges Wochenende ausgewählt');
      return;
    }

    // Prüfe ob bereits eine Bereitschaft für dieses Wochenende existiert
    const { data: existing } = await supabase
      .from('weekend_duties')
      .select('*')
      .eq('start_date', weekend.saturday)
      .single();

    if (existing) {
      alert('Für dieses Wochenende ist bereits eine Bereitschaft eingetragen!');
      return;
    }

    try {
      const { error } = await supabase
        .from('weekend_duties')
        .insert({
          user_id: userId,
          start_date: weekend.saturday,
          end_date: weekend.sunday,
          compensation: 75.00,
          notes: formData.notes,
          created_by: currentUser.id
        });

      if (error) {
        console.error('Error creating weekend duty:', error);
        alert('Fehler beim Speichern der Bereitschaft');
      } else {
        alert('Wochenendbereitschaft erfolgreich eingetragen');
        setShowForm(false);
        setSelectedWeekend('');
        setFormData({
          userId: isEmployee ? currentUser.id : '',
          notes: ''
        });
        loadWeekendDuties();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bereitschaft wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('weekend_duties')
        .delete()
        .eq('id', id);

      if (!error) {
        loadWeekendDuties();
      }
    } catch (error) {
      console.error('Error deleting weekend duty:', error);
    }
  };

  const upcomingWeekends = getUpcomingWeekends();

  // Markiere bereits belegte Wochenenden
  const bookedWeekends = weekendDuties.map(duty => duty.startDate);

  return (
    <div className="weekend-duty-management">
      <div className="section-header">
        <h3>{isEmployee ? 'Meine Wochenendbereitschaften' : 'Wochenendbereitschaften verwalten'}</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Abbrechen' : 'Neue Bereitschaft'}
        </button>
      </div>

      {showForm && (
        <form className="weekend-duty-form" onSubmit={handleSubmit}>
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
              <label>Wochenende *</label>
              <select
                value={selectedWeekend}
                onChange={(e) => setSelectedWeekend(e.target.value)}
                required
              >
                <option value="">Wählen...</option>
                {upcomingWeekends.map(weekend => {
                  const isBooked = bookedWeekends.includes(weekend.saturday);
                  return (
                    <option 
                      key={weekend.value} 
                      value={weekend.value}
                      disabled={isBooked}
                    >
                      {weekend.label} {isBooked ? '(bereits belegt)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="form-info">
            <strong>Vergütung: 75,00 €</strong> (Pauschale für das gesamte Wochenende)
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Bemerkung</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Optionale Bemerkungen..."
              />
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

      <div className="weekend-duties-list">
        {loading ? (
          <p>Lade...</p>
        ) : weekendDuties.length === 0 ? (
          <p className="no-data">Keine Wochenendbereitschaften vorhanden</p>
        ) : (
          <>
            <div className="summary-info">
              <div className="summary-card">
                <h4>Zusammenfassung</h4>
                <p>Anzahl Bereitschaften: <strong>{weekendDuties.length}</strong></p>
                <p>Gesamtvergütung: <strong>{weekendDuties.length * 75} €</strong></p>
              </div>
            </div>

            <table className="weekend-duties-table">
              <thead>
                <tr>
                  {!isEmployee && <th>Mitarbeiter</th>}
                  <th>Wochenende</th>
                  <th>Vergütung</th>
                  <th>Bemerkung</th>
                  <th>Eingetragen am</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {weekendDuties.map(duty => (
                  <tr key={duty.id}>
                    {!isEmployee && <td>{duty.userName}</td>}
                    <td>
                      {new Date(duty.startDate).toLocaleDateString('de-DE', { 
                        weekday: 'short', 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric' 
                      })} - {new Date(duty.endDate).toLocaleDateString('de-DE', { 
                        weekday: 'short', 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric' 
                      })}
                    </td>
                    <td className="compensation">{duty.compensation.toFixed(2)} €</td>
                    <td>{duty.notes || '-'}</td>
                    <td>{new Date(duty.createdAt).toLocaleDateString('de-DE')}</td>
                    <td>
                      {(!isEmployee || duty.userId === currentUser.id) && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(duty.id)}
                        >
                          Löschen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

    </div>
  );
};