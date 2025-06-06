import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { createSampleActivities } from '../utils/activitySync';
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
}

interface SyncStatus {
  source_system: string;
  last_sync_timestamp: string | null;
  sync_status: string;
  error_message: string | null;
}

export const ActivityLog: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      
      // Create sample data on first load (temporary)
      const { count } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true });
      
      if (count === 0) {
        await createSampleActivities();
      }
      
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
  const groupedActivities = activities.reduce((groups, activity) => {
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

  return (
    <div className="container">
      <h2>Aktivitätslog</h2>
      
      {/* Sync Status */}
      <div style={{ marginBottom: '20px', fontSize: '12px', color: '#666' }}>
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
                  padding: '10px',
                  marginBottom: '5px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  border: '1px solid #eee',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>
                    {getActivityIcon(activity.activity_type, activity.direction)}
                  </span>
                  <span style={{ fontWeight: 'bold' }}>
                    {formatTime(activity.timestamp)}
                  </span>
                  <span>-</span>
                  <span>{getActivityDescription(activity)}</span>
                  {activity.subject && (
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#666',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '300px'
                    }}>
                      ({activity.subject})
                    </span>
                  )}
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