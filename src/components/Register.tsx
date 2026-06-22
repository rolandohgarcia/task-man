import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { registerUser } from '../services/authService';
import { UserPlus } from 'lucide-react';

const Register = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 6) {
      setError(t('password_short') || 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    
    try {
      await registerUser(email, password, displayName);
      navigate('/');
    } catch (err: any) {
      console.error("Detalle del error:", err);
      setError(`Error al registrar: ${err.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container flex-col" style={{ justifyContent: 'center', minHeight: '80vh' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{ fontSize: '2.5rem', letterSpacing: '-1px' }}>{t('register')}</h1>
      </div>

      <div className="card">
        
        {error && (
          <div style={{ 
            backgroundColor: 'var(--danger-color)', 
            color: 'white', 
            padding: 'var(--spacing-md)', 
            borderRadius: 'var(--border-radius-sm)',
            marginBottom: 'var(--spacing-md)',
            fontWeight: 'bold'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-col">
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 'bold' }}>
              {t('full_name')}
            </label>
            <input 
              type="text" 
              className="input" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 'bold' }}>
              {t('email')}
            </label>
            <input 
              type="email" 
              className="input" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoCapitalize="none"
              autoComplete="email"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 'bold' }}>
              {t('password')}
            </label>
            <input 
              type="password" 
              className="input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn" disabled={loading} style={{ marginTop: 'var(--spacing-sm)' }}>
            <UserPlus size={24} />
            {loading ? '...' : t('register')}
          </button>
        </form>

        <div style={{ marginTop: 'var(--spacing-xl)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>
            {t('already_have_account')} <br/><br/>
            <Link to="/login" className="btn btn-outline" style={{ textDecoration: 'none' }}>
              {t('login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
