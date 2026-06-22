import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { subscribeToTaskUpdates, createTaskUpdate, subscribeToTaskById } from '../services/taskService';
import type { TaskUpdate, Task } from '../services/taskService';
import { getUsersByIds } from '../services/userService';
import type { UserProfile } from '../services/userService';
import { Camera, Send, ArrowLeft, Plus, X, Image as ImageIcon } from 'lucide-react';

interface TaskViewProps {
  user: User;
}

const TaskView = ({ user }: TaskViewProps) => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [currentMaxProgress, setCurrentMaxProgress] = useState(0);

  // New Update State
  const [comment, setComment] = useState('');
  const [progress, setProgress] = useState(0);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasValidated, setWasValidated] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Lightbox State
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);

    let unsubTask = subscribeToTaskById(taskId, (tsk) => {
      setTask(tsk);
      setLoading(false);
    });

    let unsubUpdates = subscribeToTaskUpdates(taskId, async (upds) => {
      setUpdates(upds);
      if (upds.length > 0) {
        setProgress(upds[0].progressReported);
        setCurrentMaxProgress(upds[0].progressReported);
      }
      
      const userIds = Array.from(new Set(upds.map(u => u.userId)));
      if (userIds.length > 0) {
        const profiles = await getUsersByIds(userIds);
        const map: Record<string, UserProfile> = {};
        profiles.forEach(p => map[p.id] = p);
        setUsersMap(prev => ({ ...prev, ...map }));
      }
    });

    return () => {
      unsubTask();
      unsubUpdates();
    };
  }, [taskId]);

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

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !taskId) return;
    
    if (task?.requiresEvidence && photos.length === 0) {
      alert("Esta tarea requiere evidencia fotográfica de manera obligatoria.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createTaskUpdate(taskId, user.uid, comment, progress, photos);
      
      // Reset form
      setComment('');
      setPhotos([]);
      setPreviews([]);
      setShowUpdateModal(false);
      setWasValidated(false);
      // Data is now updated automatically via onSnapshot!
      
    } catch (error) {
      console.error(error);
      alert("Error al subir el avance");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container flex-col" style={{ paddingBottom: 'var(--spacing-xl)' }}>
      {/* Header */}
      <div className="flex-row" style={{ justifyContent: 'space-between', borderBottom: '2px solid var(--border-color)', paddingBottom: 'var(--spacing-sm)' }}>
        <div className="flex-row">
          <button onClick={() => navigate(-1)} className="btn btn-outline" style={{ width: 'auto', minHeight: '40px', padding: '0 10px' }}>
            <ArrowLeft size={20} />
          </button>
          <h2>{task?.title || 'Detalles de Tarea'}</h2>
        </div>
      </div>

      {/* Tarea Original Info */}
      {task && (
        <div className="card" style={{ marginTop: 'var(--spacing-md)', backgroundColor: 'var(--surface-color)' }}>
          <p style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: '0.95rem' }}>{task.description || 'Sin descripción detallada.'}</p>
          
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span><strong>Prioridad:</strong> {task.priority}</span>
            <span><strong>Límite:</strong> {task.deadline}</span>
          </div>

          {task.referenceImages && task.referenceImages.length > 0 && (
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <strong>Imágenes de Referencia:</strong>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginTop: '8px', paddingBottom: '8px' }}>
                {task.referenceImages.map((url, i) => (
                  <div 
                    key={i} 
                    onClick={() => setLightboxImage(url)}
                    style={{ minWidth: '100px', height: '100px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <img src={url} alt={`Referencia ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <h3 style={{ marginTop: 'var(--spacing-lg)' }}>Historial de Avances</h3>

      {/* Updates History */}
      <div className="flex-col" style={{ marginTop: 'var(--spacing-md)' }}>
        {loading ? (
          <p style={{ textAlign: 'center' }}>Cargando historial...</p>
        ) : updates.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aún no hay avances registrados.</p>
        ) : (
          updates.map(update => {
            const author = usersMap[update.userId];
            const allPhotos = update.photoUrls || (update.photoUrl ? [update.photoUrl] : []);

            return (
              <div key={update.id} className="card flex-col" style={{ gap: 'var(--spacing-sm)' }}>
                {/* Header: User and Progress */}
                <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="flex-row" style={{ gap: '8px' }}>
                    <span style={{ fontSize: '1.5rem' }}>{author?.emoji || '👤'}</span>
                    <div className="flex-col" style={{ gap: 0 }}>
                      <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{author?.displayName || 'Usuario'}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {update.createdAt ? new Date(update.createdAt.seconds * 1000).toLocaleString() : 'Recién'}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                    {update.progressReported}%
                  </div>
                </div>

                {/* Comment */}
                <p style={{ margin: '8px 0', fontSize: '0.95rem' }}>{update.comment}</p>
                
                {/* Image Gallery */}
                {allPhotos.length > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    overflowX: 'auto', 
                    paddingBottom: '8px',
                    marginTop: '4px'
                  }}>
                    {allPhotos.map((url, i) => (
                      <div 
                        key={i} 
                        onClick={() => setLightboxImage(url)}
                        style={{ 
                          minWidth: '100px', 
                          height: '100px', 
                          borderRadius: '8px', 
                          overflow: 'hidden', 
                          border: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                      >
                        <img src={url} alt={`Evidencia ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* FAB to open Update Modal */}
      {currentMaxProgress < 100 && (
        <button className="fab" onClick={() => setShowUpdateModal(true)}>
          <Plus size={32} />
        </button>
      )}

      {/* Create Update Modal */}
      {showUpdateModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'var(--bg-color)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
            <button onClick={() => setShowUpdateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer', marginRight: 'var(--spacing-md)' }}>
              <X size={28} />
            </button>
            <h2 style={{ margin: 0, flex: 1 }}>Registrar Avance</h2>
            <button 
              form="updateForm"
              type="submit"
              onClick={() => setWasValidated(true)}
              className="btn" 
              disabled={isSubmitting} 
              style={{ width: 'auto', padding: '8px 16px', minHeight: 'auto' }}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          <div style={{ padding: 'var(--spacing-md)', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <form id="updateForm" onSubmit={handleSubmitUpdate} className={`flex-col ${wasValidated ? 'was-validated' : ''}`}>
              
              <div style={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 'var(--spacing-sm)' }}>
                  Porcentaje de Completado: {progress}%
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="5"
                  value={progress}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val >= currentMaxProgress) {
                      setProgress(val);
                    }
                  }}
                  style={{ width: '100%', height: '40px' }}
                  disabled={isSubmitting}
                />
              </div>

              <label style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: 'var(--spacing-md)' }}>Trabajo realizado *</label>
              <textarea 
                className="input" 
                placeholder="¿Qué se realizó en este avance?" 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{ minHeight: '100px', padding: 'var(--spacing-sm) var(--spacing-md)' }}
                required
                disabled={isSubmitting}
                autoFocus
              />

              <label style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: 'var(--spacing-md)' }}>Evidencias Fotográficas</label>
              
              {/* Image Previews */}
              {previews.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: 'var(--spacing-sm)' }}>
                  {previews.map((src, i) => (
                    <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden' }}>
                      <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" />
                      <button 
                        type="button" 
                        onClick={() => removePhoto(i)}
                        style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', padding: '2px', cursor: 'pointer' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input 
                type="file" 
                accept="image/*" 
                multiple
                capture="environment" 
                style={{ display: 'none' }}
                ref={cameraInputRef}
                onChange={handlePhotosChange}
              />
              <input 
                type="file" 
                accept="image/*" 
                multiple
                style={{ display: 'none' }}
                ref={galleryInputRef}
                onChange={handlePhotosChange}
              />
              
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isSubmitting}
                  style={{ flex: 1 }}
                >
                  <Camera size={20} style={{ marginRight: '8px' }}/> Tomar Foto
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isSubmitting}
                  style={{ flex: 1 }}
                >
                  <ImageIcon size={20} style={{ marginRight: '8px' }}/> Subir Galería
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
            padding: 'var(--spacing-md)'
          }}
        >
          <img 
            src={lightboxImage} 
            alt="Fullscreen evidence" 
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
            onClick={e => e.stopPropagation()} // Prevent click inside image from closing if we wanted to add controls, but it's fine to close on any click for now
          />
          <button 
            onClick={() => setLightboxImage(null)}
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
          >
            <X size={32} />
          </button>
        </div>
      )}

    </div>
  );
};

export default TaskView;
