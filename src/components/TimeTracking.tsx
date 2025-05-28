import React, { useState, useEffect } from 'react';
import { User, TimeEntry, Notification } from '../types';
import { getTodayEntry, saveTimeEntry, getUserTimeEntries, saveNotification, getUsers } from '../utils/storageProvider';
import { formatTime, calculateDuration, calculateTotalWorkTime, formatDate } from '../utils/time';
import { ChangeRequestModal } from './ChangeRequestModal';

interface TimeTrackingProps {
  user: User;
  onLogout: () => void;
}

export const TimeTracking: React.FC<TimeTrackingProps> = ({ user, onLogout }) => {
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakReason, setBreakReason] = useState('');
  const [showBreakForm, setShowBreakForm] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      // Automatisches Ausstempeln prüfen
      if (currentEntry && !currentEntry.endTime) {
        const startTime = new Date(currentEntry.startTime);
        const hoursWorked = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        
        // Prüfung: 12 Stunden erreicht oder 22 Uhr
        if (hoursWorked >= 12 || now.getHours() >= 22) {
          handleAutoClockOut();
        }
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEntry]);

  useEffect(() => {
    const loadTodayEntry = async () => {
      const todayEntry = await getTodayEntry(user.id);
      if (todayEntry) {
        setCurrentEntry(todayEntry);
        setIsWorking(true);
        const hasActiveBreak = todayEntry.breaks.some(b => !b.endTime);
        setIsOnBreak(hasActiveBreak);
      }
    };
    loadTodayEntry();
  }, [user.id]);

  useEffect(() => {
    const loadRecentEntries = async () => {
      const entries = await getUserTimeEntries(user.id);
      // Zeige die letzten 7 Tage
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recent = entries.filter(e => new Date(e.date) >= sevenDaysAgo);
      setRecentEntries(recent);
    };
    loadRecentEntries();
  }, [user.id, currentEntry]);

  const startWork = async () => {
    const now = new Date();
    
    // Prüfung für Lisa Bayer: Darf nicht vor 8:45 Uhr einstempeln
    if (user.name === 'Lisa Bayer') {
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      if (currentHour < 8 || (currentHour === 8 && currentMinute < 45)) {
        alert('Sie dürfen sich nicht vor 8:45 Uhr einstempeln.');
        return;
      }
    }
    
    const newEntry: TimeEntry = {
      id: crypto.randomUUID(), // Generiere einen echten UUID
      userId: user.id,
      startTime: now.toISOString(),
      date: now.toISOString().split('T')[0],
      breaks: []
    };
    setCurrentEntry(newEntry);
    setIsWorking(true);
    await saveTimeEntry(newEntry);
  };

  const endWork = async () => {
    if (currentEntry) {
      const updatedEntry = {
        ...currentEntry,
        endTime: new Date().toISOString()
      };
      await saveTimeEntry(updatedEntry);
      setCurrentEntry(null);
      setIsWorking(false);
      setIsOnBreak(false);
    }
  };

  const startBreak = async () => {
    if (!breakReason.trim()) {
      alert('Bitte geben Sie einen Grund für die Pause an.');
      return;
    }

    if (currentEntry) {
      const newBreak = {
        startTime: new Date().toISOString(),
        reason: breakReason
      };
      const updatedEntry = {
        ...currentEntry,
        breaks: [...currentEntry.breaks, newBreak]
      };
      setCurrentEntry(updatedEntry);
      setIsOnBreak(true);
      setShowBreakForm(false);
      setBreakReason('');
      await saveTimeEntry(updatedEntry);
    }
  };

  const endBreak = async () => {
    if (currentEntry) {
      const updatedBreaks = [...currentEntry.breaks];
      const lastBreakIndex = updatedBreaks.length - 1;
      updatedBreaks[lastBreakIndex] = {
        ...updatedBreaks[lastBreakIndex],
        endTime: new Date().toISOString()
      };
      const updatedEntry = {
        ...currentEntry,
        breaks: updatedBreaks
      };
      setCurrentEntry(updatedEntry);
      setIsOnBreak(false);
      await saveTimeEntry(updatedEntry);
    }
  };

  const handleAutoClockOut = async () => {
    if (!currentEntry || currentEntry.endTime) return;
    
    const now = new Date();
    
    // Automatisch ausstempeln
    const updatedEntry = {
      ...currentEntry,
      endTime: now.toISOString()
    };
    await saveTimeEntry(updatedEntry);
    
    // Benachrichtigung für den Mitarbeiter erstellen
    const employeeNotification: Notification = {
      id: crypto.randomUUID(),
      userId: user.id,
      message: `Sie wurden automatisch um ${formatTime(now.toISOString())} ausgestempelt, da Sie entweder 12 Stunden gearbeitet haben oder es 22 Uhr war.`,
      type: 'auto_clock_out',
      createdAt: now.toISOString(),
      read: false
    };
    await saveNotification(employeeNotification);
    
    // Benachrichtigung für Admin (Ines) erstellen
    const users = await getUsers();
    const adminUser = users.find(u => u.name === 'Ines Cürten' && u.role === 'admin');
    
    if (adminUser) {
      const adminNotification: Notification = {
        id: crypto.randomUUID(),
        userId: adminUser.id,
        message: `${user.name} wurde gestern Abend automatisch um ${formatTime(now.toISOString())} ausgestempelt und hat vergessen sich auszustempeln.`,
        type: 'auto_clock_out',
        createdAt: now.toISOString(),
        read: false,
        relatedEmployeeId: user.id,
        relatedEmployeeName: user.name
      };
      await saveNotification(adminNotification);
    }
    
    // UI aktualisieren
    setCurrentEntry(null);
    setIsWorking(false);
    setIsOnBreak(false);
    
    alert('Sie wurden automatisch ausgestempelt, da Sie entweder 12 Stunden gearbeitet haben oder es 22 Uhr war.');
  };

  return (
    <div className="time-tracking-container">
      <header className="header">
        <h1>Zeiterfassung</h1>
        <div className="user-info">
          <span>Angemeldet als: {user.name}</span>
          <button onClick={onLogout} className="btn btn-secondary">Abmelden</button>
        </div>
      </header>

      <main className="main-content">
        <div className="current-time">
          <h2>{currentTime.toLocaleTimeString('de-DE')}</h2>
          <p>{currentTime.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {!isWorking ? (
          <div className="start-work">
            <button onClick={startWork} className="btn btn-primary btn-large">
              Arbeit beginnen
            </button>
          </div>
        ) : (
          <div className="work-status">
            <div className="status-card">
              <h3>Arbeitsstatus</h3>
              <p>Arbeitsbeginn: {formatTime(currentEntry!.startTime)}</p>
              <p>Arbeitszeit: {calculateDuration(currentEntry!.startTime)}</p>
              {currentEntry!.breaks.length > 0 && (
                <p>Gesamte Arbeitszeit (ohne Pausen): {calculateTotalWorkTime(currentEntry!)}</p>
              )}
            </div>

            {isOnBreak ? (
              <div className="break-status">
                <p className="status-indicator break">Pause läuft...</p>
                <p>Pausengrund: {currentEntry!.breaks[currentEntry!.breaks.length - 1].reason}</p>
                <p>Pausendauer: {calculateDuration(currentEntry!.breaks[currentEntry!.breaks.length - 1].startTime)}</p>
                <button onClick={endBreak} className="btn btn-success">
                  Pause beenden
                </button>
              </div>
            ) : (
              <div className="work-actions">
                <button onClick={() => setShowBreakForm(true)} className="btn btn-warning">
                  Pause beginnen
                </button>
                <button onClick={endWork} className="btn btn-danger">
                  Arbeit beenden
                </button>
              </div>
            )}

            {showBreakForm && (
              <div className="break-form">
                <h4>Pausengrund angeben</h4>
                <input
                  type="text"
                  value={breakReason}
                  onChange={(e) => setBreakReason(e.target.value)}
                  placeholder="z.B. Mittagspause, Arzttermin..."
                  className="break-input"
                />
                <div className="form-actions">
                  <button onClick={startBreak} className="btn btn-primary">
                    Pause starten
                  </button>
                  <button onClick={() => {
                    setShowBreakForm(false);
                    setBreakReason('');
                  }} className="btn btn-secondary">
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {currentEntry!.breaks.length > 0 && (
              <div className="breaks-list">
                <h4>Heutige Pausen</h4>
                <ul>
                  {currentEntry!.breaks.map((breakItem, index) => (
                    <li key={index}>
                      {formatTime(breakItem.startTime)} - {breakItem.endTime ? formatTime(breakItem.endTime) : 'läuft...'} 
                      ({breakItem.reason})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Abschnitt für Änderungsanträge */}
        <div className="section">
          <h3>Vergangene Arbeitszeiten</h3>
          {recentEntries.length > 0 ? (
            <div className="entries-list">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="entry-item">
                  <div className="entry-info">
                    <strong>{formatDate(entry.date)}</strong>
                    <br />
                    Start: {formatTime(entry.startTime)}
                    {entry.endTime && <> - Ende: {formatTime(entry.endTime)}</>}
                    <br />
                    {entry.breaks.length > 0 && (
                      <span className="breaks-count">{entry.breaks.length} Pause(n)</span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEntry(entry);
                      setShowChangeRequest(true);
                    }}
                    className="btn btn-small btn-secondary"
                  >
                    Änderung beantragen
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p>Keine vergangenen Arbeitszeiten in den letzten 7 Tagen.</p>
          )}
        </div>
      </main>

      {/* Modal für Änderungsanträge */}
      {showChangeRequest && selectedEntry && (
        <ChangeRequestModal
          userId={user.id}
          entry={selectedEntry}
          onClose={() => {
            setShowChangeRequest(false);
            setSelectedEntry(null);
          }}
          onSuccess={() => {
            setShowChangeRequest(false);
            setSelectedEntry(null);
            alert('Ihr Änderungsantrag wurde erfolgreich eingereicht.');
          }}
        />
      )}
    </div>
  );
};