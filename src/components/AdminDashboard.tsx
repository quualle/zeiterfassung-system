import React, { useState, useEffect } from 'react';
import { User, TimeEntry } from '../types';
import { getUsers, getTimeEntries } from '../utils/storageProvider';
import { formatDate, formatTime, calculateTotalWorkTime } from '../utils/time';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const loadData = async () => {
      const [usersData, entriesData] = await Promise.all([
        getUsers(),
        getTimeEntries()
      ]);
      setUsers(usersData);
      setEntries(entriesData);
    };
    loadData();
  }, []);

  const filteredEntries = entries.filter(entry => {
    const matchesUser = selectedUserId === 'all' || entry.userId === selectedUserId;
    const matchesDate = entry.date === selectedDate;
    return matchesUser && matchesDate;
  });

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : 'Unbekannt';
  };

  return (
    <div className="admin-dashboard">
      <header className="header">
        <h1>Admin Dashboard - Zeiterfassung</h1>
        <div className="user-info">
          <span>Angemeldet als: {user.name} (Administrator)</span>
          <button onClick={onLogout} className="btn btn-secondary">Abmelden</button>
        </div>
      </header>

      <main className="main-content">
        <div className="filters">
          <div className="filter-group">
            <label htmlFor="user-filter">Mitarbeiter:</label>
            <select 
              id="user-filter"
              value={selectedUserId} 
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="filter-select"
            >
              <option value="all">Alle Mitarbeiter</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="date-filter">Datum:</label>
            <input 
              type="date" 
              id="date-filter"
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="filter-input"
            />
          </div>
        </div>

        <div className="entries-table">
          <h2>Zeiterfassungen für {formatDate(selectedDate)}</h2>
          {filteredEntries.length === 0 ? (
            <p className="no-data">Keine Einträge für dieses Datum gefunden.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Mitarbeiter</th>
                  <th>Arbeitsbeginn</th>
                  <th>Arbeitsende</th>
                  <th>Pausen</th>
                  <th>Gesamtarbeitszeit</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(entry => (
                  <tr key={entry.id}>
                    <td>{getUserName(entry.userId)}</td>
                    <td>{formatTime(entry.startTime)}</td>
                    <td>{entry.endTime ? formatTime(entry.endTime) : 'Läuft noch...'}</td>
                    <td>
                      {entry.breaks.length === 0 ? (
                        'Keine Pausen'
                      ) : (
                        <ul className="breaks-list-small">
                          {entry.breaks.map((breakItem, index) => (
                            <li key={index}>
                              {formatTime(breakItem.startTime)} - {breakItem.endTime ? formatTime(breakItem.endTime) : 'läuft...'}
                              <br />
                              <small>({breakItem.reason})</small>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td>{entry.endTime ? calculateTotalWorkTime(entry) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="summary">
          <h3>Zusammenfassung</h3>
          <div className="summary-cards">
            {users.filter(u => u.role === 'employee').map(employee => {
              const employeeEntries = filteredEntries.filter(e => e.userId === employee.id);
              const totalMinutes = employeeEntries.reduce((acc, entry) => {
                if (entry.endTime) {
                  const totalBreakTime = entry.breaks.reduce((breakAcc, breakItem) => {
                    if (breakItem.endTime) {
                      return breakAcc + (new Date(breakItem.endTime).getTime() - new Date(breakItem.startTime).getTime());
                    }
                    return breakAcc;
                  }, 0);
                  
                  const workTime = new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime() - totalBreakTime;
                  return acc + Math.floor(workTime / (1000 * 60));
                }
                return acc;
              }, 0);

              const hours = Math.floor(totalMinutes / 60);
              const minutes = totalMinutes % 60;

              return (
                <div key={employee.id} className="summary-card">
                  <h4>{employee.name}</h4>
                  <p>Gesamtarbeitszeit: {hours}h {minutes}min</p>
                  <p>Einträge: {employeeEntries.length}</p>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};