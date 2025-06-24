import React, { useState, useEffect } from 'react';
import { User, TimeEntry, ChangeRequest, Notification } from '../types';
import { getUsers, getTimeEntries, getChangeRequests, processChangeRequest, getNotifications, markNotificationAsRead } from '../utils/storageProvider';
import { formatDate, formatTime, calculateTotalWorkTime } from '../utils/time';
import { TimeTracking } from './TimeTracking';
import { WorkTimeRules } from './WorkTimeRules';
import { EmailBlacklist } from './EmailBlacklist';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'timetracking' | 'notifications' | 'worktimerules' | 'blacklist'>('overview');

  useEffect(() => {
    const loadData = async () => {
      const [usersData, entriesData, requestsData, notificationsData] = await Promise.all([
        getUsers(),
        getTimeEntries(),
        getChangeRequests(),
        getNotifications(user.id)
      ]);
      setUsers(usersData);
      setEntries(entriesData);
      setChangeRequests(requestsData);
      setNotifications(notificationsData);
    };
    loadData();
    
    // Aktualisiere Benachrichtigungen alle 30 Sekunden
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [user.id]);

  const filteredEntries = entries.filter(entry => {
    const matchesUser = selectedUserId === 'all' || entry.userId === selectedUserId;
    const matchesDate = entry.date === selectedDate;
    return matchesUser && matchesDate;
  });

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : 'Unbekannt';
  };

  const handleProcessRequest = async (
    request: ChangeRequest,
    status: 'approved' | 'rejected' | 'modified',
    adminComment?: string,
    finalValues?: { startTime?: string; endTime?: string; reason?: string; date?: string }
  ) => {
    try {
      await processChangeRequest(request.id, status, user.id, adminComment, finalValues);
      // Daten neu laden
      const [entriesData, requestsData] = await Promise.all([
        getTimeEntries(),
        getChangeRequests()
      ]);
      setEntries(entriesData);
      setChangeRequests(requestsData);
      alert(`Änderungsantrag wurde ${status === 'approved' ? 'genehmigt' : status === 'rejected' ? 'abgelehnt' : 'modifiziert'}.`);
    } catch (error) {
      console.error('Error processing request:', error);
      alert('Fehler beim Verarbeiten des Antrags.');
    }
  };

  // Funktion für zukünftige direkte Bearbeitung
  // const handleDirectEdit = async (type: 'entry' | 'break', data: any) => {
  //   try {
  //     if (type === 'entry' && editingEntry) {
  //       await directUpdateTimeEntry(editingEntry.id, data);
  //     } else if (type === 'break' && editingBreak) {
  //       const break_ = editingBreak.entry.breaks[editingBreak.breakIndex];
  //       if (break_.id) {
  //         await directUpdateBreak(break_.id, data);
  //       }
  //     }
  //     // Daten neu laden
  //     const entriesData = await getTimeEntries();
  //     setEntries(entriesData);
  //     setEditingEntry(null);
  //     setEditingBreak(null);
  //     alert('Änderungen wurden gespeichert.');
  //   } catch (error) {
  //     console.error('Error updating:', error);
  //     alert('Fehler beim Speichern der Änderungen.');
  //   }
  // };

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
        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Übersicht
          </button>
          <button 
            className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            Änderungsanträge ({changeRequests.filter(r => r.status === 'pending').length})
          </button>
          <button 
            className={`tab-button ${activeTab === 'timetracking' ? 'active' : ''}`}
            onClick={() => setActiveTab('timetracking')}
          >
            Meine Zeiterfassung
          </button>
          <button 
            className={`tab-button ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            Benachrichtigungen ({notifications.filter(n => !n.read).length})
          </button>
          <button 
            className={`tab-button ${activeTab === 'worktimerules' ? 'active' : ''}`}
            onClick={() => setActiveTab('worktimerules')}
          >
            Arbeitszeiten
          </button>
          <button 
            className={`tab-button ${activeTab === 'blacklist' ? 'active' : ''}`}
            onClick={() => setActiveTab('blacklist')}
          >
            E-Mail Blacklist
          </button>
          <button 
            className="tab-button"
            onClick={() => window.location.href = '/admin/activity-log'}
          >
            Aktivitätslog
          </button>
        </div>

        {activeTab === 'overview' ? (
          <>
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
          </>
        ) : activeTab === 'requests' ? (
          /* Änderungsanträge Tab */
          <div className="change-requests-section">
            <h3>Offene Änderungsanträge</h3>
            {changeRequests.filter(r => r.status === 'pending').length === 0 ? (
              <p>Keine offenen Änderungsanträge vorhanden.</p>
            ) : (
              <div className="requests-list">
                {changeRequests
                  .filter(r => r.status === 'pending')
                  .map(request => {
                    const requestUser = users.find(u => u.id === request.userId);
                    const entry = entries.find(e => e.id === request.timeEntryId);
                    
                    return (
                      <div key={request.id} className="request-card">
                        <div className="request-header">
                          <h4>{requestUser?.name} - {formatDate(request.createdAt)}</h4>
                          <span className="request-type">
                            {request.requestType === 'time_entry' ? 'Arbeitszeit' : 'Pause'}
                          </span>
                        </div>
                        
                        <div className="request-details">
                          <div className="current-values">
                            <h5>Aktuelle Werte:</h5>
                            {request.currentStartTime && <p>Start: {formatTime(request.currentStartTime)}</p>}
                            {request.currentEndTime && <p>Ende: {formatTime(request.currentEndTime)}</p>}
                            {request.currentReason && <p>Grund: {request.currentReason}</p>}
                          </div>
                          
                          <div className="new-values">
                            <h5>Gewünschte Änderungen:</h5>
                            {request.newDate && <p>Datum: {request.newDate}</p>}
                            {request.newStartTime && <p>Start: {formatTime(request.newStartTime)}</p>}
                            {request.newEndTime && <p>Ende: {formatTime(request.newEndTime)}</p>}
                            {request.newReason && <p>Grund: {request.newReason}</p>}
                          </div>
                        </div>
                        
                        <p className="change-reason"><strong>Begründung:</strong> {request.changeReason}</p>
                        
                        <div className="request-actions">
                          <button 
                            onClick={() => handleProcessRequest(request, 'approved')}
                            className="btn btn-success"
                          >
                            Genehmigen
                          </button>
                          <button 
                            onClick={() => {
                              const comment = prompt('Ablehnungsgrund:');
                              if (comment) {
                                handleProcessRequest(request, 'rejected', comment);
                              }
                            }}
                            className="btn btn-danger"
                          >
                            Ablehnen
                          </button>
                          <button 
                            onClick={() => {
                              // Hier könnte ein Modal für komplexere Bearbeitung geöffnet werden
                              const newDate = prompt('Neues Datum (YYYY-MM-DD):', request.newDate || entry?.date || '');
                              const newStart = prompt('Neue Startzeit (HH:MM):', request.newStartTime ? formatTime(request.newStartTime) : '');
                              const newEnd = prompt('Neue Endzeit (HH:MM):', request.newEndTime ? formatTime(request.newEndTime) : '');
                              const comment = prompt('Kommentar:');
                              
                              if (newDate || newStart || newEnd) {
                                const finalValues: any = {};
                                const targetDate = newDate || request.newDate || entry?.date;
                                
                                if (newDate) {
                                  finalValues.date = newDate;
                                }
                                
                                // Konvertiere lokale Zeit zu ISO String
                                if (newStart) {
                                  const localDateTime = new Date(`${targetDate}T${newStart}:00`);
                                  finalValues.startTime = localDateTime.toISOString();
                                }
                                if (newEnd) {
                                  const localDateTime = new Date(`${targetDate}T${newEnd}:00`);
                                  finalValues.endTime = localDateTime.toISOString();
                                }
                                
                                handleProcessRequest(request, 'modified', comment || undefined, finalValues);
                              }
                            }}
                            className="btn btn-warning"
                          >
                            Modifizieren
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
            
            <h3>Bearbeitete Änderungsanträge</h3>
            <div className="requests-list">
              {changeRequests
                .filter(r => r.status !== 'pending')
                .slice(0, 10) // Zeige nur die letzten 10
                .map(request => {
                  const requestUser = users.find(u => u.id === request.userId);
                  const processedByUser = users.find(u => u.id === request.processedBy);
                  
                  return (
                    <div key={request.id} className="request-card processed">
                      <div className="request-header">
                        <h4>{requestUser?.name} - {formatDate(request.createdAt)}</h4>
                        <span className={`status-badge status-${request.status}`}>
                          {request.status === 'approved' ? 'Genehmigt' : 
                           request.status === 'rejected' ? 'Abgelehnt' : 'Modifiziert'}
                        </span>
                      </div>
                      <p>Bearbeitet von: {processedByUser?.name} am {formatDate(request.processedAt!)}</p>
                      {request.adminComment && <p>Kommentar: {request.adminComment}</p>}
                    </div>
                  );
                })}
            </div>
          </div>
        ) : activeTab === 'timetracking' ? (
          /* Zeiterfassung für Admin */
          <div className="admin-timetracking">
            <TimeTracking 
              user={user} 
              onLogout={() => {
                // Wechsle zurück zur Übersicht beim Logout
                setActiveTab('overview');
                onLogout();
              }} 
            />
          </div>
        ) : activeTab === 'notifications' ? (
          /* Benachrichtigungen */
          <div className="notifications-section">
            <h2>Benachrichtigungen</h2>
            {notifications.length === 0 ? (
              <p>Keine Benachrichtigungen vorhanden.</p>
            ) : (
              <div className="notifications-list">
                {notifications.map(notification => (
                  <div 
                    key={notification.id} 
                    className={`notification-item ${!notification.read ? 'unread' : ''}`}
                  >
                    <div className="notification-content">
                      <p className="notification-message">{notification.message}</p>
                      <p className="notification-time">
                        {formatDate(notification.createdAt)} um {formatTime(notification.createdAt)}
                      </p>
                      {notification.relatedEmployeeName && (
                        <p className="notification-employee">
                          Betrifft: {notification.relatedEmployeeName}
                        </p>
                      )}
                    </div>
                    {!notification.read && (
                      <button
                        onClick={async () => {
                          await markNotificationAsRead(notification.id);
                          setNotifications(notifications.map(n => 
                            n.id === notification.id ? { ...n, read: true } : n
                          ));
                        }}
                        className="btn btn-small btn-secondary"
                      >
                        Als gelesen markieren
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'worktimerules' ? (
          /* Arbeitszeitregeln */
          <WorkTimeRules users={users} />
        ) : activeTab === 'blacklist' ? (
          /* E-Mail Blacklist */
          <EmailBlacklist />
        ) : null}
      </main>
    </div>
  );
};