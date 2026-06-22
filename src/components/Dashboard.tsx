import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { User } from 'firebase/auth';
import { 
  createCompany, 
  getUserCompanies, 
  acceptInvitation, 
  inviteUserByEmail 
} from '../services/companyService';
import type { Company } from '../services/companyService';
import { Plus, Check, Building2, UserPlus, X } from 'lucide-react';

interface DashboardProps {
  user: User;
}

const Dashboard = ({ user }: DashboardProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [activeCompanies, setActiveCompanies] = useState<Company[]>([]);
  const [pendingCompanies, setPendingCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State for Create Company
  const [newCompanyName, setNewCompanyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // State for Invites
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCompanyId, setInviteCompanyId] = useState<string | null>(null);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const { activeCompanies, pendingCompanies } = await getUserCompanies(user.uid);
      setActiveCompanies(activeCompanies);
      setPendingCompanies(pendingCompanies);
    } catch (error) {
      console.error("Error loading companies", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [user.uid]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    
    setIsCreating(true);
    try {
      await createCompany(newCompanyName, user.uid);
      setNewCompanyName('');
      setShowCreateModal(false);
      await loadCompanies();
    } catch (error) {
      console.error(error);
      alert("Error al crear empresa");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAcceptInvite = async (companyId: string) => {
    try {
      await acceptInvitation(companyId, user.uid);
      await loadCompanies(); // Refresh lists
    } catch (error) {
      console.error(error);
      alert("Error al aceptar invitación");
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteCompanyId) return;

    try {
      await inviteUserByEmail(inviteCompanyId, inviteEmail);
      alert(`Invitación enviada a ${inviteEmail}`);
      setInviteEmail('');
      setInviteCompanyId(null);
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <div className="container flex-col" style={{ paddingBottom: 'var(--spacing-xl)' }}>
      {/* Header */}
      <div className="flex-row" style={{ justifyContent: 'space-between', borderBottom: '2px solid var(--border-color)', paddingBottom: 'var(--spacing-sm)' }}>
        <h2>{t('dashboard')}</h2>
      </div>

      <p>{t('welcome')}, {user.displayName || user.email}</p>

      {/* Pending Invitations Section */}
      {pendingCompanies.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--primary-color)', backgroundColor: 'var(--primary-color)', color: 'var(--primary-text)' }}>
          <h3>Tienes {pendingCompanies.length} Invitación(es)</h3>
          {pendingCompanies.map(company => (
            <div key={company.id} className="flex-row" style={{ marginTop: 'var(--spacing-md)', justifyContent: 'space-between' }}>
              <span>{company.name}</span>
              <button 
                onClick={() => handleAcceptInvite(company.id)}
                className="btn" 
                style={{ width: 'auto', backgroundColor: 'var(--surface-color)', color: 'var(--text-color)', minHeight: '40px' }}
              >
                <Check size={20} /> Aceptar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* FAB Button */}
      <button className="fab" onClick={() => setShowCreateModal(true)}>
        <Plus size={32} />
      </button>

      {/* Create Company Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
              <h3 style={{ margin: 0 }}><Building2 size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }}/> Nueva Empresa</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateCompany} className="flex-col">
              <input 
                type="text" 
                className="input" 
                placeholder="Nombre de la empresa" 
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                disabled={isCreating}
                autoFocus
              />
              <div className="flex-row" style={{ marginTop: 'var(--spacing-md)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn" disabled={isCreating || !newCompanyName}>
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Companies List */}
      <h3>Tus Empresas</h3>
      {loading ? (
        <p>Cargando empresas...</p>
      ) : activeCompanies.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No perteneces a ninguna empresa aún.</p>
      ) : (
        <div className="flex-col">
          {activeCompanies.map(company => (
            <div key={company.id} className="card">
              <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ margin: 0 }}>{company.name}</h3>
                <button 
                  onClick={() => navigate(`/company/${company.id}`)} 
                  className="btn" 
                  style={{ width: 'auto', minHeight: '40px' }}
                >
                  Entrar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
