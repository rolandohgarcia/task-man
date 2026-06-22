import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { requestNotificationPermission } from './firebase';
import { updateUserProfile } from './services/userService';

// Components
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import CompanyView from './components/CompanyView';
import ProjectView from './components/ProjectView';
import TaskView from './components/TaskView';
import GlobalTasksView from './components/GlobalTasksView';
import Navbar from './components/Navbar';



function App() {
  const { i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      // Solicitar permisos de notificación si el usuario inició sesión
      if (currentUser) {
        requestNotificationPermission().then(token => {
          if (token) {
            import('./services/userService').then(({ addFcmTokenToProfile }) => {
              addFcmTokenToProfile(currentUser.uid, token).catch(console.error);
            });
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Theme Toggle Logic
  const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Language Toggle Logic
  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('es') ? 'en' : 'es';
    i18n.changeLanguage(nextLang);
  };

  if (loading) {
    return <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Cargando...</div>;
  }

  return (
    <Router>
      <Navbar user={user} toggleTheme={toggleTheme} toggleLanguage={toggleLanguage} />
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
        <Route path="/" element={user ? <GlobalTasksView user={user} /> : <Navigate to="/login" />} />
        <Route path="/companies" element={user ? <Dashboard user={user} /> : <Navigate to="/login" />} />
        <Route path="/company/:companyId/project/:projectId/task/:taskId" element={user ? <TaskView user={user} /> : <Navigate to="/login" />} />
        <Route path="/company/:companyId/project/:projectId" element={user ? <ProjectView user={user} /> : <Navigate to="/login" />} />
        <Route path="/company/:companyId" element={user ? <CompanyView user={user} /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
