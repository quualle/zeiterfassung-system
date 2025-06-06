import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { TimeTracking } from './components/TimeTracking';
import { AdminDashboard } from './components/AdminDashboard';
import { ActivityLog } from './components/ActivityLog';
import { User } from './types';
import { initializeUsers, clockOut, createNotification } from './utils/storageProvider';
import { supabase } from './lib/supabase';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const init = async () => {
      await initializeUsers();
    };
    init();
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.role === 'admin') return;

    // Prüfe alle 30 Sekunden, ob die Ausloggzeit erreicht wurde
    const checkAutoLogout = async () => {
      const { data: workTimeRule, error } = await supabase
        .from('work_time_rules')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (!error && workTimeRule && workTimeRule.is_active) {
        const now = new Date();
        const currentTime = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        if (currentTime >= workTimeRule.latest_logout_time) {
          // Automatisches Ausloggen
          try {
            await clockOut(currentUser.id);
            
            // Erstelle Benachrichtigung für Admin
            const admins = await supabase
              .from('users')
              .select('id')
              .eq('role', 'admin');
            
            if (admins.data) {
              for (const admin of admins.data) {
                await createNotification(
                  admin.id,
                  `${currentUser.name} wurde automatisch um ${workTimeRule.latest_logout_time.substring(0, 5)} Uhr ausgeloggt.`,
                  'auto_clock_out',
                  currentUser.id,
                  currentUser.name
                );
              }
            }
            
            alert(`Ihre Arbeitszeit ist beendet. Sie wurden automatisch ausgeloggt.`);
            handleLogout();
          } catch (error) {
            console.error('Fehler beim automatischen Ausloggen:', error);
          }
        }
      }
    };

    // Prüfe sofort und dann alle 30 Sekunden
    checkAutoLogout();
    const interval = setInterval(checkAutoLogout, 30000);

    return () => clearInterval(interval);
  }, [currentUser]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  if (currentUser.role === 'admin') {
    // Check if activity log route is requested
    if (window.location.pathname === '/admin/activity-log') {
      return <ActivityLog />;
    }
    return <AdminDashboard user={currentUser} onLogout={handleLogout} />;
  }

  return <TimeTracking user={currentUser} onLogout={handleLogout} />;
}

export default App;