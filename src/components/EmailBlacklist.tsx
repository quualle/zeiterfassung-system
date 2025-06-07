import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import '../App.css';

interface BlacklistedEmail {
  id: string;
  email: string;
  reason: string | null;
  created_at: string;
  is_active: boolean;
}

export const EmailBlacklist: React.FC = () => {
  const [blacklist, setBlacklist] = useState<BlacklistedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newReason, setNewReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch blacklisted emails
  const fetchBlacklist = async () => {
    try {
      const { data, error } = await supabase
        .from('email_blacklist')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBlacklist(data || []);
    } catch (err: any) {
      console.error('Error fetching blacklist:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlacklist();
  }, []);

  // Add email to blacklist
  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!newEmail.trim()) {
      setError('Bitte geben Sie eine E-Mail-Adresse ein');
      return;
    }

    try {
      const { error } = await supabase
        .from('email_blacklist')
        .insert([{
          email: newEmail.toLowerCase().trim(),
          reason: newReason.trim() || null
        }]);

      if (error) throw error;

      setSuccessMessage('E-Mail erfolgreich zur Blacklist hinzugefügt');
      setNewEmail('');
      setNewReason('');
      await fetchBlacklist();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Toggle email active status
  const toggleEmailStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('email_blacklist')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      await fetchBlacklist();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Delete email from blacklist
  const deleteEmail = async (id: string) => {
    if (!window.confirm('Möchten Sie diese E-Mail wirklich aus der Blacklist entfernen?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_blacklist')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSuccessMessage('E-Mail erfolgreich entfernt');
      await fetchBlacklist();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Lade Blacklist...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '30px', color: '#333' }}>E-Mail Blacklist</h2>
      
      {/* Add new email form */}
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        marginBottom: '30px'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px' }}>
          Neue E-Mail zur Blacklist hinzufügen
        </h3>
        
        <form onSubmit={handleAddEmail} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '2', minWidth: '250px' }}>
            <input
              type="email"
              placeholder="E-Mail-Adresse"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '15px'
              }}
              required
            />
          </div>
          
          <div style={{ flex: '1', minWidth: '200px' }}>
            <input
              type="text"
              placeholder="Grund (optional)"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '15px'
              }}
            />
          </div>
          
          <button
            type="submit"
            style={{
              padding: '10px 24px',
              backgroundColor: '#48bb78',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#38a169';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#48bb78';
            }}
          >
            Hinzufügen
          </button>
        </form>
      </div>

      {/* Messages */}
      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}
      
      {successMessage && (
        <div style={{
          backgroundColor: '#d1fae5',
          color: '#065f46',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {successMessage}
        </div>
      )}

      {/* Blacklist table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>
            Geblockte E-Mail-Adressen ({blacklist.length})
          </h3>
        </div>
        
        {blacklist.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#718096'
          }}>
            Keine E-Mail-Adressen in der Blacklist
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f7fafc' }}>
                  <th style={{
                    padding: '12px 24px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#4a5568',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    E-Mail-Adresse
                  </th>
                  <th style={{
                    padding: '12px 24px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#4a5568',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    Grund
                  </th>
                  <th style={{
                    padding: '12px 24px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#4a5568',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    Hinzugefügt am
                  </th>
                  <th style={{
                    padding: '12px 24px',
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#4a5568',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    Status
                  </th>
                  <th style={{
                    padding: '12px 24px',
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#4a5568',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody>
                {blacklist.map((item) => (
                  <tr key={item.id} style={{
                    borderBottom: '1px solid #e2e8f0',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#f7fafc';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}>
                    <td style={{
                      padding: '16px 24px',
                      fontSize: '15px',
                      color: '#2d3748'
                    }}>
                      {item.email}
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      fontSize: '15px',
                      color: '#718096'
                    }}>
                      {item.reason || '-'}
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      fontSize: '14px',
                      color: '#718096'
                    }}>
                      {new Date(item.created_at).toLocaleDateString('de-DE')}
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      textAlign: 'center'
                    }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: '500',
                        backgroundColor: item.is_active ? '#d1fae5' : '#fee2e2',
                        color: item.is_active ? '#065f46' : '#991b1b'
                      }}>
                        {item.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      textAlign: 'center'
                    }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => toggleEmailStatus(item.id, item.is_active)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: item.is_active ? '#f59e0b' : '#48bb78',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.opacity = '0.8';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.opacity = '1';
                          }}
                        >
                          {item.is_active ? 'Deaktivieren' : 'Aktivieren'}
                        </button>
                        <button
                          onClick={() => deleteEmail(item.id)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = '#dc2626';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = '#ef4444';
                          }}
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};