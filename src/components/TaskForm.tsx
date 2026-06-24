import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, UploadCloud, ChevronDown } from 'lucide-react';
import { createTask, uploadReferenceImages } from '../services/taskService';
import { getProjectById, getUserProjects } from '../services/projectService';
import type { Project } from '../services/projectService';
import { getUserCompanies } from '../services/companyService';
import type { Company } from '../services/companyService';
import { getUsersByIds } from '../services/userService';
import type { UserProfile } from '../services/userService';
import type { User } from 'firebase/auth';

interface TaskFormProps {
  user: User;
  projectId?: string; // If provided, locks the project. If not, needs company & project selectors
  onClose: () => void;
  onTaskCreated: () => void;
}

const TaskForm = ({ user, projectId, onClose, onTaskCreated }: TaskFormProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'Critica' | 'Alta' | 'Media' | 'Baja'>('Media');
  const [deadline, setDeadline] = useState('');
  const [requiresEvidence, setRequiresEvidence] = useState(false);
  
  // Multiple Photos
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global creation support
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '');

  // Assignment
  const [projectMembers, setProjectMembers] = useState<UserProfile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasValidated, setWasValidated] = useState(false);

  useEffect(() => {
    // Load members for assignment when project changes
    const loadMembers = async () => {
      setProjectMembers([]);
      setSelectedUserIds([]);
      if (selectedProjectId) {
        const proj = await getProjectById(selectedProjectId);
        if (proj && proj.memberIds.length > 0) {
          const profiles = await getUsersByIds(proj.memberIds);
          setProjectMembers(profiles);
        }
      }
    };
    loadMembers();
  }, [selectedProjectId]);

  useEffect(() => {
    // Load available companies and projects if opened globally
    const loadGlobalData = async () => {
      if (!projectId) {
        const [companiesData, projects] = await Promise.all([
          getUserCompanies(user.uid),
          getUserProjects(user.uid)
        ]);
        setAvailableCompanies(companiesData.activeCompanies);
        setAvailableProjects(projects);
      }
    };
    loadGlobalData();
  }, [projectId, user.uid]);

  // Filter projects when company is selected
  useEffect(() => {
    if (!projectId) {
      if (selectedCompanyId) {
        setFilteredProjects(availableProjects.filter(p => p.companyId === selectedCompanyId));
      } else {
        setFilteredProjects([]);
      }
      setSelectedProjectId(''); // Reset project if company changes
    }
  }, [selectedCompanyId, availableProjects, projectId]);

  const handlePhotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      setPhotos(prev => [...prev, ...selectedFiles]);
      
      // Generate previews
      const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const toggleUserSelection = (uid: string) => {
    setSelectedUserIds(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert("Debe seleccionar un proyecto");
      return;
    }
    
    setIsSubmitting(true);
    try {
      let companyIdToUse = selectedCompanyId;
      if (!companyIdToUse) {
        const proj = availableProjects.find(p => p.id === selectedProjectId);
        if (proj) {
          companyIdToUse = proj.companyId;
        } else {
          const fetchedProj = await getProjectById(selectedProjectId);
          companyIdToUse = fetchedProj.companyId;
        }
      }

      // 1. Create the task in DB
      const newTask = await createTask({
        projectId: selectedProjectId,
        companyId: companyIdToUse,
        title,
        description,
        priority,
        deadline,
        createdBy: user.uid,
        assignedUserIds: selectedUserIds,
        assignedTeamIds: [], // Not used yet
        requiresEvidence,
        referenceImages: []
      });

      // 2. Upload reference photos if any
      if (photos.length > 0) {
        const photoUrls = await uploadReferenceImages(newTask.id, photos);
        // Update the task with the URLs
        const { updateDoc, doc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        await updateDoc(doc(db, 'tasks', newTask.id), {
          referenceImages: photoUrls
        });
      }

      onTaskCreated();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Error al crear la tarea");
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'var(--bg-color)',
      zIndex: 100,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer', marginRight: 'var(--spacing-md)' }}>
          <X size={28} />
        </button>
        <h2 style={{ margin: 0, flex: 1 }}>Nueva Tarea</h2>
        <button 
          form="taskForm"
          type="submit"
          onClick={() => setWasValidated(true)}
          className="btn" 
          disabled={isSubmitting}
          style={{ width: 'auto', padding: '8px 16px', minHeight: 'auto' }}
        >
          {isSubmitting ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {/* Form Content */}
      <div style={{ padding: 'var(--spacing-md)', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <form id="taskForm" onSubmit={handleSubmit} className={`flex-col ${wasValidated ? 'was-validated' : ''}`}>
          
          {!projectId && (
            <div className="card" style={{ marginBottom: 'var(--spacing-md)', backgroundColor: 'var(--surface-color)' }}>
              <h4 style={{ marginTop: 0, marginBottom: 'var(--spacing-sm)' }}>Ubicación de la tarea</h4>
              
              <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Empresa *</label>
              <div style={{ position: 'relative', marginBottom: 'var(--spacing-sm)' }}>
                <select 
                  className="input" 
                  value={selectedCompanyId}
                  onChange={e => setSelectedCompanyId(e.target.value)}
                  required
                  style={{ appearance: 'none', paddingRight: '32px' }}
                >
                  <option value="">Selecciona una empresa...</option>
                  {availableCompanies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown size={20} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              </div>

              <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Proyecto *</label>
              <div style={{ position: 'relative' }}>
                <select 
                  className="input" 
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  required
                  disabled={!selectedCompanyId}
                  style={{ appearance: 'none', paddingRight: '32px' }}
                >
                  <option value="">{selectedCompanyId ? 'Selecciona un proyecto...' : 'Primero selecciona una empresa'}</option>
                  {filteredProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown size={20} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              </div>
            </div>
          )}

          <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Tarea *</label>
          <input 
            type="text" 
            className="input" 
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título de la tarea"
            required
            autoFocus
          />

          <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Descripción</label>
          <textarea 
            className="input" 
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Detalles de lo que se debe hacer..."
            style={{ minHeight: '100px', resize: 'vertical' }}
          />

          <div className="flex-row" style={{ gap: 'var(--spacing-md)' }}>
            <div className="flex-col" style={{ flex: 1 }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Prioridad *</label>
              <select className="input" value={priority} onChange={(e: any) => setPriority(e.target.value)}>
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
                <option value="Critica">Crítica</option>
              </select>
            </div>
            <div className="flex-col" style={{ flex: 1 }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Fecha Límite *</label>
              <input 
                type="date" 
                className="input" 
                value={deadline}
                min={todayStr}
                onChange={e => setDeadline(e.target.value)}
                required
              />
            </div>
          </div>

          {/* User Assignment */}
          <label style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: 'var(--spacing-sm)' }}>
            Asignar a: (Opcional)
          </label>
          <div style={{ 
            display: 'flex', flexWrap: 'wrap', gap: '8px', padding: 'var(--spacing-sm)', 
            backgroundColor: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border-color)'
          }}>
            {projectMembers.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cargando equipo...</span>}
            {projectMembers.map(member => (
              <div 
                key={member.id}
                onClick={() => toggleUserSelection(member.id)}
                style={{
                  display: 'flex', alignItems: 'center', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer',
                  backgroundColor: selectedUserIds.includes(member.id) ? 'var(--primary-color)' : 'var(--bg-color)',
                  color: selectedUserIds.includes(member.id) ? 'var(--primary-text)' : 'var(--text-color)',
                  border: `1px solid ${selectedUserIds.includes(member.id) ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ marginRight: '6px', fontSize: '1.2rem' }}>{member.emoji || '👤'}</span>
                <span style={{ fontSize: '0.9rem', fontWeight: selectedUserIds.includes(member.id) ? 'bold' : 'normal' }}>
                  {member.displayName || member.email.split('@')[0]}
                </span>
              </div>
            ))}
          </div>

          {/* Requires Evidence Toggle */}
          <div className="flex-row" style={{ marginTop: 'var(--spacing-md)', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--spacing-md)', backgroundColor: 'var(--surface-color)', borderRadius: '8px' }}>
            <div>
              <span style={{ fontWeight: 'bold', display: 'block' }}>Evidencia Fotográfica Obligatoria</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>¿Se requieren fotos de los avances?</span>
            </div>
            <div className="flex-row" style={{ gap: 0, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <button 
                type="button"
                onClick={() => setRequiresEvidence(false)}
                style={{ padding: '8px 16px', border: 'none', backgroundColor: !requiresEvidence ? 'var(--text-color)' : 'transparent', color: !requiresEvidence ? 'var(--bg-color)' : 'var(--text-color)', fontWeight: 'bold' }}
              >
                NO
              </button>
              <button 
                type="button"
                onClick={() => setRequiresEvidence(true)}
                style={{ padding: '8px 16px', border: 'none', backgroundColor: requiresEvidence ? 'var(--danger-color)' : 'transparent', color: requiresEvidence ? 'white' : 'var(--text-color)', fontWeight: 'bold' }}
              >
                SÍ
              </button>
            </div>
          </div>

          {/* Reference Photos */}
          <div style={{ marginTop: 'var(--spacing-md)' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: 'var(--spacing-sm)' }}>
              Fotos de Referencia (Estado inicial, diagrama, etc.)
            </label>
            
            {previews.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: 'var(--spacing-sm)' }}>
                {previews.map((src, i) => (
                  <div key={i} style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '8px', overflow: 'hidden' }}>
                    <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Referencia" />
                    <button 
                      type="button" 
                      onClick={() => removePhoto(i)}
                      style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', padding: '4px', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-row" style={{ gap: 'var(--spacing-sm)' }}>
              <input 
                type="file" 
                accept="image/*" 
                multiple
                capture="environment" 
                onChange={handlePhotosChange} 
                style={{ display: 'none' }} 
                ref={fileInputRef}
              />
              <button type="button" className="btn btn-outline" style={{ flex: 1, display: 'flex', justifyContent: 'center' }} onClick={() => fileInputRef.current?.click()}>
                <Camera size={20} style={{ marginRight: '8px' }}/> Tomar Foto
              </button>
              <button type="button" className="btn btn-outline" style={{ flex: 1, display: 'flex', justifyContent: 'center' }} onClick={() => fileInputRef.current?.click()}>
                <UploadCloud size={20} style={{ marginRight: '8px' }}/> Subir
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

export default TaskForm;
