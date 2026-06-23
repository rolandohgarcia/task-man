import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { getCompanyProjects, createProject } from '../services/projectService';
import type { Project } from '../services/projectService';
import { getCompanyById, inviteUserByEmail, removeUserFromCompany, revokeInvitation } from '../services/companyService';
import type { Company } from '../services/companyService';
import { getUsersByIds } from '../services/userService';
import type { UserProfile } from '../services/userService';
import { Users, FileText, ArrowLeft, Plus, X, UserPlus, Trash2 } from 'lucide-react';

interface CompanyViewProps {
  user: User;
}

const CompanyView = ({ user }: CompanyViewProps) => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'tasks' | 'team'>('tasks');
  
  const [company, setCompany] = useState<Company | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [pendingMembers, setPendingMembers] = useState<UserProfile[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  // State for Create Project
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#D32F2F'); // Default Red
  const [isCreating, setIsCreating] = useState(false);

  const PROJECT_COLORS = [
    '#D32F2F', '#C2185B', '#7B1FA2', '#512DA8', 
    '#303F9F', '#1976D2', '#0288D1', '#0097A7', 
    '#00796B', '#388E3C', '#689F38', '#F57C00', 
    '#E64A19', '#5D4037', '#616161', '#455A64'
  ];

  // State for Invites
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const comp = await getCompanyById(companyId);
      setCompany(comp);

      const projs = await getCompanyProjects(companyId, user.uid);
      setProjects(projs);

      const mems = await getUsersByIds(comp.memberIds || []);
      setMembers(mems);

      const pendingMems = await getUsersByIds(comp.pendingMembers || []);
      setPendingMembers(pendingMems);

    } catch (error) {
      console.error("Error loading company data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId, user.uid]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !user) return;
    setIsCreating(true);
    try {
      await createProject(companyId, newProjectName, user.uid, newProjectColor);
      setNewProjectName('');
      setNewProjectColor('#D32F2F');
      setShowCreateModal(false);
      loadData();
    } catch (error) {
      console.error(error);
      alert("Error al crear proyecto");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !companyId) return;

    setIsInviting(true);
    try {
      await inviteUserByEmail(companyId, inviteEmail);
      alert(`Invitación enviada a ${inviteEmail}.`);
      setInviteEmail('');
      setShowInviteModal(false);
      loadData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (!companyId) return;
    if (window.confirm(`¿Estás seguro de eliminar a ${userName} de la empresa? Perderá acceso a todos los proyectos.`)) {
      try {
        await removeUserFromCompany(companyId, userId);
        loadData();
      } catch (error) {
        console.error(error);
        alert("Error al eliminar usuario");
      }
    }
  };

  const handleRevokeInvite = async (userId: string, userName: string) => {
    if (!companyId) return;
    if (window.confirm(`¿Estás seguro de cancelar la invitación de ${userName}?`)) {
      try {
        await revokeInvitation(companyId, userId);
        loadData();
      } catch (error) {
        console.error(error);
        alert("Error al cancelar invitación");
      }
    }
  };
  
  const isOwnerOrManager = company?.ownerIds.includes(user.uid) || company?.managerIds.includes(user.uid);

  return (
    <div className="container flex-col" style={{ paddingBottom: 'var(--spacing-xl)' }}>
      {/* Header */}
      <div className="flex-row" style={{ justifyContent: 'space-between', borderBottom: '2px solid var(--border-color)', paddingBottom: 'var(--spacing-sm)' }}>
        <div className="flex-row">
          <button onClick={() => navigate(-1)} className="btn btn-outline" style={{ width: 'auto', minHeight: '40px', padding: '0 10px' }}>
            <ArrowLeft size={20} />
          </button>
          <h2>{company ? company.name : 'Empresa'}</h2>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', backgroundColor: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: '73px', zIndex: 10, overflowX: 'auto' }}>
        <button 
          className="btn" 
          onClick={() => setActiveTab('tasks')}
          style={{ flex: 1, padding: '0 8px', fontSize: '0.85rem', borderRadius: 0, border: 'none', borderBottom: activeTab === 'tasks' ? '3px solid var(--primary-color)' : '3px solid transparent', backgroundColor: 'transparent', color: activeTab === 'tasks' ? 'var(--primary-color)' : 'var(--text-muted)' }}
        >
          <FileText size={18} /> Tareas
        </button>
        <button 
          className="btn" 
          onClick={() => setActiveTab('team')}
          style={{ flex: 1, padding: '0 8px', fontSize: '0.85rem', borderRadius: 0, border: 'none', borderBottom: activeTab === 'team' ? '3px solid var(--primary-color)' : '3px solid transparent', backgroundColor: 'transparent', color: activeTab === 'team' ? 'var(--primary-color)' : 'var(--text-muted)' }}
        >
          <Users size={18} /> Equipo
        </button>
      </div>

      {/* TASKS TAB */}
      {activeTab === 'tasks' && (
        <div style={{ marginTop: 'var(--spacing-md)' }}>
          {/* FAB Button */}
          <button className="fab" onClick={() => setShowCreateModal(true)}>
            <Plus size={32} />
          </button>

          {/* Create Project Modal */}
          {showCreateModal && (
            <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                  <h3 style={{ margin: 0 }}>Nuevo Proyecto</h3>
                  <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer' }}>
                    <X size={24} />
                  </button>
                </div>
                <form onSubmit={handleCreateProject} className="flex-col">
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="Nombre del proyecto" 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    disabled={isCreating}
                    autoFocus
                    style={{ marginBottom: 'var(--spacing-md)' }}
                  />
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-sm)' }}>Color de Identificación</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: 'var(--spacing-sm)' }}>
                    {PROJECT_COLORS.map(color => (
                      <div 
                        key={color}
                        onClick={() => setNewProjectColor(color)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: color,
                          cursor: 'pointer',
                          border: newProjectColor === color ? '3px solid var(--text-color)' : '2px solid transparent',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex-row" style={{ marginTop: 'var(--spacing-md)' }}>
                    <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn" disabled={isCreating || !newProjectName}>
                      Crear
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <h3>Tus Proyectos en la Empresa</h3>
          {loading ? (
            <p>Cargando proyectos...</p>
          ) : projects.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No hay proyectos asignados a ti todavía.</p>
          ) : (
            <div className="flex-col">
              {projects.map(project => (
                <div key={project.id} className="card flex-row" style={{ justifyContent: 'space-between' }}>
                  <div className="flex-col" style={{ gap: 0 }}>
                    <h3 style={{ margin: 0 }}>{project.name}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Miembros: {project.memberIds.length}
                    </span>
                  </div>
                  <button 
                    onClick={() => navigate(`/company/${companyId}/project/${project.id}`)} 
                    className="btn" 
                    style={{ width: 'auto', minHeight: '40px' }}
                  >
                    Entrar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TEAM TAB */}
      {activeTab === 'team' && (
        <div style={{ marginTop: 'var(--spacing-md)' }}>
          {isOwnerOrManager && (
            <>
              {/* FAB Button for Invites */}
              <button className="fab" onClick={() => setShowInviteModal(true)}>
                <UserPlus size={32} />
              </button>

              {/* Invite Modal */}
              {showInviteModal && (
                <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
                  <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                      <h3 style={{ margin: 0 }}><UserPlus size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }}/> Invitar Colaborador</h3>
                      <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer' }}>
                        <X size={24} />
                      </button>
                    </div>
                    <form onSubmit={handleSendInvite} className="flex-col">
                      <input 
                        type="email" 
                        className="input" 
                        placeholder="Correo exacto del usuario" 
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                        autoFocus
                      />
                      <div className="flex-row" style={{ marginTop: 'var(--spacing-md)' }}>
                        <button type="button" className="btn btn-outline" onClick={() => setShowInviteModal(false)}>
                          Cancelar
                        </button>
                        <button type="submit" className="btn" disabled={isInviting || !inviteEmail}>
                          Enviar Invitación
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}

          <h3>Miembros de la Empresa</h3>
          {loading ? (
            <p>Cargando miembros...</p>
          ) : (
            <div className="flex-col">
              {members.map(member => {
                let roleLabel = 'Miembro Base';
                if (company?.ownerIds.includes(member.id)) roleLabel = 'Dueño';
                else if (company?.managerIds.includes(member.id)) roleLabel = 'Gerente';

                return (
                  <div key={member.id} className="card flex-row" style={{ justifyContent: 'space-between', padding: 'var(--spacing-sm) var(--spacing-md)' }}>
                    <div className="flex-col" style={{ gap: '4px' }}>
                      <span>{member.displayName || member.email}</span>
                      <span style={{ width: 'fit-content', fontSize: '0.85rem', padding: '4px 8px', backgroundColor: 'var(--primary-color)', color: 'var(--primary-text)', borderRadius: '12px', fontWeight: 'bold' }}>
                        {roleLabel}
                      </span>
                    </div>
                    {isOwnerOrManager && member.id !== user.uid && (
                      <button 
                        onClick={() => handleRemoveUser(member.id, member.displayName || member.email)} 
                        className="btn btn-outline" 
                        style={{ width: 'auto', border: 'none', color: 'var(--danger-color)', padding: '8px' }}
                        title="Remover de la Empresa"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {pendingMembers.length > 0 && (
            <>
              <h3 style={{ marginTop: 'var(--spacing-lg)' }}>Invitaciones Pendientes</h3>
              <div className="flex-col">
                {pendingMembers.map(pm => (
                  <div key={pm.id} className="card flex-row" style={{ justifyContent: 'space-between', padding: 'var(--spacing-sm) var(--spacing-md)' }}>
                    <div className="flex-col" style={{ gap: '4px' }}>
                      <span>{pm.email}</span>
                      <span style={{ width: 'fit-content', fontSize: '0.85rem', padding: '4px 8px', backgroundColor: '#e0e0e0', color: '#333', borderRadius: '12px', fontWeight: 'bold' }}>
                        Pendiente
                      </span>
                    </div>
                    {isOwnerOrManager && (
                      <button 
                        onClick={() => handleRevokeInvite(pm.id, pm.email)} 
                        className="btn btn-outline" 
                        style={{ width: 'auto', border: 'none', color: 'var(--danger-color)', padding: '8px' }}
                        title="Cancelar Invitación"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
};

export default CompanyView;
