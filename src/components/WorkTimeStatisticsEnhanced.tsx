import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';


interface WorkTimeData {
  userId: string;
  userName: string;
  weeklyHours: number | null;
  totalHours: number;
  totalMinutes: number;
  targetHours: number;
  overtimeHours: number;
  overtimeMinutes: number;
  sickDays: number;
  vacationDays: number;
  weekendDuties: number;
  days: {
    date: string;
    hours: number;
    minutes: number;
    startTime: string;
    endTime: string;
    type: 'work' | 'sick' | 'vacation' | 'weekend_duty';
  }[];
  weekSummaries?: {
    weekNumber: number;
    weekStart: string;
    weekEnd: string;
    workedHours: number;
    targetHours: number;
    overtime: number;
  }[];
}

interface Props {
  currentUser: User;
}

export const WorkTimeStatisticsEnhanced: React.FC<Props> = ({ currentUser }) => {
  const [period, setPeriod] = useState<'thisWeek' | 'thisMonth' | 'lastMonth' | 'custom'>('thisMonth');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [workTimeData, setWorkTimeData] = useState<WorkTimeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Berechne Datumsbereiche
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date();

    switch (period) {
      case 'thisWeek':
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
          defaultStart.setMonth(defaultStart.getMonth() - 1);
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

  // Berechne Arbeitstage im Zeitraum (ohne Wochenenden)
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

  // Berechne Wochen im Zeitraum
  const getWeekNumber = (date: Date): number => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  // Lade erweiterte Arbeitszeitdaten
  const loadWorkTimeData = async () => {
    setLoading(true);
    try {
      const dateRange = getDateRange();
      
      // Hole alle Benutzer mit Soll-Arbeitszeit
      const { data: users, error: usersError } = await supabase
        .from('users_zeiterfassung')
        .select('*, weekly_hours')
        .neq('role', 'admin')
        .order('name');

      if (usersError) {
        console.error('Error fetching users:', usersError);
        return;
      }

      // Hole Zeiteinträge
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

      // Hole Krankmeldungen
      const { data: sickLeaves } = await supabase
        .from('sick_leaves')
        .select('*')
        .lte('start_date', dateRange.end)
        .gte('end_date', dateRange.start);

      // Hole Urlaube
      const { data: vacations } = await supabase
        .from('vacations')
        .select('*')
        .eq('status', 'approved')
        .lte('start_date', dateRange.end)
        .gte('end_date', dateRange.start);

      // Hole Wochenendbereitschaften
      const { data: weekendDuties } = await supabase
        .from('weekend_duties')
        .select('*')
        .gte('start_date', dateRange.start)
        .lte('end_date', dateRange.end);

      // Verarbeite Daten pro Benutzer
      const processedData: WorkTimeData[] = users.map(user => {
        const userEntries = timeEntries?.filter(entry => entry.user_id === user.id) || [];
        const userSickLeaves = sickLeaves?.filter(sl => sl.user_id === user.id) || [];
        const userVacations = vacations?.filter(v => v.user_id === user.id) || [];
        const userWeekendDuties = weekendDuties?.filter(wd => wd.user_id === user.id) || [];
        
        // Erstelle tägliche Einträge
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

          const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60) - totalBreakMinutes;
          const hours = Math.floor(totalMinutes / 60);
          const minutes = Math.round(totalMinutes % 60);

          return {
            date: entry.date,
            hours,
            minutes,
            startTime: start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
            endTime: end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
            type: 'work' as const
          };
        }).filter(day => day !== null) as any[];

        // Füge Kranktage hinzu
        userSickLeaves.forEach(sick => {
          const startDate = new Date(sick.start_date);
          const endDate = new Date(sick.end_date);
          
          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Nur Wochentage
              days.push({
                date: d.toISOString().split('T')[0],
                hours: 8, // Standard 8 Stunden für Kranktage
                minutes: 0,
                startTime: 'Krank',
                endTime: 'Krank',
                type: 'sick' as const
              });
            }
          }
        });

        // Füge Urlaubstage hinzu
        userVacations.forEach(vacation => {
          const startDate = new Date(vacation.start_date);
          const endDate = new Date(vacation.end_date);
          
          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Nur Wochentage
              days.push({
                date: d.toISOString().split('T')[0],
                hours: 8, // Standard 8 Stunden für Urlaubstage
                minutes: 0,
                startTime: 'Urlaub',
                endTime: 'Urlaub',
                type: 'vacation' as const
              });
            }
          }
        });

        // Berechne Gesamtstunden
        const totalMinutes = days.reduce((sum, day) => {
          if (day.type === 'work') {
            return sum + (day.hours * 60 + day.minutes);
          }
          return sum; // Kranktage und Urlaub zählen nicht zur Arbeitszeit
        }, 0);
        const totalHours = Math.floor(totalMinutes / 60);
        const remainingMinutes = Math.round(totalMinutes % 60);

        // Berechne Soll-Arbeitszeit
        const workDays = calculateWorkDays(dateRange.start, dateRange.end);
        const weeklyHours = user.weekly_hours || 0;
        const dailyHours = weeklyHours / 5; // 5 Arbeitstage pro Woche
        const targetHours = weeklyHours ? workDays * dailyHours : 0;

        // Berechne Überstunden
        const actualMinutes = totalHours * 60 + remainingMinutes;
        const targetMinutes = targetHours * 60;
        const overtimeMinutes = actualMinutes - targetMinutes;
        const overtimeHours = Math.floor(Math.abs(overtimeMinutes) / 60);
        const overtimeRemainingMinutes = Math.abs(overtimeMinutes) % 60;

        // Berechne Wochen-Zusammenfassungen
        const weekSummaries: any[] = [];
        if (view === 'weekly' && weeklyHours) {
          const weekMap = new Map<number, any>();
          
          days.forEach(day => {
            if (day.type === 'work') {
              const date = new Date(day.date);
              const weekNum = getWeekNumber(date);
              
              if (!weekMap.has(weekNum)) {
                // Finde Montag und Sonntag dieser Woche
                const dayOfWeek = date.getDay();
                const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                const monday = new Date(date);
                monday.setDate(date.getDate() + diff);
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                
                weekMap.set(weekNum, {
                  weekNumber: weekNum,
                  weekStart: monday.toISOString().split('T')[0],
                  weekEnd: sunday.toISOString().split('T')[0],
                  workedMinutes: 0,
                  targetHours: weeklyHours
                });
              }
              
              const week = weekMap.get(weekNum);
              week.workedMinutes += day.hours * 60 + day.minutes;
            }
          });
          
          weekMap.forEach(week => {
            const workedHours = week.workedMinutes / 60;
            weekSummaries.push({
              ...week,
              workedHours: Math.round(workedHours * 100) / 100,
              overtime: Math.round((workedHours - week.targetHours) * 100) / 100
            });
          });
        }

        return {
          userId: user.id,
          userName: user.name,
          weeklyHours: user.weekly_hours,
          totalHours,
          totalMinutes: remainingMinutes,
          targetHours: Math.round(targetHours),
          overtimeHours: overtimeMinutes >= 0 ? overtimeHours : -overtimeHours,
          overtimeMinutes: overtimeRemainingMinutes,
          sickDays: userSickLeaves.reduce((sum, sl) => {
            const start = new Date(sl.start_date);
            const end = new Date(sl.end_date);
            return sum + Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          }, 0),
          vacationDays: userVacations.reduce((sum, v) => {
            const start = new Date(v.start_date);
            const end = new Date(v.end_date);
            return sum + Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          }, 0),
          weekendDuties: userWeekendDuties.length,
          days: days.sort((a, b) => b.date.localeCompare(a.date)),
          weekSummaries
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customStartDate, customEndDate, view]);

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
    let csv = 'Mitarbeiter,Datum,Start,Ende,Stunden,Minuten,Typ,Soll-Stunden,Überstunden\n';
    
    workTimeData.forEach(userData => {
      userData.days.forEach(day => {
        const overtime = userData.weeklyHours 
          ? (day.hours + day.minutes / 60) - (userData.weeklyHours / 5)
          : 0;
        csv += `"${userData.userName}","${formatDate(day.date)}","${day.startTime}","${day.endTime}",${day.hours},${day.minutes},${day.type},${userData.weeklyHours ? userData.weeklyHours / 5 : 'N/A'},${overtime.toFixed(2)}\n`;
      });
    });

    csv += '\n\nZusammenfassung\n';
    csv += 'Mitarbeiter,Soll-Wochenstunden,Gesamtstunden,Soll-Stunden,Überstunden,Kranktage,Urlaubstage,Wochenendbereitschaften\n';
    workTimeData.forEach(userData => {
      const overtimeSign = (userData.overtimeHours * 60 + userData.overtimeMinutes) >= 0 ? '+' : '-';
      csv += `"${userData.userName}",${userData.weeklyHours || 'Flexibel'},${userData.totalHours}h ${userData.totalMinutes}min,${userData.targetHours}h,${overtimeSign}${userData.overtimeHours}h ${userData.overtimeMinutes}min,${userData.sickDays},${userData.vacationDays},${userData.weekendDuties}\n`;
    });

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
    <div className="work-time-statistics-enhanced">
      <h2>Erweiterte Arbeitszeitübersicht</h2>
      
      {/* Zeitraum und Ansicht Auswahl */}
      <div className="controls-section">
        <div className="period-selector">
          <label>Zeitraum:</label>
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
        </div>

        <div className="view-selector">
          <label>Ansicht:</label>
          <button 
            className={view === 'daily' ? 'active' : ''} 
            onClick={() => setView('daily')}
          >
            Täglich
          </button>
          <button 
            className={view === 'weekly' ? 'active' : ''} 
            onClick={() => setView('weekly')}
          >
            Wöchentlich
          </button>
          <button 
            className={view === 'monthly' ? 'active' : ''} 
            onClick={() => setView('monthly')}
          >
            Monatlich
          </button>
        </div>

        <div className="action-buttons">
          <button onClick={loadWorkTimeData} disabled={loading}>
            {loading ? 'Lade...' : 'Aktualisieren'}
          </button>
          <button onClick={exportToCSV} disabled={loading || workTimeData.length === 0}>
            CSV Export
          </button>
        </div>
      </div>

      {/* Haupttabelle */}
      <div className="statistics-table">
        <table>
          <thead>
            <tr>
              <th>Mitarbeiter</th>
              <th>Soll-Stunden/Woche</th>
              <th>Ist-Stunden</th>
              <th>Soll-Stunden</th>
              <th>Über-/Unterstunden</th>
              <th>Kranktage</th>
              <th>Urlaubstage</th>
              <th>Wochenendbereitschaft</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {workTimeData.map(userData => {
              const overtimeTotal = userData.overtimeHours * 60 + userData.overtimeMinutes;
              const isOvertime = overtimeTotal >= 0;
              const overtimeClass = userData.weeklyHours ? (isOvertime ? 'overtime-positive' : 'overtime-negative') : '';

              return (
                <React.Fragment key={userData.userId}>
                  <tr>
                    <td>{userData.userName}</td>
                    <td>{userData.weeklyHours ? `${userData.weeklyHours}h` : 'Flexibel'}</td>
                    <td><strong>{userData.totalHours}h {userData.totalMinutes}min</strong></td>
                    <td>{userData.weeklyHours ? `${userData.targetHours}h` : '-'}</td>
                    <td className={overtimeClass}>
                      {userData.weeklyHours ? (
                        <>
                          {isOvertime ? '+' : '-'}
                          {userData.overtimeHours}h {userData.overtimeMinutes}min
                        </>
                      ) : '-'}
                    </td>
                    <td>{userData.sickDays > 0 ? `${userData.sickDays} Tage` : '-'}</td>
                    <td>{userData.vacationDays > 0 ? `${userData.vacationDays} Tage` : '-'}</td>
                    <td>{userData.weekendDuties > 0 ? `${userData.weekendDuties}x (${userData.weekendDuties * 75}€)` : '-'}</td>
                    <td>
                      <button onClick={() => setShowDetails(showDetails === userData.userId ? null : userData.userId)}>
                        {showDetails === userData.userId ? 'Verbergen' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Detail-Ansicht */}
                  {showDetails === userData.userId && (
                    <tr className="detail-row">
                      <td colSpan={9}>
                        {view === 'daily' ? (
                          <div className="detail-table">
                            <h4>Tagesübersicht</h4>
                            <table>
                              <thead>
                                <tr>
                                  <th>Datum</th>
                                  <th>Start</th>
                                  <th>Ende</th>
                                  <th>Arbeitszeit</th>
                                  <th>Typ</th>
                                  <th>Tages-Überstunden</th>
                                </tr>
                              </thead>
                              <tbody>
                                {userData.days.map((day, index) => {
                                  const dailyTarget = userData.weeklyHours ? userData.weeklyHours / 5 : 0;
                                  const dailyOvertime = day.type === 'work' 
                                    ? (day.hours + day.minutes / 60) - dailyTarget 
                                    : 0;
                                  
                                  return (
                                    <tr key={index} className={`day-type-${day.type}`}>
                                      <td>{formatDate(day.date)}</td>
                                      <td>{day.startTime}</td>
                                      <td>{day.endTime}</td>
                                      <td>{day.hours}h {day.minutes}min</td>
                                      <td>
                                        <span className={`type-badge type-${day.type}`}>
                                          {day.type === 'work' ? 'Arbeit' : 
                                           day.type === 'sick' ? 'Krank' : 
                                           day.type === 'vacation' ? 'Urlaub' : 'Bereitschaft'}
                                        </span>
                                      </td>
                                      <td className={dailyOvertime >= 0 ? 'overtime-positive' : 'overtime-negative'}>
                                        {userData.weeklyHours && day.type === 'work' ? 
                                          `${dailyOvertime >= 0 ? '+' : ''}${dailyOvertime.toFixed(1)}h` : 
                                          '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : view === 'weekly' && userData.weekSummaries ? (
                          <div className="detail-table">
                            <h4>Wochenübersicht</h4>
                            <table>
                              <thead>
                                <tr>
                                  <th>KW</th>
                                  <th>Zeitraum</th>
                                  <th>Ist-Stunden</th>
                                  <th>Soll-Stunden</th>
                                  <th>Wochenbilanz</th>
                                </tr>
                              </thead>
                              <tbody>
                                {userData.weekSummaries.map((week, index) => (
                                  <tr key={index}>
                                    <td>KW {week.weekNumber}</td>
                                    <td>{formatDate(week.weekStart)} - {formatDate(week.weekEnd)}</td>
                                    <td>{week.workedHours.toFixed(1)}h</td>
                                    <td>{week.targetHours}h</td>
                                    <td className={week.overtime >= 0 ? 'overtime-positive' : 'overtime-negative'}>
                                      {week.overtime >= 0 ? '+' : ''}{week.overtime.toFixed(1)}h
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="detail-table">
                            <h4>Monatsübersicht</h4>
                            <p>Gesamtübersicht für den gewählten Zeitraum</p>
                            <ul>
                              <li>Gearbeitete Stunden: {userData.totalHours}h {userData.totalMinutes}min</li>
                              <li>Soll-Stunden: {userData.targetHours}h</li>
                              <li>Bilanz: {isOvertime ? '+' : '-'}{userData.overtimeHours}h {userData.overtimeMinutes}min</li>
                              <li>Kranktage: {userData.sickDays}</li>
                              <li>Urlaubstage: {userData.vacationDays}</li>
                              <li>Wochenendbereitschaften: {userData.weekendDuties}</li>
                            </ul>
                          </div>
                        )}
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

      {/* Gesamtzusammenfassung */}
      <div className="total-summary">
        <h3>Gesamtzusammenfassung</h3>
        <div className="summary-cards">
          {workTimeData.map(userData => {
            const overtimeTotal = userData.overtimeHours * 60 + userData.overtimeMinutes;
            const isOvertime = overtimeTotal >= 0;
            
            return (
              <div key={userData.userId} className="summary-card">
                <h4>{userData.userName}</h4>
                <div className="summary-stats">
                  <div className="stat">
                    <span className="label">Arbeitszeit:</span>
                    <span className="value">{userData.totalHours}h {userData.totalMinutes}min</span>
                  </div>
                  {userData.weeklyHours && (
                    <div className="stat">
                      <span className="label">Bilanz:</span>
                      <span className={`value ${isOvertime ? 'overtime-positive' : 'overtime-negative'}`}>
                        {isOvertime ? '+' : '-'}{userData.overtimeHours}h {userData.overtimeMinutes}min
                      </span>
                    </div>
                  )}
                  {userData.weekendDuties > 0 && (
                    <div className="stat">
                      <span className="label">Bereitschaft:</span>
                      <span className="value">{userData.weekendDuties * 75}€</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};