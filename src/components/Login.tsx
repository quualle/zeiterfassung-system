import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authenticateUser, getUsers, getUserByName, updateUser } from '../utils/storageProvider';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsername, setSelectedUsername] = useState('');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      const allUsers = await getUsers();
      setUsers(allUsers);
    };
    loadUsers();
  }, []);

  const handleUsernameChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const username = e.target.value;
    setSelectedUsername(username);
    setError('');
    setPin('');
    
    if (username) {
      const user = await getUserByName(username);
      if (user && user.firstLogin) {
        setIsFirstLogin(true);
      } else {
        setIsFirstLogin(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUsername) {
      setError('Bitte wählen Sie einen Benutzer aus');
      return;
    }

    const user = await getUserByName(selectedUsername);
    if (!user) {
      setError('Benutzer nicht gefunden');
      return;
    }

    if (isFirstLogin) {
      // Erste Anmeldung - PIN setzen
      if (newPin.length !== 4) {
        setError('PIN muss 4-stellig sein');
        return;
      }
      
      if (newPin !== confirmPin) {
        setError('PINs stimmen nicht überein');
        return;
      }

      // PIN speichern
      const updatedUser = {
        ...user,
        pin: newPin,
        firstLogin: false
      };
      await updateUser(updatedUser);
      onLogin(updatedUser);
    } else {
      // Normale Anmeldung - Prüfe zuerst Arbeitszeitregeln
      if (user.role !== 'admin') {
        // Hole die Arbeitszeitregeln für diesen Benutzer
        const { data: workTimeRule, error: ruleError } = await supabase
          .from('work_time_rules')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (!ruleError && workTimeRule && workTimeRule.is_active) {
          const now = new Date();
          const currentTime = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          
          if (currentTime < workTimeRule.earliest_login_time) {
            const earliestTime = workTimeRule.earliest_login_time.substring(0, 5);
            setError(`Login erst ab ${earliestTime} Uhr möglich`);
            return;
          }
        }
      }

      const authenticatedUser = await authenticateUser(selectedUsername, pin);
      
      if (authenticatedUser) {
        onLogin(authenticatedUser);
      } else {
        setError('Ungültiger PIN');
      }
    }
  };

  return (
    <div className="login-container">
      <h1>Zeiterfassung</h1>
      <form onSubmit={handleSubmit} className="login-form">
        <h2>{isFirstLogin ? 'Erste Anmeldung - PIN festlegen' : 'Anmeldung'}</h2>
        
        <div className="form-group">
          <label htmlFor="username">Benutzer:</label>
          <select
            id="username"
            value={selectedUsername}
            onChange={handleUsernameChange}
            className="username-select"
          >
            <option value="">Bitte wählen...</option>
            {users.map(user => (
              <option key={user.id} value={user.name}>
                {user.name}
              </option>
            ))}
          </select>
        </div>

        {selectedUsername && (
          <>
            {isFirstLogin ? (
              <>
                <div className="form-group">
                  <label htmlFor="newPin">Neuer PIN (4-stellig):</label>
                  <input
                    type="password"
                    id="newPin"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    maxLength={4}
                    placeholder="4-stelliger PIN"
                    className="pin-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="confirmPin">PIN bestätigen:</label>
                  <input
                    type="password"
                    id="confirmPin"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    maxLength={4}
                    placeholder="PIN wiederholen"
                    className="pin-input"
                  />
                </div>
              </>
            ) : (
              <div className="form-group">
                <label htmlFor="pin">PIN eingeben:</label>
                <input
                  type="password"
                  id="pin"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={4}
                  placeholder="4-stelliger PIN"
                  className="pin-input"
                />
              </div>
            )}
          </>
        )}

        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={!selectedUsername}>
          {isFirstLogin ? 'PIN festlegen' : 'Anmelden'}
        </button>
      </form>
    </div>
  );
};