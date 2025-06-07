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

interface ExtendedStatistics {
  calls: PhoneStatistics[];
  totalActivities: number;
  totalCalls: number;
  totalEmails: number;
  totalTickets: number;
  userStats: Map<string, {
    name: string;
    calls: number;
    emails: number;
    tickets: number;
    totalMinutes: number;
  }>;
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
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Handle navigation back to main page
  const handleBackToTimeTracking = () => {
    window.location.pathname = '/';
  };

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

  // Filter activities based on selected phone and date range
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      const activityDate = new Date(activity.timestamp).toISOString().split('T')[0];
      const phoneMatch = selectedPhone === 'all' || 
        (activity.activity_type === 'call' && activity.raw_data?.number?.digits === selectedPhone) ||
        (activity.activity_type !== 'call' && activity.user_email === selectedPhone);
      const dateMatch = (!startDate || activityDate >= startDate) && 
                       (!endDate || activityDate <= endDate);
      return phoneMatch && dateMatch;
    });
  }, [activities, selectedPhone, startDate, endDate]);

  // Calculate extended statistics for the selected date range
  const extendedStatistics = useMemo((): ExtendedStatistics => {
    const callStatsMap = new Map<string, PhoneStatistics>();
    const userStatsMap = new Map<string, any>();
    let totalCalls = 0;
    let totalEmails = 0;
    let totalTickets = 0;
    
    // Name normalization function to consolidate different variations of the same person
    const normalizeUserName = (name: string | null, email: string | null): string => {
      // Handle null/undefined cases
      if (!name && !email) return 'Unknown';
      
      const nameOrEmail = name || email || '';
      
      // Map email addresses and name variations to canonical names
      const nameMapping: { [key: string]: string } = {
        'pflegeteam.heer@pflegehilfe-senioren.de': 'Pflegeteam Heer',
        'Pflegeteam Heer': 'Pflegeteam Heer',
        'Ines Cürten': 'Ines Cürten',
        'I. Cürten I Pflegehilfe für Senioren': 'Ines Cürten',
        'Unknown': 'Unknown'
      };
      
      // Check if we have a direct mapping
      if (nameMapping[nameOrEmail]) {
        return nameMapping[nameOrEmail];
      }
      
      // Try to identify from email if it's an unknown name
      if (nameOrEmail === 'Unknown' && email) {
        // Check if email matches known patterns
        if (email === 'pflegeteam.heer@pflegehilfe-senioren.de') {
          return 'Pflegeteam Heer';
        }
        // Add more email pattern matching here if needed
      }
      
      // Return the original name if no mapping found
      return nameOrEmail;
    };
    
    filteredActivities.forEach(activity => {
      const userName = normalizeUserName(activity.user_name, activity.user_email);
      
      // Initialize user stats if not exists
      if (!userStatsMap.has(userName)) {
        userStatsMap.set(userName, {
          name: userName,
          calls: 0,
          emails: 0,
          tickets: 0,
          totalMinutes: 0
        });
      }
      
      const userStats = userStatsMap.get(userName)!;
      
      // Count by activity type
      switch (activity.activity_type) {
        case 'call':
          totalCalls++;
          userStats.calls++;
          
          const phone = activity.raw_data?.number?.digits || activity.user_email || 'Unknown';
          const phoneUserName = activity.user_name || phone;
          
          if (!callStatsMap.has(phone)) {
            callStatsMap.set(phone, {
              phoneNumber: phoneUserName,
              totalCalls: 0,
              totalMinutes: 0,
              inboundMinutes: 0,
              outboundMinutes: 0,
              inboundCalls: 0,
              outboundCalls: 0
            });
          }
          
          const callStats = callStatsMap.get(phone)!;
          callStats.totalCalls++;
          
          if (activity.duration_seconds) {
            const minutes = activity.duration_seconds / 60;
            callStats.totalMinutes += minutes;
            userStats.totalMinutes += minutes;
            
            if (activity.direction === 'inbound') {
              callStats.inboundMinutes += minutes;
              callStats.inboundCalls++;
            } else if (activity.direction === 'outbound') {
              callStats.outboundMinutes += minutes;
              callStats.outboundCalls++;
            }
          }
          break;
          
        case 'email':
          totalEmails++;
          userStats.emails++;
          break;
          
        case 'ticket':
          totalTickets++;
          userStats.tickets++;
          break;
      }
    });
    
    return {
      calls: Array.from(callStatsMap.values()).sort((a, b) => b.totalCalls - a.totalCalls),
      totalActivities: filteredActivities.length,
      totalCalls,
      totalEmails,
      totalTickets,
      userStats: userStatsMap
    };
  }, [filteredActivities]);

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
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f7fa',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header with Back Button */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          backgroundColor: 'white',
          padding: '20px 30px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: '600',
            color: '#1a202c'
          }}>Aktivitätslog</h1>
          
          <button
            onClick={handleBackToTimeTracking}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4299e1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#3182ce';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(66, 153, 225, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#4299e1';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            ← Zurück zur Zeiterfassung
          </button>
        </div>
      
        {/* Sync Controls */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px',
          padding: '20px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          transition: 'all 0.3s ease'
        }}>
        <div style={{ 
          fontSize: '14px', 
          color: '#718096',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <span style={{ fontWeight: '500', color: '#4a5568' }}>Letzte Synchronisation:</span>
          {syncStatus.map(status => (
            <span key={status.source_system} style={{ 
              backgroundColor: '#e6fffa',
              color: '#047857',
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '13px'
            }}>
              <strong>{status.source_system}:</strong> {
                status.last_sync_timestamp 
                  ? new Date(status.last_sync_timestamp).toLocaleString('de-DE')
                  : 'Noch nicht synchronisiert'
              }
            </span>
          ))}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleManualSync}
            disabled={syncing}
            style={{
              padding: '10px 20px',
              backgroundColor: syncing ? '#cbd5e0' : '#48bb78',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '500',
              cursor: syncing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => {
              if (!syncing) {
                e.currentTarget.style.backgroundColor = '#38a169';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(72, 187, 120, 0.3)';
              }
            }}
            onMouseOut={(e) => {
              if (!syncing) {
                e.currentTarget.style.backgroundColor = '#48bb78';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {syncing ? (
              <>
                <span style={{
                  display: 'inline-block',
                  width: '16px',
                  height: '16px',
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}></span>
                Synchronisiere...
              </>
            ) : (
              <>
                🔄 APIs synchronisieren
              </>
            )}
          </button>
          
          {backendAvailable === false && (
            <span style={{ 
              fontSize: '14px', 
              color: '#e53e3e',
              backgroundColor: '#fed7d7',
              padding: '6px 12px',
              borderRadius: '6px',
              fontWeight: '500'
            }}>
              ⚠️ Backend offline
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '24px',
        marginBottom: '24px',
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: '1', minWidth: '180px' }}>
          <label style={{ 
            display: 'block',
            marginBottom: '8px', 
            fontSize: '14px',
            fontWeight: '500',
            color: '#4a5568'
          }}>
            📅 Von Datum
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '15px',
              transition: 'all 0.2s ease',
              backgroundColor: '#f7fafc'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#4299e1';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(66, 153, 225, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
        
        <div style={{ flex: '1', minWidth: '180px' }}>
          <label style={{ 
            display: 'block',
            marginBottom: '8px', 
            fontSize: '14px',
            fontWeight: '500',
            color: '#4a5568'
          }}>
            📅 Bis Datum
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '15px',
              transition: 'all 0.2s ease',
              backgroundColor: '#f7fafc'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#4299e1';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(66, 153, 225, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
        
        <div style={{ flex: '2', minWidth: '250px' }}>
          <label style={{ 
            display: 'block',
            marginBottom: '8px', 
            fontSize: '14px',
            fontWeight: '500',
            color: '#4a5568'
          }}>
            📞 Telefonnummer
          </label>
          <select
            value={selectedPhone}
            onChange={(e) => setSelectedPhone(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '15px',
              transition: 'all 0.2s ease',
              backgroundColor: '#f7fafc',
              cursor: 'pointer'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#4299e1';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(66, 153, 225, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.boxShadow = 'none';
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

      {/* Extended Statistics Overview */}
      {extendedStatistics.totalActivities > 0 && (
        <div style={{
          marginBottom: '24px',
          padding: '24px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
        }}>
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: '20px',
            fontSize: '20px',
            color: '#2d3748',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📊 Gesamtstatistik für Zeitraum
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{
              padding: '16px',
              backgroundColor: '#f7fafc',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4299e1' }}>
                {extendedStatistics.totalActivities}
              </div>
              <div style={{ fontSize: '14px', color: '#718096' }}>Gesamt Aktivitäten</div>
            </div>
            
            <div style={{
              padding: '16px',
              backgroundColor: '#f0fff4',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#48bb78' }}>
                {extendedStatistics.totalCalls}
              </div>
              <div style={{ fontSize: '14px', color: '#718096' }}>Anrufe</div>
            </div>
            
            <div style={{
              padding: '16px',
              backgroundColor: '#ebf8ff',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3182ce' }}>
                {extendedStatistics.totalEmails}
              </div>
              <div style={{ fontSize: '14px', color: '#718096' }}>E-Mails</div>
            </div>
            
            <div style={{
              padding: '16px',
              backgroundColor: '#faf5ff',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#805ad5' }}>
                {extendedStatistics.totalTickets}
              </div>
              <div style={{ fontSize: '14px', color: '#718096' }}>Tickets</div>
            </div>
          </div>

          {/* User Activity Summary */}
          <h4 style={{ 
            marginTop: '24px',
            marginBottom: '16px',
            fontSize: '16px',
            color: '#2d3748'
          }}>
            Aktivitäten nach Teammitglied
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Teammitglied</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#4a5568' }}>Anrufe</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#4a5568' }}>E-Mails</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#4a5568' }}>Tickets</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#4a5568' }}>Gesamt</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#4a5568' }}>Minuten (Anrufe)</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(extendedStatistics.userStats.values())
                  .sort((a, b) => (b.calls + b.emails + b.tickets) - (a.calls + a.emails + a.tickets))
                  .map((userStat, index) => (
                    <tr key={userStat.name} style={{ 
                      borderBottom: '1px solid #e2e8f0',
                      backgroundColor: index % 2 === 0 ? '#f7fafc' : 'white',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#edf2f7';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#f7fafc' : 'white';
                    }}>
                      <td style={{ padding: '12px', fontWeight: '500' }}>{userStat.name}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{userStat.calls}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{userStat.emails}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{userStat.tickets}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#4299e1' }}>
                        {userStat.calls + userStat.emails + userStat.tickets}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#48bb78' }}>
                        {Math.round(userStat.totalMinutes)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Call Statistics */}
      {extendedStatistics.calls.length > 0 && (
        <div style={{
          marginBottom: '24px',
          padding: '24px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
        }}>
          <h3 style={{ 
            marginTop: 0,
            marginBottom: '20px',
            fontSize: '20px',
            fontWeight: '600',
            color: '#1a202c',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            📊 Detaillierte Anrufstatistik
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ backgroundColor: '#f7fafc' }}>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#4a5568',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Teammitglied</th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#4a5568',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Anrufe gesamt</th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#4a5568',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Eingehend</th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#4a5568',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Ausgehend</th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#4a5568',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Minuten gesamt</th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#4a5568',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Min. eingehend</th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#4a5568',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Min. ausgehend</th>
                </tr>
              </thead>
              <tbody>
                {extendedStatistics.calls.map((stat, index) => (
                  <tr key={stat.phoneNumber} style={{ 
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
                      padding: '12px 16px',
                      fontSize: '15px',
                      color: '#2d3748'
                    }}>{stat.phoneNumber}</td>
                    <td style={{ 
                      padding: '12px 16px', 
                      textAlign: 'center', 
                      fontWeight: '600',
                      fontSize: '15px',
                      color: '#4299e1'
                    }}>
                      {stat.totalCalls}
                    </td>
                    <td style={{ 
                      padding: '12px 16px', 
                      textAlign: 'center',
                      fontSize: '15px',
                      color: '#2d3748'
                    }}>
                      {stat.inboundCalls}
                    </td>
                    <td style={{ 
                      padding: '12px 16px', 
                      textAlign: 'center',
                      fontSize: '15px',
                      color: '#2d3748'
                    }}>
                      {stat.outboundCalls}
                    </td>
                    <td style={{ 
                      padding: '12px 16px', 
                      textAlign: 'center', 
                      fontWeight: '600',
                      fontSize: '15px',
                      color: '#48bb78'
                    }}>
                      {Math.round(stat.totalMinutes)}
                    </td>
                    <td style={{ 
                      padding: '12px 16px', 
                      textAlign: 'center',
                      fontSize: '15px',
                      color: '#2d3748'
                    }}>
                      {Math.round(stat.inboundMinutes)}
                    </td>
                    <td style={{ 
                      padding: '12px 16px', 
                      textAlign: 'center',
                      fontSize: '15px',
                      color: '#2d3748'
                    }}>
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
      <div style={{ 
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        padding: '24px',
        maxHeight: '70vh',
        overflowY: 'auto'
      }}>
        {Object.entries(groupedActivities).map(([date, dateActivities]) => (
          <div key={date} style={{ marginBottom: '32px' }}>
            <h3 style={{ 
              fontSize: '18px',
              fontWeight: '600',
              color: '#2d3748',
              marginBottom: '16px',
              paddingBottom: '8px',
              borderBottom: '2px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              📅 {date}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dateActivities.map(activity => (
                <div 
                  key={activity.id}
                  onClick={() => setSelectedActivity(activity)}
                  style={{
                    padding: '16px',
                    backgroundColor: '#f7fafc',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    border: '1px solid #e2e8f0',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#edf2f7';
                    e.currentTarget.style.borderColor = '#cbd5e0';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#f7fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '24px' }}>
                        {getActivityIcon(activity.activity_type, activity.direction)}
                      </span>
                      <span style={{ 
                        fontWeight: '600',
                        fontSize: '16px',
                        color: '#2d3748'
                      }}>
                        {formatTime(activity.timestamp)}
                      </span>
                      <span style={{ color: '#718096' }}>•</span>
                      <span style={{
                        fontSize: '15px',
                        color: '#4a5568'
                      }}>{getActivityDescription(activity)}</span>
                      {activity.user_name && (
                        <span style={{ 
                          backgroundColor: '#4299e1',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '13px',
                          fontWeight: '500',
                          marginLeft: 'auto'
                        }}>
                          {activity.user_name}
                        </span>
                      )}
                    </div>
                    
                    <div style={{ 
                      paddingLeft: '36px', 
                      fontSize: '14px', 
                      color: '#718096',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '20px'
                    }}>
                      {activity.contact_name && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <strong style={{ color: '#4a5568' }}>👤 Kontakt:</strong> {activity.contact_name}
                        </span>
                      )}
                      {activity.contact_phone && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <strong style={{ color: '#4a5568' }}>📞 Tel:</strong> {activity.contact_phone}
                        </span>
                      )}
                      {activity.contact_email && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <strong style={{ color: '#4a5568' }}>✉️ Email:</strong> {activity.contact_email}
                        </span>
                      )}
                      {activity.subject && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <strong style={{ color: '#4a5568' }}>📋 Betreff:</strong> {activity.subject}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setSelectedActivity(null)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '16px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              animation: 'modalFadeIn 0.2s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              marginTop: 0,
              marginBottom: '24px',
              fontSize: '24px',
              fontWeight: '600',
              color: '#1a202c',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '28px' }}>
                {getActivityIcon(selectedActivity.activity_type, selectedActivity.direction)}
              </span>
              Aktivitätsdetails
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr',
                gap: '12px',
                alignItems: 'start',
                padding: '16px',
                backgroundColor: '#f7fafc',
                borderRadius: '8px'
              }}>
                <span style={{ fontWeight: '600', color: '#4a5568' }}>Typ:</span>
                <span style={{ color: '#2d3748' }}>{selectedActivity.activity_type}</span>
                
                <span style={{ fontWeight: '600', color: '#4a5568' }}>Zeit:</span>
                <span style={{ color: '#2d3748' }}>{new Date(selectedActivity.timestamp).toLocaleString('de-DE')}</span>
                
                {selectedActivity.duration_seconds && (
                  <>
                    <span style={{ fontWeight: '600', color: '#4a5568' }}>Dauer:</span>
                    <span style={{ color: '#2d3748' }}>{formatDuration(selectedActivity.duration_seconds)}</span>
                  </>
                )}
                
                <span style={{ fontWeight: '600', color: '#4a5568' }}>Richtung:</span>
                <span style={{ color: '#2d3748' }}>{selectedActivity.direction || 'N/A'}</span>
                
                <span style={{ fontWeight: '600', color: '#4a5568' }}>Kontakt:</span>
                <div style={{ color: '#2d3748' }}>
                  {selectedActivity.contact_name && <div>{selectedActivity.contact_name}</div>}
                  {selectedActivity.contact_email && <div>{selectedActivity.contact_email}</div>}
                  {selectedActivity.contact_phone && <div>{selectedActivity.contact_phone}</div>}
                  {!selectedActivity.contact_name && !selectedActivity.contact_email && !selectedActivity.contact_phone && <div>-</div>}
                </div>
                
                <span style={{ fontWeight: '600', color: '#4a5568' }}>Bearbeiter:</span>
                <span style={{ color: '#2d3748' }}>{selectedActivity.user_name || selectedActivity.user_email || 'Unbekannt'}</span>
                
                {selectedActivity.subject && (
                  <>
                    <span style={{ fontWeight: '600', color: '#4a5568' }}>Betreff:</span>
                    <span style={{ color: '#2d3748' }}>{selectedActivity.subject}</span>
                  </>
                )}
                
                {selectedActivity.preview && (
                  <>
                    <span style={{ fontWeight: '600', color: '#4a5568' }}>Vorschau:</span>
                    <span style={{ color: '#2d3748' }}>{selectedActivity.preview}</span>
                  </>
                )}
              </div>
            </div>
            <button 
              onClick={() => setSelectedActivity(null)}
              style={{
                marginTop: '24px',
                padding: '12px 24px',
                backgroundColor: '#4299e1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: '100%'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#3182ce';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(66, 153, 225, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#4299e1';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Schließen
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};