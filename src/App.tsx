import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { TimeTracking } from './components/TimeTracking';
import { AdminDashboard } from './components/AdminDashboard';
import { User } from './types';
import { initializeUsers } from './utils/storageProvider';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const init = async () => {
      await initializeUsers();
    };
    init();
  }, []);

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
    return <AdminDashboard user={currentUser} onLogout={handleLogout} />;
  }

  return <TimeTracking user={currentUser} onLogout={handleLogout} />;
}

export default App;