import { useState, useEffect } from 'react';
import { getRecurringTasks, deleteRecurringTask } from '../services/taskService';
import type { RecurringTask } from '../services/taskService';
import { getProjectById } from '../services/projectService';
import type { Project } from '../services/projectService';
import type { User } from 'firebase/auth';
import { Repeat, Trash2, Calendar, Plus } from 'lucide-react';
import RecurringTaskForm from './RecurringTaskForm';

interface RecurringTasksViewProps {
  user: User;
  companyId: string;
  projectId?: string;
}

const RecurringTasksView = ({ user, companyId, projectId }: RecurringTasksViewProps) => {
  const [tasks, setTasks] = useState<RecurringTask[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<string, Project>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const templates = await getRecurringTasks(companyId, projectId);
      
      // Load project names
      const pMap: Record<string, Project> = {};
      const projectIds = [...new Set(templates.map(t => t.projectId))];
      
      await Promise.all(
        projectIds.map(async (pid) => {
          const proj = await getProjectById(pid);
          if (proj) pMap[pid] = proj;
        })
      );
      
      setProjectsMap(pMap);
      setTasks(templates);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la plantilla recurrente "${title}"? Ya no se generarán más tareas automáticamente y no se puede deshacer.`)) {
      await deleteRecurringTask(id);
      loadData();
    }
  };

  const getRecurrenceText = (task: RecurringTask) => {
    if (task.recurrenceType === 'daily_interval') return 'Diaria';
    if (task.recurrenceType === 'weekly') {
      const daysMap = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const days = task.recurrenceConfig?.daysOfWeek?.map((d: number) => daysMap[d]).join(', ');
      return `Semanal: ${days}`;
    }
    if (task.recurrenceType === 'monthly_date') {
      return `Mensual: Día ${task.recurrenceConfig?.dayOfMonth}`;
    }
    return 'Recurrente';
  };

  if (!companyId) {
    return (
      <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
        <p>Selecciona una empresa para ver sus plantillas recurrentes.</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBottom: '100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
        <h2>Tareas Recurrentes</h2>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Cargando plantillas...</p>
      ) : tasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          <Repeat size={48} style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-md)', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-muted)' }}>No hay tareas recurrentes configuradas para esta empresa.</p>
        </div>
      ) : (
        <div className="flex-col">
          {tasks.map(task => (
            <div key={task.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderColor: 'var(--success-color)', borderLeftWidth: '6px', borderLeftColor: 'var(--success-color)' }}>
              <div style={{ flex: 1, paddingRight: 'var(--spacing-md)' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', marginBottom: '4px' }}>{task.title}</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                  {projectsMap[task.projectId]?.name || 'Proyecto Desconocido'}
                </p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', backgroundColor: 'var(--surface-color)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    <Repeat size={14} /> {getRecurrenceText(task)}
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', backgroundColor: 'var(--surface-color)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    <Calendar size={14} /> Próxima vez: {task.nextScheduledDate}
                  </div>
                </div>
                {task.endDate && (
                  <p style={{ margin: 0, marginTop: '8px', fontSize: '0.8rem', color: 'var(--danger-color)' }}>
                    Termina el: {task.endDate}
                  </p>
                )}
              </div>
              
              <button 
                onClick={() => handleDelete(task.id, task.title)}
                style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '8px', backgroundColor: 'rgba(204, 0, 0, 0.1)', borderRadius: '50%' }}
                title="Eliminar plantilla"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* FAB Button */}
      {!showForm && (
        <button className="fab" onClick={() => setShowForm(true)}>
          <Plus size={32} />
        </button>
      )}

      {showForm && (
        <RecurringTaskForm 
          user={user} 
          defaultCompanyId={companyId}
          defaultProjectId={projectId}
          onClose={() => setShowForm(false)} 
          onTaskCreated={loadData}
        />
      )}
    </div>
  );
};

export default RecurringTasksView;
