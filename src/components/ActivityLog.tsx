import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { syncWithBackend, checkBackendHealth } from '../utils/backendSync';
import '../App.css';

interface Activity {
  id: string;
  activity_type: 'email' | 'ticket' | 'call';
  direction: 'inbound' | 'outbound' | null;
  timestamp: string;
  duration_seconds: number | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  subject: string | null;
  preview: string | null;
  user_email: string | null;
  user_name: string | null;
  raw_data?: any;
}

interface SyncStatus {
  source_system: string;
  last_sync_timestamp: string | null;
  sync_status: string;
  error_message: string | null;
}

interface PhoneStatistics {
  phoneNumber: string;
  totalCalls: number;
  totalMinutes: number;
  inboundMinutes: number;
  outboundMinutes: number;
  inboundCalls: number;
  outboundCalls: number;
}

export const ActivityLog: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Get unique phone numbers from call activities with user names
  const phoneNumbers = useMemo(() => {
    const phoneMap = new Map<string, string>();
    activities
      .filter(a => a.activity_type === 'call' && a.raw_data?.number?.digits)
      .forEach(a => {
        const phoneNumber = a.raw_data?.number?.digits;
        const userName = a.user_name || phoneNumber;
        if (phoneNumber && !phoneMap.has(phoneNumber)) {
          phoneMap.set(phoneNumber, userName);
        }
      });
    return Array.from(phoneMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [activities]);

  // Filter activities based on selected phone and date
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      const activityDate = new Date(activity.timestamp).toISOString().split('T')[0];
      const phoneMatch = selectedPhone === 'all' || 
        (activity.activity_type === 'call' && activity.raw_data?.number?.digits === selectedPhone) ||
        (activity.activity_type !== 'call' && activity.user_email === selectedPhone);
      const dateMatch = !selectedDate || activityDate === selectedDate;
      return phoneMatch && dateMatch;
    });
  }, [activities, selectedPhone, selectedDate]);

  // Calculate statistics for the selected date
  const statistics = useMemo((): PhoneStatistics[] => {
    const statsMap = new Map<string, PhoneStatistics>();
    
    activities
      .filter(a => {
        const activityDate = new Date(a.timestamp).toISOString().split('T')[0];
        return a.activity_type === 'call' && (!selectedDate || activityDate === selectedDate);
      })
      .forEach(activity => {
        const phone = activity.raw_data?.number?.digits || activity.user_email || 'Unknown';
        const userName = activity.user_name || phone;
        
        if (!statsMap.has(phone)) {
          statsMap.set(phone, {
            phoneNumber: userName,
            totalCalls: 0,
            totalMinutes: 0,
            inboundMinutes: 0,
            outboundMinutes: 0,
            inboundCalls: 0,
            outboundCalls: 0
          });
        }
        
        const stats = statsMap.get(phone)!;
        stats.totalCalls++;
        
        if (activity.duration_seconds) {
          const minutes = activity.duration_seconds / 60;
          stats.totalMinutes += minutes;
          
          if (activity.direction === 'inbound') {
            stats.inboundMinutes += minutes;
            stats.inboundCalls++;
          } else if (activity.direction === 'outbound') {
            stats.outboundMinutes += minutes;
            stats.outboundCalls++;
          }
        }
      });
    
    return Array.from(statsMap.values()).sort((a, b) => b.totalCalls - a.totalCalls);
  }, [activities, selectedDate]);

  // Fetch activities from Supabase
  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error) throw error;
      setActivities(data || []);
    } catch (err: any) {
      console.error('Error fetching activities:', err);
      setError(err.message);
    }
  };

  // Fetch sync status
  const fetchSyncStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('sync_status')
        .select('*');

      if (error) throw error;
      setSyncStatus(data || []);
    } catch (err: any) {
      console.error('Error fetching sync status:', err);
    }
  };

  // Initial load and setup refresh interval
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      // Check backend availability
      const isAvailable = await checkBackendHealth();
      setBackendAvailable(isAvailable);
      
      
      await Promise.all([fetchActivities(), fetchSyncStatus()]);
      setLoading(false);
    };

    loadData();

    // Refresh every 2 minutes
    const interval = setInterval(loadData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Format date
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get activity icon
  const getActivityIcon = (type: string, direction: string | null) => {
    if (type === 'call') {
      return direction === 'inbound' ? '📞' : '☎️';
    } else if (type === 'email') {
      return direction === 'outbound' ? '📧' : '📨';
    } else if (type === 'ticket') {
      return '🎫';
    }
    return '📝';
  };

  // Get activity description
  const getActivityDescription = (activity: Activity) => {
    if (activity.activity_type === 'call') {
      const duration = activity.duration_seconds 
        ? ` (${formatDuration(activity.duration_seconds)})` 
        : '';
      return `${activity.direction === 'inbound' ? 'Eingehender' : 'Ausgehender'} Anruf${duration}`;
    } else if (activity.activity_type === 'email') {
      return `${activity.direction === 'outbound' ? 'Ausgehende' : 'Eingehende'} Email`;
    } else if (activity.activity_type === 'ticket') {
      return 'Ausgehende Ticketnachricht';
    }
    return 'Aktivität';
  };

  // Group activities by date
  const groupedActivities = filteredActivities.reduce((groups, activity) => {
    const date = formatDate(activity.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, Activity[]>);

  if (loading) {
    return (
      <div className="container">
        <h2>Aktivitätslog lädt...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <h2>Fehler beim Laden der Aktivitäten</h2>
        <p style={{ color: 'red' }}>{error}</p>
      </div>
    );
  }

  // Manual sync function - uses backend if available
  const handleManualSync = async () => {
    setSyncing(true);
    setError(null);
    
    try {
      // Try backend sync first
      if (backendAvailable) {
        const result = await syncWithBackend();
        if (result.success) {
          await fetchActivities();
          await fetchSyncStatus();
          console.log('Backend sync successful:', result.details);
        } else {
          setError(result.message);
        }
      } else {
        // No backend available
        setError('Backend sync service is not available');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };


  return (
    <div className="container">
      <h2>Aktivitätslog</h2>
      
      {/* Sync Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '12px', color: '#666' }}>
          Letzte Synchronisation: {' '}
          {syncStatus.map(status => (
            <span key={status.source_system} style={{ marginRight: '15px' }}>
              {status.source_system}: {
                status.last_sync_timestamp 
                  ? new Date(status.last_sync_timestamp).toLocaleString('de-DE')
                  : 'Noch nicht synchronisiert'
              }
            </span>
          ))}
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleManualSync}
            disabled={syncing}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: syncing ? 'not-allowed' : 'pointer',
              opacity: syncing ? 0.6 : 1
            }}
          >
            {syncing ? 'Synchronisiere...' : 'APIs synchronisieren'}
          </button>
          
          
          {backendAvailable === false && (
            <span style={{ 
              fontSize: '12px', 
              color: '#dc3545',
              marginLeft: '10px'
            }}>
              Backend offline
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '20px',
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div>
          <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Datum:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '5px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
        </div>
        
        <div>
          <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Telefonnummer:</label>
          <select
            value={selectedPhone}
            onChange={(e) => setSelectedPhone(e.target.value)}
            style={{
              padding: '5px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              minWidth: '200px'
            }}
          >
            <option value="all">Alle Nummern</option>
            {phoneNumbers.map(([phone, name]) => (
              <option key={phone} value={phone}>
                {name} ({phone})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistics */}
      {statistics.length > 0 && (
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#e8f4f8',
          borderRadius: '8px'
        }}>
          <h3 style={{ marginTop: 0 }}>Anrufstatistik {selectedDate ? `für ${formatDate(selectedDate + 'T00:00:00')}` : ''}</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #007bff' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Teammitglied</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Anrufe gesamt</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Eingehend</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Ausgehend</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Minuten gesamt</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Min. eingehend</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Min. ausgehend</th>
                </tr>
              </thead>
              <tbody>
                {statistics.map((stat, index) => (
                  <tr key={stat.phoneNumber} style={{ 
                    borderBottom: '1px solid #ddd',
                    backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white'
                  }}>
                    <td style={{ padding: '10px' }}>{stat.phoneNumber}</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                      {stat.totalCalls}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {stat.inboundCalls}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {stat.outboundCalls}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                      {Math.round(stat.totalMinutes)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {Math.round(stat.inboundMinutes)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {Math.round(stat.outboundMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activities List */}
      <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {Object.entries(groupedActivities).map(([date, dateActivities]) => (
          <div key={date} style={{ marginBottom: '30px' }}>
            <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
              {date}
            </h3>
            {dateActivities.map(activity => (
              <div 
                key={activity.id}
                onClick={() => setSelectedActivity(activity)}
                className="activity-item"
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  border: '1px solid #eee',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>
                      {getActivityIcon(activity.activity_type, activity.direction)}
                    </span>
                    <span style={{ fontWeight: 'bold' }}>
                      {formatTime(activity.timestamp)}
                    </span>
                    <span>-</span>
                    <span>{getActivityDescription(activity)}</span>
                    {activity.user_name && (
                      <span style={{ 
                        backgroundColor: '#007bff',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}>
                        {activity.user_name}
                      </span>
                    )}
                  </div>
                  
                  <div style={{ paddingLeft: '30px', fontSize: '14px', color: '#666' }}>
                    {activity.contact_name && (
                      <span style={{ marginRight: '15px' }}>
                        <strong>Kontakt:</strong> {activity.contact_name}
                      </span>
                    )}
                    {activity.contact_phone && (
                      <span style={{ marginRight: '15px' }}>
                        <strong>Tel:</strong> {activity.contact_phone}
                      </span>
                    )}
                    {activity.contact_email && (
                      <span style={{ marginRight: '15px' }}>
                        <strong>Email:</strong> {activity.contact_email}
                      </span>
                    )}
                    {activity.subject && (
                      <span>
                        <strong>Betreff:</strong> {activity.subject}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setSelectedActivity(null)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '10px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Aktivitätsdetails</h3>
            <table style={{ width: '100%' }}>
              <tbody>
                <tr>
                  <td><strong>Typ:</strong></td>
                  <td>{selectedActivity.activity_type}</td>
                </tr>
                <tr>
                  <td><strong>Zeit:</strong></td>
                  <td>{new Date(selectedActivity.timestamp).toLocaleString('de-DE')}</td>
                </tr>
                {selectedActivity.duration_seconds && (
                  <tr>
                    <td><strong>Dauer:</strong></td>
                    <td>{formatDuration(selectedActivity.duration_seconds)}</td>
                  </tr>
                )}
                <tr>
                  <td><strong>Richtung:</strong></td>
                  <td>{selectedActivity.direction || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Kontakt:</strong></td>
                  <td>
                    {selectedActivity.contact_name && <div>{selectedActivity.contact_name}</div>}
                    {selectedActivity.contact_email && <div>{selectedActivity.contact_email}</div>}
                    {selectedActivity.contact_phone && <div>{selectedActivity.contact_phone}</div>}
                  </td>
                </tr>
                <tr>
                  <td><strong>Bearbeiter:</strong></td>
                  <td>{selectedActivity.user_name || selectedActivity.user_email || 'Unbekannt'}</td>
                </tr>
                {selectedActivity.subject && (
                  <tr>
                    <td><strong>Betreff:</strong></td>
                    <td>{selectedActivity.subject}</td>
                  </tr>
                )}
                {selectedActivity.preview && (
                  <tr>
                    <td><strong>Vorschau:</strong></td>
                    <td>{selectedActivity.preview}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <button 
              onClick={() => setSelectedActivity(null)}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};