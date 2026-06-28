import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { subscribeToProjectTasks, createTask } from '../services/taskService';
import type { Task } from '../services/taskService';
import { getProjectById, addUserToProject, removeUserFromProject } from '../services/projectService';
import type { Project } from '../services/projectService';
import { getCompanyById } from '../services/companyService';
import { getUsersByIds } from '../services/userService';
import type { UserProfile } from '../services/userService';
import { groupTasksByDate } from '../utils/taskGrouping';
import TaskForm from './TaskForm';
import RecurringTasksView from './RecurringTasksView';
import { ClipboardList, Plus, ArrowLeft, Users, UserPlus, X, Trash2, CalendarDays, AlertTriangle, AlertCircle, ArrowDown, Check, Square } from 'lucide-react';

interface ProjectViewProps {
  user: User;
}

const ProjectView = ({ user }: ProjectViewProps) => {
  const { companyId, projectId } = useParams<{ companyId: string, projectId: string }>();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'tasks' | 'recurring' | 'members'>('tasks');

  // Tasks State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  
  // Project & Members State
  const [project, setProject] = useState<Project | null>(null);
  const [companyMembers, setCompanyMembers] = useState<UserProfile[]>([]);
  const [projectMembers, setProjectMembers] = useState<UserProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Forms State
  const [showTaskModal, setShowTaskModal] = useState(false);
  
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'supervisor' | 'collaborator'>('collaborator');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);

  const loadData = async () => {
    if (!projectId || !companyId) return;
    
    setLoadingTasks(true);
    setLoadingMembers(true);
    try {
      // Tasks are now loaded via onSnapshot in useEffect

      // Load project and members
      const proj = await getProjectById(projectId);
      setProject(proj);
      
      const comp = await getCompanyById(companyId);
      
      // Get profiles for all company members to populate the dropdown
      const allCompanyProfiles = await getUsersByIds(comp.memberIds);
      setCompanyMembers(allCompanyProfiles);

      // Filter to get only profiles of users already in this project
      const projProfiles = allCompanyProfiles.filter(p => proj.memberIds.includes(p.id));
      setProjectMembers(projProfiles);

    } catch (error) {
      console.error("Error loading project data", error);
    } finally {
      setLoadingTasks(false);
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    loadData();
    if (projectId) {
      const unsub = subscribeToProjectTasks(projectId, (newTasks) => {
        setTasks(newTasks);
        setLoadingTasks(false);
      });
      return () => unsub();
    }
  }, [projectId, companyId]);

  const handleTaskCreated = () => {
    setShowTaskModal(false);
    // Tasks will update automatically via subscription
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !projectId) return;

    setIsAddingUser(true);
    try {
      await addUserToProject(projectId, selectedUserId, selectedRole);
      setSelectedUserId('');
      setShowMemberModal(false);
      await loadData(); // Refresh to show new member
    } catch (error) {
      console.error(error);
      alert("Error al añadir usuario al proyecto");
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleRemoveUser = async (userIdToRemove: string) => {
    if (!projectId) return;
    if (!window.confirm('¿Seguro que deseas remover a este usuario del proyecto?')) return;
    
    try {
      await removeUserFromProject(projectId, userIdToRemove);
      await loadData();
    } catch (error) {
      console.error(error);
      alert("Error al remover usuario");
    }
  };

  const getPriorityColor = (prio: string) => {
    switch (prio) {
      case 'Critica': return 'var(--danger-color)';
      case 'Alta': return '#ff8800';
      case 'Media': return '#e6b800';
      case 'Baja': return 'var(--success-color)';
      default: return 'var(--text-color)';
    }
  };

  // To check if current user is admin of the project
  const isAdmin = project?.adminIds.includes(user.uid);

  // Derive usersMap from companyMembers for easy lookup in cards
  const usersMap = companyMembers.reduce((acc, member) => {
    acc[member.id] = member;
    return acc;
  }, {} as Record<string, UserProfile>);

  return (
    <div className="container flex-col" style={{ paddingBottom: 'var(--spacing-xl)' }}>
      <div className="flex-row" style={{ justifyContent: 'space-between', borderBottom: '2px solid var(--border-color)', paddingBottom: 'var(--spacing-sm)' }}>
        <div className="flex-row">
          <button onClick={() => navigate(`/company/${companyId}`)} className="btn btn-outline" style={{ width: 'auto', minHeight: '40px', padding: '0 10px' }}>
            <ArrowLeft size={20} />
          </button>
          <h2>{project ? project.name : 'Proyecto'}</h2>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', backgroundColor: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: '73px', zIndex: 10, overflowX: 'auto' }}>
        <button 
          className="btn" 
          onClick={() => setActiveTab('tasks')}
          style={{ flex: 1, padding: '0 8px', fontSize: '0.85rem', borderRadius: 0, border: 'none', borderBottom: activeTab === 'tasks' ? '3px solid var(--primary-color)' : '3px solid transparent', backgroundColor: 'transparent', color: activeTab === 'tasks' ? 'var(--primary-color)' : 'var(--text-muted)' }}
        >
          <ClipboardList size={18} /> Tareas Activas
        </button>
        <button 
          className="btn" 
          onClick={() => setActiveTab('recurring')}
          style={{ flex: 1, padding: '0 8px', fontSize: '0.85rem', borderRadius: 0, border: 'none', borderBottom: activeTab === 'recurring' ? '3px solid var(--primary-color)' : '3px solid transparent', backgroundColor: 'transparent', color: activeTab === 'recurring' ? 'var(--primary-color)' : 'var(--text-muted)' }}
        >
          <CalendarDays size={18} /> Tareas Recurrentes
        </button>
        <button 
          className="btn" 
          onClick={() => setActiveTab('members')}
          style={{ flex: 1, padding: '0 8px', fontSize: '0.85rem', borderRadius: 0, border: 'none', borderBottom: activeTab === 'members' ? '3px solid var(--primary-color)' : '3px solid transparent', backgroundColor: 'transparent', color: activeTab === 'members' ? 'var(--primary-color)' : 'var(--text-muted)' }}
        >
          <Users size={18} /> Miembros
        </button>
      </div>

      {/* TASKS TAB */}
      {activeTab === 'tasks' && (
        <>
          {/* FAB Button for Tasks */}
          <button className="fab" onClick={() => setShowTaskModal(true)}>
            <Plus size={32} />
          </button>

          {/* Create Task Form Modal */}
          {showTaskModal && (
            <TaskForm 
              user={user} 
              projectId={projectId!} 
              onClose={() => setShowTaskModal(false)} 
              onTaskCreated={handleTaskCreated} 
            />
          )}

          <h3 style={{ marginTop: 'var(--spacing-md)' }}>Listado de Tareas</h3>
          {loadingTasks ? (
            <p>Cargando tareas...</p>
          ) : tasks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No hay tareas en este proyecto.</p>
          ) : (
            <div className="flex-col">
              {groupTasksByDate(tasks).map(group => (
                <div key={group.id} style={{ marginBottom: 0 }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px', 
                    marginTop: 0,
                    marginBottom: 'var(--spacing-md)',
                    marginLeft: 'calc(50% - 47.5vw)',
                    marginRight: 'calc(50% - 47.5vw)',
                    width: '95vw',
                    color: group.id === 'overdue' ? 'var(--danger-color)' : 'var(--text-muted)',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    fontSize: '0.85rem',
                    letterSpacing: '1px'
                  }}>
                    <div style={{ flex: 1, height: '1px', backgroundColor: group.id === 'overdue' ? 'var(--danger-color)' : 'var(--border-color)' }} />
                    <span style={{ whiteSpace: 'nowrap' }}>{group.title} ({group.tasks.length})</span>
                    <div style={{ flex: 1, height: '1px', backgroundColor: group.id === 'overdue' ? 'var(--danger-color)' : 'var(--border-color)' }} />
                  </div>
                  
                  <div className="flex-col">
                    {group.tasks.map(task => {
                      const isOverdue = !task.isComplete && task.deadline && task.deadline < new Date().toISOString().split('T')[0];
                      const borderColor = isOverdue ? 'var(--danger-color)' : 'var(--primary-color)';
                      
                      return (
                        <div key={task.id} className="card flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', borderColor: 'var(--border-color)', borderLeft: `6px solid ${isOverdue ? 'var(--danger-color)' : borderColor}`, backgroundColor: isOverdue ? 'rgba(239, 68, 68, 0.04)' : 'var(--surface-color)' }}>
                          <div className="flex-col" style={{ gap: 'var(--spacing-xs)', flex: 1 }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {task.title}
                              {isOverdue && <span style={{ backgroundColor: 'var(--danger-color)', color: 'white', padding: '2px 6px', borderRadius: '12px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>Atrasada</span>}
                            </h3>
                            <div className="flex-row" style={{ gap: '8px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                              <span style={{ fontWeight: 'bold', color: getPriorityColor(task.priority) }}>
                                Prioridad: {task.priority}
                              </span>
                              <span style={{ color: 'var(--text-muted)' }}>|</span>
                              <span style={{ color: 'var(--text-muted)' }}>Progreso: {task.progress}%</span>
                              
                              {task.deadline && (
                                <>
                                  <span style={{ color: 'var(--text-muted)' }}>|</span>
                                  <span style={{ color: isOverdue ? 'var(--danger-color)' : 'var(--text-muted)', fontWeight: isOverdue ? 'bold' : 'normal' }}>
                                    Límite: {task.deadline}
                                  </span>
                                </>
                              )}
                              
                              {task.createdBy && (
                                <>
                                  <span style={{ color: 'var(--text-muted)' }}>|</span>
                                  <span style={{ color: 'var(--text-muted)' }}>
                                    Por: {usersMap[task.createdBy]?.displayName || 'Desconocido'}
                                  </span>
                                </>
                              )}
                            </div>
                            
                            {task.assignedUserIds && task.assignedUserIds.length > 0 && (
                              <div className="flex-row" style={{ gap: '4px', marginTop: '4px' }}>
                                {task.assignedUserIds.map(uid => {
                                  const member = usersMap[uid];
                                  return (
                                    <div 
                                      key={uid} 
                                      title={member?.displayName || 'Desconocido'} 
                                      style={{ 
                                        width: '20px', height: '20px', borderRadius: '50%', 
                                        backgroundColor: 'var(--border-color)', display: 'flex', 
                                        alignItems: 'center', justifyContent: 'center', 
                                        fontSize: '0.6rem' 
                                      }}
                                    >
                                      {member?.emoji || (member?.displayName ? member.displayName.charAt(0).toUpperCase() : '?')}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
                              <div style={{ height: '100%', width: `${task.progress}%`, backgroundColor: task.progress === 100 ? 'var(--success-color)' : 'var(--primary-color)' }}></div>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={`Prioridad ${task.priority}`}>
                              {task.priority === 'Baja' && <ArrowDown size={22} strokeWidth={2.5} style={{ color: 'var(--primary-color)' }} />}
                              {task.priority === 'Media' && <Square size={22} strokeWidth={2.5} style={{ color: 'var(--success-color)' }} />}
                              {task.priority === 'Alta' && <AlertTriangle size={22} strokeWidth={2.5} style={{ color: 'var(--warning-color, #eab308)' }} />}
                              {task.priority === 'Critica' && <AlertCircle size={22} strokeWidth={2.5} style={{ color: 'var(--danger-color)' }} />}
                            </div>
                            
                            <button 
                              onClick={() => navigate(`/company/${companyId}/project/${projectId}/task/${task.id}`)} 
                              className="btn" 
                              style={{ width: 'auto', minHeight: '40px' }}
                            >
                              Abrir
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'recurring' && companyId && projectId && (
        <div style={{ marginTop: 'var(--spacing-md)' }}>
          <RecurringTasksView user={user} companyId={companyId} projectId={projectId} />
        </div>
      )}

      {/* MEMBERS TAB */}
      {activeTab === 'members' && (
        <div style={{ marginTop: 'var(--spacing-md)' }}>
          {isAdmin && (
            <>
              {/* FAB Button for Adding Member */}
              <button className="fab" onClick={() => setShowMemberModal(true)}>
                <UserPlus size={32} />
              </button>

              {/* Add Member Modal */}
              {showMemberModal && (
                <div className="modal-overlay" onClick={() => setShowMemberModal(false)}>
                  <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                      <h3 style={{ margin: 0 }}><UserPlus size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }}/> Añadir Miembro</h3>
                      <button onClick={() => setShowMemberModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer' }}>
                        <X size={24} />
                      </button>
                    </div>
                    <form onSubmit={handleAddUser} className="flex-col">
                      <select 
                        className="input" 
                        value={selectedUserId} 
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        required
                        autoFocus
                      >
                        <option value="">Selecciona un usuario de la empresa</option>
                        {companyMembers
                          .filter(m => !project?.memberIds.includes(m.id))
                          .map(member => (
                            <option key={member.id} value={member.id}>
                              {member.displayName || member.email}
                            </option>
                        ))}
                      </select>
                      <div className="flex-row" style={{ gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                        <select 
                          className="input" 
                          value={selectedRole} 
                          onChange={(e: any) => setSelectedRole(e.target.value)}
                          style={{ flex: 1 }}
                        >
                          <option value="collaborator">Colaborador</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </div>
                      <div className="flex-row" style={{ marginTop: 'var(--spacing-md)' }}>
                        <button type="button" className="btn btn-outline" onClick={() => setShowMemberModal(false)}>
                          Cancelar
                        </button>
                        <button type="submit" className="btn" disabled={isAddingUser || !selectedUserId}>
                          Añadir
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}

          <h3>Equipo del Proyecto</h3>
          {loadingMembers ? (
            <p>Cargando miembros...</p>
          ) : (
            <div className="flex-col">
              {projectMembers.map(member => {
                let roleLabel = 'Colaborador';
                if (project?.adminIds.includes(member.id)) roleLabel = 'Administrador';
                else if (project?.supervisorIds.includes(member.id)) roleLabel = 'Supervisor';

                return (
                  <div key={member.id} className="card flex-row" style={{ justifyContent: 'space-between', padding: 'var(--spacing-sm) var(--spacing-md)' }}>
                    <div className="flex-col" style={{ gap: '4px' }}>
                      <span>{member.displayName || member.email}</span>
                      <span style={{ width: 'fit-content', fontSize: '0.85rem', padding: '4px 8px', backgroundColor: 'var(--primary-color)', color: 'var(--primary-text)', borderRadius: '12px', fontWeight: 'bold' }}>
                        {roleLabel}
                      </span>
                    </div>
                    {isAdmin && member.id !== user.uid && (
                      <button 
                        onClick={() => handleRemoveUser(member.id)} 
                        className="btn btn-outline" 
                        style={{ width: 'auto', border: 'none', color: 'var(--danger-color)', padding: '8px' }}
                        title="Remover del Proyecto"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default ProjectView;
