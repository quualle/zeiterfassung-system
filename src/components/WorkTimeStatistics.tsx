import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface WorkTimeData {
  userId: string;
  userName: string;
  totalHours: number;
  totalMinutes: number;
  days: {
    date: string;
    hours: number;
    minutes: number;
    startTime: string;
    endTime: string;
  }[];
}

interface Props {
  currentUser: User;
}

export const WorkTimeStatistics: React.FC<Props> = ({ currentUser }) => {
  const [period, setPeriod] = useState<'thisWeek' | 'thisMonth' | 'lastMonth' | 'custom'>('thisWeek');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [workTimeData, setWorkTimeData] = useState<WorkTimeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  // Berechne Datumsbereiche
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date();

    switch (period) {
      case 'thisWeek':
        // Montag dieser Woche
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startDate = new Date(now);
        startDate.setDate(now.getDate() + diff);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        break;

      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date();
        break;

      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;

      case 'custom':
        if (!customStartDate || !customEndDate) {
          const defaultStart = new Date();
          defaultStart.setDate(defaultStart.getDate() - 7);
          return {
            start: defaultStart.toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0]
          };
        }
        return {
          start: customStartDate,
          end: customEndDate
        };

      default:
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
    }

    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  };

  // Lade Arbeitszeitdaten
  const loadWorkTimeData = async () => {
    setLoading(true);
    try {
      const dateRange = getDateRange();
      
      // Hole alle Benutzer
      const { data: users, error: usersError } = await supabase
        .from('users_zeiterfassung')
        .select('*')
        .neq('role', 'admin')
        .order('name');

      if (usersError) {
        console.error('Error fetching users:', usersError);
        return;
      }

      // Hole Zeiteinträge für den Zeitraum
      const { data: timeEntries, error: entriesError } = await supabase
        .from('time_entries_zeiterfassung')
        .select(`
          *,
          breaks_zeiterfassung (*)
        `)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: false });

      if (entriesError) {
        console.error('Error fetching time entries:', entriesError);
        return;
      }

      // Verarbeite Daten pro Benutzer
      const processedData: WorkTimeData[] = users.map(user => {
        const userEntries = timeEntries?.filter(entry => entry.user_id === user.id) || [];
        
        const days = userEntries.map(entry => {
          if (!entry.start_time || !entry.end_time) {
            return null;
          }

          const start = new Date(entry.start_time);
          const end = new Date(entry.end_time);
          
          // Berechne Pausenzeit
          const breaks = entry.breaks_zeiterfassung || [];
          let totalBreakMinutes = 0;
          
          breaks.forEach((breakEntry: any) => {
            if (breakEntry.start_time && breakEntry.end_time) {
              const breakStart = new Date(breakEntry.start_time);
              const breakEnd = new Date(breakEntry.end_time);
              totalBreakMinutes += (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
            }
          });

          // Berechne Arbeitszeit
          const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60) - totalBreakMinutes;
          const hours = Math.floor(totalMinutes / 60);
          const minutes = Math.round(totalMinutes % 60);

          return {
            date: entry.date,
            hours,
            minutes,
            startTime: start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
            endTime: end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
          };
        }).filter(day => day !== null) as any[];

        // Berechne Gesamtstunden
        const totalMinutes = days.reduce((sum, day) => sum + (day.hours * 60 + day.minutes), 0);
        const totalHours = Math.floor(totalMinutes / 60);
        const remainingMinutes = Math.round(totalMinutes % 60);

        return {
          userId: user.id,
          userName: user.name,
          totalHours,
          totalMinutes: remainingMinutes,
          days
        };
      });

      setWorkTimeData(processedData);
    } catch (error) {
      console.error('Error loading work time data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkTimeData();
  }, [period, customStartDate, customEndDate]);

  // Formatiere Datum für Anzeige
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { 
      weekday: 'short', 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  // Exportiere als CSV
  const exportToCSV = () => {
    const dateRange = getDateRange();
    let csv = 'Mitarbeiter,Datum,Start,Ende,Stunden,Minuten\n';
    
    workTimeData.forEach(userData => {
      userData.days.forEach(day => {
        csv += `"${userData.userName}","${formatDate(day.date)}","${day.startTime}","${day.endTime}",${day.hours},${day.minutes}\n`;
      });
    });

    // Füge Zusammenfassung hinzu
    csv += '\n\nZusammenfassung\n';
    csv += 'Mitarbeiter,Gesamtstunden,Gesamtminuten\n';
    workTimeData.forEach(userData => {
      csv += `"${userData.userName}",${userData.totalHours},${userData.totalMinutes}\n`;
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `arbeitszeiten_${dateRange.start}_${dateRange.end}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="work-time-statistics">
      <h2>Arbeitszeitübersicht</h2>
      
      {/* Zeitraum-Auswahl */}
      <div className="period-selector">
        <label>Zeitraum wählen:</label>
        <select value={period} onChange={(e) => setPeriod(e.target.value as any)}>
          <option value="thisWeek">Diese Woche</option>
          <option value="thisMonth">Dieser Monat</option>
          <option value="lastMonth">Letzter Monat</option>
          <option value="custom">Benutzerdefiniert</option>
        </select>
        
        {period === 'custom' && (
          <div className="custom-date-range">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
            <span> bis </span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        )}
        
        <button onClick={loadWorkTimeData} disabled={loading}>
          {loading ? 'Lade...' : 'Aktualisieren'}
        </button>
        
        <button onClick={exportToCSV} disabled={loading || workTimeData.length === 0}>
          CSV Export
        </button>
      </div>

      {/* Übersichtstabelle */}
      <div className="statistics-table">
        <table>
          <thead>
            <tr>
              <th>Mitarbeiter</th>
              <th>Gesamtstunden</th>
              <th>Arbeitstage</th>
              <th>Ø pro Tag</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {workTimeData.map(userData => {
              const avgMinutes = userData.days.length > 0 
                ? (userData.totalHours * 60 + userData.totalMinutes) / userData.days.length
                : 0;
              const avgHours = Math.floor(avgMinutes / 60);
              const avgMins = Math.round(avgMinutes % 60);

              return (
                <React.Fragment key={userData.userId}>
                  <tr>
                    <td>{userData.userName}</td>
                    <td>
                      <strong>{userData.totalHours}h {userData.totalMinutes}min</strong>
                    </td>
                    <td>{userData.days.length} Tage</td>
                    <td>{avgHours}h {avgMins}min</td>
                    <td>
                      <button
                        onClick={() => setShowDetails(showDetails === userData.userId ? null : userData.userId)}
                      >
                        {showDetails === userData.userId ? 'Verbergen' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Detail-Ansicht */}
                  {showDetails === userData.userId && (
                    <tr className="detail-row">
                      <td colSpan={5}>
                        <div className="detail-table">
                          <table>
                            <thead>
                              <tr>
                                <th>Datum</th>
                                <th>Start</th>
                                <th>Ende</th>
                                <th>Arbeitszeit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {userData.days.map((day, index) => (
                                <tr key={index}>
                                  <td>{formatDate(day.date)}</td>
                                  <td>{day.startTime}</td>
                                  <td>{day.endTime}</td>
                                  <td>{day.hours}h {day.minutes}min</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        
        {workTimeData.length === 0 && !loading && (
          <div className="no-data">
            Keine Daten für den gewählten Zeitraum vorhanden.
          </div>
        )}
      </div>

    </div>
  );
};