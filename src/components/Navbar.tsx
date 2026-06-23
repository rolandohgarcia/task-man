import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, X, LogOut, Settings, Globe, Moon, CheckSquare, Building2, User as UserIcon } from 'lucide-react';
import { logoutUser } from '../services/authService';
import { updateUserProfile, getUsersByIds, addFcmTokenToProfile } from '../services/userService';
import type { UserProfile } from '../services/userService';
import { requestNotificationPermission } from '../firebase';
import type { User } from 'firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavbarProps {
  user: User | null;
  toggleTheme: () => void;
  toggleLanguage: () => void;
}

const Navbar = ({ user, toggleTheme, toggleLanguage }: NavbarProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      getUsersByIds([user.uid]).then(users => {
        if (users.length > 0) {
          setProfile(users[0]);
          setEditName(users[0].displayName || '');
          setEditEmoji(users[0].emoji || '👤');
        }
      });
    }
  }, [user]);

  if (!user) return null;

  const handleLogout = async () => {
    await logoutUser();
    setIsOpen(false);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      await updateUserProfile(user.uid, { displayName: editName, emoji: editEmoji });
      setProfile(prev => prev ? { ...prev, displayName: editName, emoji: editEmoji } : null);
      alert("Perfil actualizado");
    } catch (error) {
      console.error(error);
      alert("Error al actualizar perfil");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleEnableNotifications = async () => {
    if (!user) return;
    setNotificationStatus('solicitando');
    try {
      const token = await requestNotificationPermission();
      if (token) {
        await addFcmTokenToProfile(user.uid, token);
        setNotificationStatus('éxito');
        alert('¡Notificaciones habilitadas correctamente!');
      } else {
        setNotificationStatus('denegado');
        alert('No se pudieron habilitar las notificaciones. Verifica los permisos de tu navegador o dispositivo.');
      }
    } catch (err) {
      console.error("Error al habilitar notificaciones:", err);
      setNotificationStatus('error');
      alert('Ocurrió un error al intentar habilitar las notificaciones.');
    }
  };

  const isActive = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: 'var(--spacing-xs) var(--spacing-md)', 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--surface-color)',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}>
        {/* Navigation Buttons */}
        <div className="flex-row" style={{ gap: 'var(--spacing-md)', flex: 1, overflowX: 'auto' }}>
          <button 
            onClick={() => navigate('/')} 
            style={{ 
              background: isActive('/') ? 'var(--text-color)' : 'transparent', 
              color: isActive('/') ? 'var(--bg-color)' : 'var(--text-color)',
              border: 'none',
              padding: '10px', 
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Mis Tareas"
          >
            <CheckSquare size={24} />
          </button>
          
          <button 
            onClick={() => navigate('/companies')} 
            style={{ 
              background: isActive('/companies') ? 'var(--text-color)' : 'transparent', 
              color: isActive('/companies') ? 'var(--bg-color)' : 'var(--text-color)',
              border: 'none',
              padding: '10px', 
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Empresas"
          >
            <Building2 size={24} />
          </button>
        </div>

        {/* Hamburger */}
        <button 
          onClick={() => setIsOpen(true)} 
          className="btn" 
          style={{ width: 'auto', padding: '8px', marginLeft: 'var(--spacing-sm)', minHeight: 'auto', backgroundColor: 'transparent', color: 'var(--text-color)' }}
        >
          <Menu size={28} />
        </button>
      </div>

      {/* Side Drawer Overlay */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 50,
          display: 'flex',
          justifyContent: 'flex-end'
        }} onClick={() => setIsOpen(false)}>
          
          {/* Drawer Panel */}
          <div style={{
            width: '300px',
            height: '100%',
            backgroundColor: 'var(--surface-color)',
            boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
            padding: 'var(--spacing-md)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
              <h2 style={{ margin: 0 }}><Settings size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }}/> Configuración</h2>
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer' }}>
                <X size={28} />
              </button>
            </div>

            {/* User Profile Edit */}
            <div className="card" style={{ padding: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
              <h4 style={{ margin: '0 0 var(--spacing-sm) 0' }}><UserIcon size={18} style={{ verticalAlign: 'middle' }}/> Tu Perfil</h4>
              
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Emoji de Identificación</label>
              <input 
                type="text" 
                className="input" 
                maxLength={2}
                value={editEmoji}
                onChange={(e) => setEditEmoji(e.target.value)}
                style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: 'var(--spacing-sm)' }}
                placeholder="👤"
              />

              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nombre Visible</label>
              <input 
                type="text" 
                className="input" 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ marginBottom: 'var(--spacing-sm)' }}
                placeholder="Tu Nombre"
              />

              <button 
                className="btn" 
                onClick={handleSaveProfile} 
                disabled={isSavingProfile || !editName.trim()}
                style={{ padding: '8px', minHeight: 'auto' }}
              >
                {isSavingProfile ? 'Guardando...' : 'Guardar Perfil'}
              </button>
            </div>

            {/* Notificaciones */}
            <div className="card" style={{ padding: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
              <h4 style={{ margin: '0 0 var(--spacing-sm) 0' }}>Notificaciones</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                Si no recibes alertas, puedes forzar la habilitación de notificaciones en este dispositivo.
              </p>
              <button 
                className="btn btn-outline" 
                onClick={handleEnableNotifications}
                disabled={notificationStatus === 'solicitando'}
                style={{ padding: '8px', minHeight: 'auto', width: '100%' }}
              >
                {notificationStatus === 'solicitando' ? 'Solicitando...' : 'Habilitar Notificaciones'}
              </button>
            </div>

            <div className="flex-col" style={{ gap: 'var(--spacing-md)' }}>
              <button className="btn btn-outline" onClick={toggleTheme}>
                <Moon size={20} style={{ marginRight: '8px' }}/> Cambiar Tema
              </button>
              
              <button className="btn btn-outline" onClick={toggleLanguage}>
                <Globe size={20} style={{ marginRight: '8px' }}/> Idioma ({i18n.language.startsWith('es') ? 'ES' : 'EN'})
              </button>
            </div>

            <div style={{ flex: 1 }}></div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
              <button onClick={handleLogout} className="btn" style={{ backgroundColor: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}>
                <LogOut size={20} style={{ marginRight: '8px' }}/> Cerrar Sesión
              </button>
            </div>
            
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
