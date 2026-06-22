import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loginUser } from '../services/authService';
import { LogIn } from 'lucide-react';

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await loginUser(email, password);
      navigate('/');
    } catch (err: any) {
      setError(t('login_error') || 'Error al iniciar sesión. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container flex-col" style={{ justifyContent: 'center', minHeight: '80vh' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{ fontSize: '3rem', letterSpacing: '-1px' }}>{t('app_name')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Gestión Operativa</p>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 'var(--spacing-lg)', textAlign: 'center' }}>{t('login')}</h2>
        
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
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn" disabled={loading} style={{ marginTop: 'var(--spacing-sm)' }}>
            <LogIn size={24} />
            {loading ? '...' : t('login')}
          </button>
        </form>

        <div style={{ marginTop: 'var(--spacing-xl)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>
            ¿No tienes cuenta? <br/><br/>
            <Link to="/register" className="btn btn-outline" style={{ textDecoration: 'none' }}>
              {t('register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
