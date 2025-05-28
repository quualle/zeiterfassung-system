import React, { useState, useEffect } from 'react';
import { User, WorkTimeRule } from '../types';
import { supabase } from '../lib/supabase';

interface WorkTimeRulesProps {
  users: User[];
}

export const WorkTimeRules: React.FC<WorkTimeRulesProps> = ({ users }) => {
  const [workTimeRules, setWorkTimeRules] = useState<WorkTimeRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWorkTimeRules = async () => {
    try {
      const { data, error } = await supabase
        .from('work_time_rules')
        .select('*')
        .order('user_id');

      if (error) throw error;

      // Erstelle Regeln für Benutzer ohne Regeln
      const existingUserIds = data?.map(rule => rule.user_id) || [];
      const usersWithoutRules = users.filter(
        user => user.role !== 'admin' && !existingUserIds.includes(user.id)
      );

      if (usersWithoutRules.length > 0) {
        const newRules = usersWithoutRules.map(user => ({
          user_id: user.id,
          earliest_login_time: '08:00:00',
          latest_logout_time: '18:00:00',
          is_active: true
        }));

        const { data: insertedData, error: insertError } = await supabase
          .from('work_time_rules')
          .insert(newRules)
          .select();

        if (insertError) throw insertError;

        setWorkTimeRules([...(data || []), ...(insertedData || [])]);
      } else {
        setWorkTimeRules(data || []);
      }
    } catch (error) {
      console.error('Error loading work time rules:', error);
    } finally {
      setLoading(false);
    }
  };
    
    loadWorkTimeRules();
  }, [users]);

  const updateWorkTimeRule = async (
    userId: string,
    field: 'earliest_login_time' | 'latest_logout_time',
    value: string
  ) => {
    try {
      // Konvertiere HH:MM zu HH:MM:SS
      const timeValue = value.length === 5 ? `${value}:00` : value;

      const { error } = await supabase
        .from('work_time_rules')
        .update({ [field]: timeValue })
        .eq('user_id', userId);

      if (error) throw error;

      // Aktualisiere lokalen State
      setWorkTimeRules(rules =>
        rules.map(rule =>
          rule.user_id === userId
            ? { ...rule, [field]: timeValue }
            : rule
        )
      );
    } catch (error) {
      console.error('Error updating work time rule:', error);
      alert('Fehler beim Aktualisieren der Arbeitszeiten.');
    }
  };

  const toggleRuleActive = async (userId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('work_time_rules')
        .update({ is_active: isActive })
        .eq('user_id', userId);

      if (error) throw error;

      setWorkTimeRules(rules =>
        rules.map(rule =>
          rule.user_id === userId
            ? { ...rule, is_active: isActive }
            : rule
        )
      );
    } catch (error) {
      console.error('Error toggling rule active state:', error);
      alert('Fehler beim Ändern des Regelstatus.');
    }
  };

  const formatTimeForInput = (time: string) => {
    // Konvertiere HH:MM:SS zu HH:MM für Input
    return time.substring(0, 5);
  };

  if (loading) {
    return <div>Lade Arbeitszeitregeln...</div>;
  }

  const employeeUsers = users.filter(u => u.role !== 'admin');
  
  console.log('All users:', users);
  console.log('Employee users:', employeeUsers);
  console.log('Work time rules:', workTimeRules);

  return (
    <div className="work-time-rules">
      <h2>Arbeitszeitregeln</h2>
      {employeeUsers.length === 0 ? (
        <p>Keine Mitarbeiter gefunden. Stellen Sie sicher, dass Mitarbeiter in der Datenbank existieren.</p>
      ) : (
      <div className="rules-container">
        {employeeUsers.map(user => {
          const rule = workTimeRules.find(r => r.user_id === user.id);
          if (!rule) return null;

          return (
            <div key={user.id} className="rule-card">
              <h3>{user.name}</h3>
              
              <div className="rule-controls">
                <div className="rule-active">
                  <label>
                    <input
                      type="checkbox"
                      checked={rule.is_active}
                      onChange={(e) => toggleRuleActive(user.id, e.target.checked)}
                    />
                    Regel aktiv
                  </label>
                </div>

                <div className="time-controls">
                  <div className="time-control">
                    <label>Früheste Einloggzeit:</label>
                    <input
                      type="time"
                      value={formatTimeForInput(rule.earliest_login_time)}
                      onChange={(e) => updateWorkTimeRule(user.id, 'earliest_login_time', e.target.value)}
                      disabled={!rule.is_active}
                    />
                  </div>

                  <div className="time-control">
                    <label>Späteste Ausloggzeit:</label>
                    <input
                      type="time"
                      value={formatTimeForInput(rule.latest_logout_time)}
                      onChange={(e) => updateWorkTimeRule(user.id, 'latest_logout_time', e.target.value)}
                      disabled={!rule.is_active}
                    />
                  </div>
                </div>

                <div className="time-range-display">
                  <span className="time-range">
                    {rule.is_active ? (
                      <>
                        Arbeitszeit: {formatTimeForInput(rule.earliest_login_time)} - {formatTimeForInput(rule.latest_logout_time)}
                      </>
                    ) : (
                      <span className="inactive">Keine Zeitbeschränkung aktiv</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};