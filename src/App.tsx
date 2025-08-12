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
      // Check for saved session in localStorage (for all users, not just admin)
      const savedSession = localStorage.getItem('userSession');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          // Check if session is still valid (24 hours for admin, 12 hours for employees)
          const sessionTime = new Date(session.timestamp).getTime();
          const now = new Date().getTime();
          const hoursSinceLogin = (now - sessionTime) / (1000 * 60 * 60);
          const maxHours = session.role === 'admin' ? 24 : 12;
          
          if (hoursSinceLogin < maxHours) {
            // Restore user from database
            const { data: user, error } = await supabase
              .from('users_zeiterfassung')
              .select('*')
              .eq('id', session.userId)
              .single();
              
            if (!error && user) {
              setCurrentUser(user);
            } else {
              console.error('Error fetching user:', error);
              localStorage.removeItem('userSession');
              // Legacy: Remove old adminSession if exists
              localStorage.removeItem('adminSession');
            }
          } else {
            localStorage.removeItem('userSession');
            // Legacy: Remove old adminSession if exists
            localStorage.removeItem('adminSession');
          }
        } catch (error) {
          console.error('Error restoring session:', error);
          localStorage.removeItem('userSession');
          // Legacy: Remove old adminSession if exists
          localStorage.removeItem('adminSession');
        }
      } else {
        // Check for legacy adminSession
        const legacySession = localStorage.getItem('adminSession');
        if (legacySession) {
          try {
            const session = JSON.parse(legacySession);
            const sessionTime = new Date(session.timestamp).getTime();
            const now = new Date().getTime();
            const hoursSinceLogin = (now - sessionTime) / (1000 * 60 * 60);
            
            if (hoursSinceLogin < 24) {
              const { data: user, error } = await supabase
                .from('users_zeiterfassung')
                .select('*')
                .eq('id', session.userId)
                .single();
                
              if (!error && user && user.role === 'admin') {
                setCurrentUser(user);
                // Migrate to new session format
                localStorage.setItem('userSession', JSON.stringify({
                  userId: user.id,
                  role: user.role,
                  timestamp: session.timestamp
                }));
                localStorage.removeItem('adminSession');
              } else {
                localStorage.removeItem('adminSession');
              }
            } else {
              localStorage.removeItem('adminSession');
            }
          } catch (error) {
            console.error('Error migrating legacy session:', error);
            localStorage.removeItem('adminSession');
          }
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
              .from('users_zeiterfassung')
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
    
    // Save session to localStorage for all users
    localStorage.setItem('userSession', JSON.stringify({
      userId: user.id,
      role: user.role,
      timestamp: new Date().toISOString()
    }));
    
    // Legacy: Remove old adminSession if exists
    localStorage.removeItem('adminSession');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('userSession');
    // Legacy: Remove old adminSession if exists
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