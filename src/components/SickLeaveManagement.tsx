import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface SickLeave {
  id: string;
  userId: string;
  userName?: string;
  startDate: string;
  endDate: string;
  reason: string;
  certificateRequired: boolean;
  certificateSubmitted: boolean;
  fileUrls?: string[];
  fileNames?: string[];
  createdAt: string;
  createdBy: string;
}

interface Props {
  currentUser: User;
}

export const SickLeaveManagement: React.FC<Props> = ({ currentUser }) => {
  const [sickLeaves, setSickLeaves] = useState<SickLeave[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    userId: '',
    startDate: '',
    endDate: '',
    reason: '',
    certificateRequired: false
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);

  useEffect(() => {
    loadSickLeaves();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('users_zeiterfassung')
      .select('*')
      .neq('role', 'admin')
      .order('name');

    if (!error && data) {
      setUsers(data);
    }
  };

  const loadSickLeaves = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sick_leaves')
        .select(`
          *,
          users_zeiterfassung!sick_leaves_user_id_fkey (name)
        `)
        .order('start_date', { ascending: false });

      if (!error && data) {
        const enrichedData = data.map(leave => ({
          ...leave,
          userId: leave.user_id,
          userName: leave.users_zeiterfassung?.name,
          startDate: leave.start_date,
          endDate: leave.end_date,
          certificateRequired: leave.certificate_required,
          certificateSubmitted: leave.certificate_submitted,
          fileUrls: leave.file_urls || [],
          fileNames: leave.file_names || [],
          createdAt: leave.created_at,
          createdBy: leave.created_by
        }));
        setSickLeaves(enrichedData);
      }
    } catch (error) {
      console.error('Error loading sick leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = async (sickLeaveId: string, files: File[]) => {
    const fileUrls: string[] = [];
    const fileNames: string[] = [];

    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${sickLeaveId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('krankmeldungen')
        .upload(fileName, file);

      if (error) {
        console.error('Error uploading file:', error);
        throw error;
      }

      if (data) {
        fileUrls.push(data.path);
        fileNames.push(file.name);
      }
    }

    return { fileUrls, fileNames };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.userId || !formData.startDate || !formData.endDate) {
      alert('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      alert('Enddatum kann nicht vor Startdatum liegen');
      return;
    }

    try {
      setUploadingFiles(true);
      
      // Erst Krankmeldung erstellen
      const { data: sickLeaveData, error: insertError } = await supabase
        .from('sick_leaves')
        .insert({
          user_id: formData.userId,
          start_date: formData.startDate,
          end_date: formData.endDate,
          reason: formData.reason,
          certificate_required: formData.certificateRequired,
          certificate_submitted: false,
          created_by: currentUser.id
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating sick leave:', insertError);
        
        // Spezifische Fehlerbehandlung
        if (insertError.code === '42501') {
          alert('Fehler: Keine Berechtigung zum Erstellen von Krankmeldungen.');
        } else if (insertError.code === '23503') {
          alert('Fehler: Der ausgewählte Benutzer existiert nicht in der Datenbank.');
        } else {
          alert(`Fehler beim Speichern der Krankmeldung: ${insertError.message}\n\nFehlercode: ${insertError.code}`);
        }
        return;
      }
      
      if (!sickLeaveData) {
        console.error('No data returned from insert');
        alert('Fehler: Krankmeldung wurde nicht gespeichert (keine Daten zurückgegeben).');
        return;
      }

      // Dann Dateien hochladen, falls vorhanden
      if (selectedFiles.length > 0 && sickLeaveData) {
        try {
          const { fileUrls, fileNames } = await uploadFiles(sickLeaveData.id, selectedFiles);
          
          // Krankmeldung mit Datei-Referenzen aktualisieren
          const { error: updateError } = await supabase
            .from('sick_leaves')
            .update({
              file_urls: fileUrls,
              file_names: fileNames,
              certificate_submitted: true
            })
            .eq('id', sickLeaveData.id);

          if (updateError) {
            console.error('Error updating sick leave with files:', updateError);
          }
        } catch (uploadError) {
          console.error('Error uploading files:', uploadError);
          alert('Krankmeldung wurde gespeichert, aber Dateien konnten nicht hochgeladen werden');
        }
      }

      alert('Krankmeldung erfolgreich gespeichert');
      setShowForm(false);
      setFormData({
        userId: '',
        startDate: '',
        endDate: '',
        reason: '',
        certificateRequired: false
      });
      setSelectedFiles([]);
      loadSickLeaves();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setUploadingFiles(false);
    }
  };

  const toggleCertificate = async (id: string, submitted: boolean) => {
    try {
      const { error } = await supabase
        .from('sick_leaves')
        .update({ certificate_submitted: submitted })
        .eq('id', id);

      if (!error) {
        loadSickLeaves();
      }
    } catch (error) {
      console.error('Error updating certificate status:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setSelectedFiles(Array.from(files));
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddFilesToExisting = async (leaveId: string) => {
    if (selectedFiles.length === 0) {
      alert('Bitte wählen Sie mindestens eine Datei aus');
      return;
    }

    try {
      setUploadingFiles(true);
      
      // Hole aktuelle Datei-Listen
      const { data: currentLeave, error: fetchError } = await supabase
        .from('sick_leaves')
        .select('file_urls, file_names')
        .eq('id', leaveId)
        .single();

      if (fetchError) {
        console.error('Error fetching current files:', fetchError);
        return;
      }

      // Lade neue Dateien hoch
      const { fileUrls, fileNames } = await uploadFiles(leaveId, selectedFiles);
      
      // Füge neue Dateien zu bestehenden hinzu
      const updatedUrls = [...(currentLeave?.file_urls || []), ...fileUrls];
      const updatedNames = [...(currentLeave?.file_names || []), ...fileNames];
      
      // Aktualisiere Krankmeldung
      const { error: updateError } = await supabase
        .from('sick_leaves')
        .update({
          file_urls: updatedUrls,
          file_names: updatedNames,
          certificate_submitted: true
        })
        .eq('id', leaveId);

      if (updateError) {
        console.error('Error updating sick leave:', updateError);
        alert('Fehler beim Speichern der Dateien');
      } else {
        alert('Dateien erfolgreich hochgeladen');
        setSelectedFiles([]);
        setEditingLeaveId(null);
        loadSickLeaves();
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Fehler beim Hochladen der Dateien');
    } finally {
      setUploadingFiles(false);
    }
  };

  const downloadFile = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('krankmeldungen')
        .download(fileUrl);

      if (error) {
        console.error('Error downloading file:', error);
        alert('Fehler beim Herunterladen der Datei');
        return;
      }

      // Erstelle einen Download-Link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const deleteSickLeave = async (id: string) => {
    if (!window.confirm('Krankmeldung wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('sick_leaves')
        .delete()
        .eq('id', id);

      if (!error) {
        loadSickLeaves();
      }
    } catch (error) {
      console.error('Error deleting sick leave:', error);
    }
  };

  const calculateDays = (start: string, end: string): number => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  return (
    <div className="sick-leave-management">
      <div className="section-header">
        <h3>Krankmeldungen verwalten</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Abbrechen' : 'Neue Krankmeldung'}
        </button>
      </div>

      {showForm && (
        <form className="sick-leave-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Mitarbeiter *</label>
              <select
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                required
              >
                <option value="">Wählen...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Von *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Bis *</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                min={formData.startDate}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Grund / Bemerkung</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={3}
                placeholder="z.B. Grippe, Erkältung, etc."
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.certificateRequired}
                  onChange={(e) => setFormData({ ...formData, certificateRequired: e.target.checked })}
                />
                Attest erforderlich
              </label>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Dateien anhängen (Krankmeldungen, Atteste)</label>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                disabled={uploadingFiles}
              />
              {selectedFiles.length > 0 && (
                <div className="selected-files">
                  <p>Ausgewählte Dateien:</p>
                  <ul>
                    {selectedFiles.map((file, index) => (
                      <li key={index}>
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        <button
                          type="button"
                          className="btn-remove-file"
                          onClick={() => removeSelectedFile(index)}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-success" disabled={uploadingFiles}>
              {uploadingFiles ? 'Wird hochgeladen...' : 'Speichern'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => {
              setShowForm(false);
              setSelectedFiles([]);
            }}>
              Abbrechen
            </button>
          </div>
        </form>
      )}

      <div className="sick-leaves-list">
        {loading ? (
          <p>Lade...</p>
        ) : sickLeaves.length === 0 ? (
          <p className="no-data">Keine Krankmeldungen vorhanden</p>
        ) : (
          <table className="sick-leaves-table">
            <thead>
              <tr>
                <th>Mitarbeiter</th>
                <th>Von</th>
                <th>Bis</th>
                <th>Tage</th>
                <th>Grund</th>
                <th>Attest</th>
                <th>Dateien</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {sickLeaves.map(leave => (
                <tr key={leave.id}>
                  <td>{leave.userName}</td>
                  <td>{new Date(leave.startDate).toLocaleDateString('de-DE')}</td>
                  <td>{new Date(leave.endDate).toLocaleDateString('de-DE')}</td>
                  <td>{calculateDays(leave.startDate, leave.endDate)}</td>
                  <td>{leave.reason || '-'}</td>
                  <td>
                    {leave.certificateRequired ? (
                      <label className="certificate-status">
                        <input
                          type="checkbox"
                          checked={leave.certificateSubmitted}
                          onChange={(e) => toggleCertificate(leave.id, e.target.checked)}
                        />
                        {leave.certificateSubmitted ? ' Vorhanden' : ' Ausstehend'}
                      </label>
                    ) : (
                      <span className="text-muted">Nicht erforderlich</span>
                    )}
                  </td>
                  <td>
                    {leave.fileUrls && leave.fileUrls.length > 0 ? (
                      <div className="file-list">
                        {leave.fileUrls.map((url, idx) => (
                          <button
                            key={idx}
                            className="btn btn-sm btn-link"
                            onClick={() => downloadFile(url, leave.fileNames?.[idx] || `Datei_${idx + 1}`)}
                            title={leave.fileNames?.[idx] || `Datei ${idx + 1}`}
                          >
                            📎 {leave.fileNames?.[idx] || `Datei ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                    {editingLeaveId === leave.id ? (
                      <div className="inline-file-upload">
                        <input
                          type="file"
                          multiple
                          accept="image/*,application/pdf"
                          onChange={handleFileSelect}
                          disabled={uploadingFiles}
                        />
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleAddFilesToExisting(leave.id)}
                          disabled={uploadingFiles || selectedFiles.length === 0}
                        >
                          {uploadingFiles ? 'Lädt...' : 'Hochladen'}
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setEditingLeaveId(null);
                            setSelectedFiles([]);
                          }}
                        >
                          Abbrechen
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => setEditingLeaveId(leave.id)}
                      >
                        + Datei
                      </button>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteSickLeave(leave.id)}
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
};