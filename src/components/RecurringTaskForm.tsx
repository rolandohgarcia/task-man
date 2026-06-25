import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import type { User } from 'firebase/auth';
import { getProjectById, getUserProjects } from '../services/projectService';
import type { Project } from '../services/projectService';
import { getUserCompanies } from '../services/companyService';
import type { Company } from '../services/companyService';
import { getUsersByIds } from '../services/userService';
import type { UserProfile } from '../services/userService';
import { createRecurringTask, calculateNextScheduledDate, createTask, uploadReferenceImages, updateRecurringTask } from '../services/taskService';
import type { RecurrenceType, RecurrenceConfig } from '../services/taskService';
import { format, addDays, startOfDay } from 'date-fns';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

import type { RecurringTask } from '../services/taskService';

interface RecurringTaskFormProps {
  user: User;
  defaultProjectId?: string;
  defaultCompanyId?: string;
  editTask?: RecurringTask;
  onClose: () => void;
  onTaskCreated: () => void;
}

const RecurringTaskForm = ({ user, defaultProjectId, defaultCompanyId, editTask, onClose, onTaskCreated }: RecurringTaskFormProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(editTask?.projectId || defaultProjectId || '');
  
  // Global creation support
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(editTask?.companyId || defaultCompanyId || '');
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  
  const [title, setTitle] = useState(editTask?.title || '');
  const [description, setDescription] = useState(editTask?.description || '');
  const [priority, setPriority] = useState<'Baja' | 'Media' | 'Alta' | 'Urgente'>(editTask?.priority || 'Media');
  const [durationDays, setDurationDays] = useState(editTask?.durationDays !== undefined ? editTask.durationDays : 1);
  const [endDate, setEndDate] = useState(editTask?.endDate || '');
  
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>(editTask?.assignedUserIds || []);
  const [requiresEvidence, setRequiresEvidence] = useState(editTask?.requiresEvidence || false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>(editTask?.referenceImages || []);

  // Recurrence state
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(editTask?.recurrenceType || 'daily_interval');
  const [interval, setIntervalVal] = useState(editTask?.recurrenceConfig?.interval || 1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(editTask?.recurrenceConfig?.daysOfWeek || [1]);
  const [dayOfMonth, setDayOfMonth] = useState(editTask?.recurrenceConfig?.dayOfMonth || 1);
  const [targetDate, setTargetDate] = useState(editTask?.recurrenceConfig?.targetDate || '');
  const [weekOfMonth, setWeekOfMonth] = useState(editTask?.recurrenceConfig?.weekOfMonth || 1);
  const [dayOfWeek, setDayOfWeek] = useState(editTask?.recurrenceConfig?.dayOfWeek || 1);
  // No se puede extraer startDate fácilmente de la fórmula inversa, así que se deja en blanco en modo edición
  const [startDate, setStartDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasValidated, setWasValidated] = useState(false);
  
  // Member selection
  const [projectMembers, setProjectMembers] = useState<UserProfile[]>([]);
  const [showMemberSelect, setShowMemberSelect] = useState(false);
  
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    // Load available companies and projects if opened globally
    const loadGlobalData = async () => {
      if (!defaultProjectId) {
        const [companiesData, projectsData] = await Promise.all([
          getUserCompanies(user.uid),
          getUserProjects(user.uid)
        ]);
        setAvailableCompanies(companiesData.activeCompanies);
        setAvailableProjects(projectsData);
      } else {
        try {
          const proj = await getProjectById(defaultProjectId);
          if (proj) setProjects([proj]);
        } catch (err) {
          console.error("Error fetching project", err);
        }
      }
    };
    loadGlobalData();
  }, [defaultProjectId, user.uid]);

  // Filter projects when company is selected
  useEffect(() => {
    if (!defaultProjectId) {
      if (selectedCompanyId) {
        setFilteredProjects(availableProjects.filter(p => p.companyId === selectedCompanyId));
      } else {
        setFilteredProjects([]);
      }
    }
  }, [selectedCompanyId, availableProjects, defaultProjectId]);

  useEffect(() => {
    const loadMembers = async () => {
      if (!projectId) {
        setProjectMembers([]);
        return;
      }
      const proj = (projects.length > 0 ? projects : availableProjects).find(p => p.id === projectId);
      if (proj) {
        const members = await getUsersByIds(proj.memberIds);
        setProjectMembers(members);
      }
    };
    loadMembers();
  }, [projectId, projects, availableProjects]);

  const toggleDayOfWeek = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter(d => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day]);
    }
  };

  const getRecurrenceConfig = (): RecurrenceConfig => {
    switch (recurrenceType) {
      case 'daily_interval': return { interval };
      case 'monthly_interval': return { interval };
      case 'weekly': return { daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : [1] };
      case 'monthly_date': return { dayOfMonth };
      case 'yearly_date': return { targetDate: targetDate || todayStr };
      case 'monthly_specific_day': return { weekOfMonth, dayOfWeek };
      default: return {};
    }
  };

  const getFirstScheduledDate = () => {
    if (recurrenceType === 'daily_interval' || recurrenceType === 'monthly_interval') {
      return startDate || todayStr;
    }
    return calculateNextScheduledDate(recurrenceType, getRecurrenceConfig(), startDate || undefined, true);
  };

  const nextDatePreview1 = getFirstScheduledDate();
  const nextDatePreview2 = calculateNextScheduledDate(recurrenceType, getRecurrenceConfig(), nextDatePreview1);
  const nextDatePreview3 = calculateNextScheduledDate(recurrenceType, getRecurrenceConfig(), nextDatePreview2);

  const renderPreview = (dateStr: string) => {
    if (endDate && dateStr > endDate) return <span style={{ color: 'var(--danger-color)', fontStyle: 'italic' }}>Cancelada (Excede fecha límite)</span>;
    const deadlineDate = addDays(new Date(dateStr + 'T00:00:00'), isNaN(durationDays) ? 0 : durationDays);
    const deadlineStr = format(deadlineDate, 'yyyy-MM-dd');
    return (
      <span>
        {dateStr} <span style={{ opacity: 0.7, fontSize: '0.75rem', marginLeft: '4px' }}>| Límite: {deadlineStr}</span>
      </span>
    );
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setPhotos(prev => [...prev, ...selectedFiles]);
      
      const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWasValidated(true);
    const form = e.currentTarget as HTMLFormElement;
    if (!form.checkValidity()) return;
    if (!projectId) return;

    setIsSubmitting(true);
    try {
      let finalCompanyId = defaultCompanyId || selectedCompanyId;
      if (!finalCompanyId) {
        const proj = (projects.length > 0 ? projects : availableProjects).find(p => p.id === projectId);
        if (!proj) throw new Error('Project not found');
        finalCompanyId = proj.companyId;
      }

      const config = getRecurrenceConfig();
      
      if (editTask) {
        // Lógica de Edición
        const nextDate = calculateNextScheduledDate(recurrenceType, config, todayStr);
        await updateRecurringTask(editTask.id, {
          projectId,
          companyId: finalCompanyId,
          title,
          description,
          priority,
          durationDays,
          assignedUserIds,
          requiresEvidence,
          recurrenceType,
          recurrenceConfig: config,
          endDate: endDate || null,
          nextScheduledDate: nextDate
        } as any);

        if (photos && photos.length > 0) {
          const photoUrls = await uploadReferenceImages(editTask.id, photos);
          await updateDoc(doc(db, 'recurring_tasks', editTask.id), { 
            referenceImages: [...previews, ...photoUrls] 
          });
        }
      } else {
        // Lógica de Creación Original
        const firstScheduledDate = getFirstScheduledDate();
        
        let nextScheduledDate = firstScheduledDate;
        let immediateTaskCreated = false;
        
        // Si la fecha programada es hoy o ya pasó, adelantamos la plantilla
        if (firstScheduledDate <= todayStr) {
          nextScheduledDate = calculateNextScheduledDate(recurrenceType, config, firstScheduledDate);
          immediateTaskCreated = true;
        }

        // 1. Guardamos la plantilla PRIMERO
        const recurringTask = await createRecurringTask({
          projectId,
          companyId: finalCompanyId,
          title,
          description,
          priority,
          durationDays,
          assignedUserIds,
          requiresEvidence,
          recurrenceType,
          recurrenceConfig: config,
          nextScheduledDate,
          endDate: endDate || null,
          isActive: true
        } as any);

        // 2. Subimos las fotos UNA SOLA VEZ y las atamos al ID de la plantilla
        let photoUrls: string[] = [];
        if (photos && photos.length > 0) {
          photoUrls = await uploadReferenceImages(recurringTask.id, photos);
          await updateDoc(doc(db, 'recurring_tasks', recurringTask.id), { referenceImages: photoUrls });
        }

        // 3. Creamos la tarea INMEDIATA (si aplica) reusando exactamente las mismas URLs
        if (immediateTaskCreated) {
          const taskDeadline = format(addDays(startOfDay(new Date()), durationDays), 'yyyy-MM-dd');
          
          await createTask({
            projectId,
            companyId: finalCompanyId,
            title,
            description,
            priority,
            deadline: taskDeadline,
            requiresEvidence,
            assignedUserIds,
            referenceImages: photoUrls,
            progress: 0,
            isComplete: false,
            isRecurring: true, 
            createdBy: user.uid,
            createdAt: new Date() as any,
            updatedAt: new Date() as any
          } as any);
        }
      }

      onTaskCreated();
      onClose();
    } catch (error) {
      console.error(error);
      alert('Error al crear tarea recurrente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dayNames = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', maxWidth: 'none', maxHeight: 'none', borderRadius: 0 }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer', marginRight: 'var(--spacing-md)' }}>
            <X size={28} />
          </button>
          <h2 style={{ margin: 0, flex: 1 }}>{editTask ? 'Editar Tarea Recurrente' : 'Crear Tarea Recurrente'}</h2>
          <button 
            form="recurringTaskForm" type="submit" onClick={() => setWasValidated(true)}
            className="btn" disabled={isSubmitting} style={{ width: 'auto', padding: '8px 16px', minHeight: 'auto', backgroundColor: 'var(--primary-color)' }}
          >
            {isSubmitting ? 'Guardando...' : editTask ? 'Guardar Cambios' : 'Crear Tarea'}
          </button>
        </div>

        <div style={{ padding: 'var(--spacing-md)', maxWidth: '800px', margin: '0 auto', width: '100%', overflowY: 'auto', flex: 1, paddingBottom: '100px' }}>
          
          <form id="recurringTaskForm" onSubmit={handleSubmit} className={`flex-col ${wasValidated ? 'was-validated' : ''}`}>
            
            {/* Proyecto y Tarea Info */}
            <div className="card" style={{ marginBottom: 'var(--spacing-md)', backgroundColor: 'var(--surface-color)' }}>
              {!defaultProjectId && (
                <>
                  <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Empresa*</label>
                  <select className="input" value={selectedCompanyId} onChange={e => { setSelectedCompanyId(e.target.value); setProjectId(''); setAssignedUserIds([]); }} required>
                    <option value="">Selecciona una empresa</option>
                    {availableCompanies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  {selectedCompanyId && (
                    <>
                      <label style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: 'var(--spacing-md)' }}>Proyecto*</label>
                      <select className="input" value={projectId} onChange={e => { setProjectId(e.target.value); setAssignedUserIds([]); }} required>
                        <option value="">Selecciona un proyecto</option>
                        {filteredProjects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </>
                  )}
                </>
              )}

              <label style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: defaultProjectId ? 0 : 'var(--spacing-md)' }}>Título de la Tarea*</label>
              <input type="text" className="input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Ej: Reporte Mensual de Ventas" />

              <label style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: 'var(--spacing-md)' }}>Instrucciones (Opcional)</label>
              <textarea className="input" value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Pasos detallados..." />
            </div>

            {/* Configuración de Recurrencia */}
            <div className="card" style={{ marginBottom: 'var(--spacing-md)', borderLeft: '4px solid var(--primary-color)' }}>
              <h3 style={{ marginTop: 0, marginBottom: 'var(--spacing-md)' }}>Patrón de Repetición</h3>
              
              <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Tipo Recurrencia*</label>
              <select className="input" value={recurrenceType} onChange={(e: any) => setRecurrenceType(e.target.value)} required>
                <option value="daily_interval">Diaria (Por Intervalo)</option>
                <option value="weekly">Semanal (Días específicos)</option>
                <option value="monthly_date">Mensual (Día exacto)</option>
                <option value="monthly_specific_day">Día Mes Específico (Ej. Tercer Jueves)</option>
                <option value="monthly_interval">Por Meses (Intervalo mensual)</option>
                <option value="yearly_date">Anual (Fecha exacta)</option>
              </select>

              <div style={{ marginTop: 'var(--spacing-md)', padding: 'var(--spacing-md)', backgroundColor: 'var(--background-color)', borderRadius: 'var(--border-radius-sm)' }}>
                {recurrenceType === 'daily_interval' && (
                  <>
                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Repetir cada (Días)*</label>
                    <input type="number" min="1" className="input" value={interval} onChange={e => setIntervalVal(parseInt(e.target.value))} required />
                  </>
                )}
                
                {recurrenceType === 'monthly_interval' && (
                  <>
                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Repetir cada (Meses)*</label>
                    <input type="number" min="1" className="input" value={interval} onChange={e => setIntervalVal(parseInt(e.target.value))} required />
                  </>
                )}

                {recurrenceType === 'weekly' && (
                  <>
                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Días de la semana*</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {[1, 2, 3, 4, 5, 6, 0].map(day => ( // L, M, M, J, V, S, D
                        <button
                          key={day} type="button"
                          onClick={() => toggleDayOfWeek(day)}
                          style={{
                            width: '40px', height: '40px', borderRadius: '50%', border: 'none',
                            backgroundColor: daysOfWeek.includes(day) ? 'var(--primary-color)' : 'var(--surface-color)',
                            color: daysOfWeek.includes(day) ? 'white' : 'var(--text-color)',
                            fontWeight: 'bold', cursor: 'pointer'
                          }}
                        >
                          {dayNames[day]}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {recurrenceType === 'monthly_date' && (
                  <>
                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>¿Qué día del mes? (1-31)*</label>
                    <input type="number" min="1" max="31" className="input" value={dayOfMonth} onChange={e => setDayOfMonth(parseInt(e.target.value))} required />
                  </>
                )}

                {recurrenceType === 'yearly_date' && (
                  <>
                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Fecha Anual*</label>
                    <input type="date" className="input" value={targetDate} onChange={e => setTargetDate(e.target.value)} required />
                  </>
                )}

                {recurrenceType === 'monthly_specific_day' && (
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Semana*</label>
                      <select className="input" value={weekOfMonth} onChange={e => setWeekOfMonth(parseInt(e.target.value))} required>
                        <option value="1">Primera</option>
                        <option value="2">Segunda</option>
                        <option value="3">Tercera</option>
                        <option value="4">Cuarta</option>
                        <option value="-1">Última</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Día*</label>
                      <select className="input" value={dayOfWeek} onChange={e => setDayOfWeek(parseInt(e.target.value))} required>
                        <option value="1">Lunes</option>
                        <option value="2">Martes</option>
                        <option value="3">Miércoles</option>
                        <option value="4">Jueves</option>
                        <option value="5">Viernes</option>
                        <option value="6">Sábado</option>
                        <option value="0">Domingo</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 'var(--spacing-md)' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Fecha de Inicio de Recurrencia (Opcional)</label>
                <p style={{ margin: 0, marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Puedes elegir una fecha base a partir de la cual el sistema empezará a contar para generar las tareas. Si se deja vacío, se cuenta a partir de hoy.
                </p>
                <input type="date" className="input" value={startDate} min={todayStr} onChange={e => setStartDate(e.target.value)} style={{ marginTop: '8px', marginBottom: '12px' }} />
                
                <div style={{ padding: '12px', backgroundColor: 'var(--background-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-color)' }}>Previsualización de la agenda:</p>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <li><strong style={{ color: 'var(--success-color)' }}>1ª Ejecución:</strong> {renderPreview(nextDatePreview1)}</li>
                    <li><strong>2ª Ejecución:</strong> {renderPreview(nextDatePreview2)}</li>
                    <li><strong>3ª Ejecución:</strong> {renderPreview(nextDatePreview3)}</li>
                  </ul>
                </div>
              </div>

              <hr style={{ margin: 'var(--spacing-md) 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />

              <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Tiempo para completar (Días)*</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Se sumará a la fecha de creación para calcular la Fecha Límite.</p>
              <input type="number" min="0" className="input" value={durationDays} onChange={e => setDurationDays(parseInt(e.target.value))} required />

              <label style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: 'var(--spacing-md)' }}>Fecha de Terminación (Opcional)</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Si se deja vacío, la tarea se repetirá indefinidamente hasta que se borre.</p>
              <input type="date" className="input" value={endDate} min={todayStr} onChange={e => setEndDate(e.target.value)} />
            </div>

            {/* Asignación y Prioridad */}
            <div className="card" style={{ marginBottom: 'var(--spacing-md)', backgroundColor: 'var(--surface-color)' }}>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Prioridad*</label>
                  <select className="input" value={priority} onChange={(e: any) => setPriority(e.target.value)} required>
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 'var(--spacing-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 'bold', margin: 0 }}>Usuarios Asignados</label>
                  {projectId && (
                    <button type="button" onClick={() => setShowMemberSelect(!showMemberSelect)} className="btn btn-outline" style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', minHeight: 'auto' }}>
                      {showMemberSelect ? 'Cerrar Lista' : 'Elegir Usuarios'}
                    </button>
                  )}
                </div>
                
                {showMemberSelect && projectMembers.length > 0 && (
                  <div style={{ backgroundColor: 'var(--background-color)', padding: 'var(--spacing-sm)', borderRadius: 'var(--border-radius-sm)', marginBottom: 'var(--spacing-sm)', maxHeight: '200px', overflowY: 'auto' }}>
                    {projectMembers.map(member => (
                      <label key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}>
                        <input 
                          type="checkbox" 
                          checked={assignedUserIds.includes(member.id)}
                          onChange={(e) => {
                            if (e.target.checked) setAssignedUserIds([...assignedUserIds, member.id]);
                            else setAssignedUserIds(assignedUserIds.filter(id => id !== member.id));
                          }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.2rem' }}>{member.emoji || '👤'}</span>
                          <span>{member.displayName || member.email}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                
                {assignedUserIds.length > 0 ? (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {assignedUserIds.map(id => {
                      const u = projectMembers.find(m => m.id === id);
                      return (
                        <span key={id} style={{ fontSize: '0.8rem', backgroundColor: 'var(--primary-color)', color: 'white', padding: '2px 8px', borderRadius: '12px' }}>
                          {u?.displayName || 'Usuario'}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Cualquier miembro del proyecto podrá completarla si no asignas a nadie.</p>
                )}
              </div>
            </div>

            {/* Evidencia y Fotos */}
            <div className="card" style={{ marginBottom: 'var(--spacing-md)', backgroundColor: 'var(--surface-color)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                <input type="checkbox" checked={requiresEvidence} onChange={e => setRequiresEvidence(e.target.checked)} />
                Forzar foto de evidencia al completar
              </label>

              <div style={{ marginTop: 'var(--spacing-md)' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: 'var(--spacing-sm)' }}>Fotos de Referencia (Ejemplo visual)</label>
                {previews.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: 'var(--spacing-sm)' }}>
                    {previews.map((src, i) => (
                      <div key={i} style={{ position: 'relative', width: '80px', height: '80px' }}>
                        <img src={src} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--border-radius-sm)' }} />
                        <button type="button" onClick={() => removePhoto(i)} style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--danger-color)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="btn btn-outline" style={{ display: 'inline-flex', width: 'auto', padding: '8px 16px', minHeight: 'auto', cursor: 'pointer' }}>
                  <input type="file" multiple accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                  + Agregar Fotos
                </label>
              </div>
            </div>
            
          </form>
        </div>
      </div>
    </div>
  );
};

export default RecurringTaskForm;
