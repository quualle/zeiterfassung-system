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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Check for saved session in localStorage
      const savedSession = localStorage.getItem('adminSession');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          // Check if session is still valid (24 hours)
          const sessionTime = new Date(session.timestamp).getTime();
          const now = new Date().getTime();
          const hoursSinceLogin = (now - sessionTime) / (1000 * 60 * 60);
          
          if (hoursSinceLogin < 24) {
            // Restore user from database
            const { data: user } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.userId)
              .single();
              
            if (user && user.role === 'admin') {
              setCurrentUser(user);
            } else {
              localStorage.removeItem('adminSession');
            }
          } else {
            localStorage.removeItem('adminSession');
          }
        } catch (error) {
          console.error('Error restoring session:', error);
          localStorage.removeItem('adminSession');
        }
      }
      
      await initializeUsers();
      setLoading(false);
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
    
    // Save admin session to localStorage
    if (user.role === 'admin') {
      localStorage.setItem('adminSession', JSON.stringify({
        userId: user.id,
        timestamp: new Date().toISOString()
      }));
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('adminSession');
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2>Laden...</h2>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  if (currentUser.role === 'admin') {
    // Check if activity log route is requested
    if (window.location.pathname === '/admin/activity-log') {
      return (
        <div>
          <ActivityLog />
        </div>
      );
    }
    return <AdminDashboard user={currentUser} onLogout={handleLogout} />;
  }

  return <TimeTracking user={currentUser} onLogout={handleLogout} />;
}

export default App;