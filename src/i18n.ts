import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translations
const resources = {
  en: {
    translation: {
      "app_name": "Task-Man",
      "login": "Log In",
      "register": "Register",
      "email": "Email",
      "password": "Password",
      "welcome": "Welcome to Task-Man",
      "dashboard": "Dashboard",
      "projects": "Projects",
      "tasks": "Tasks",
      "full_name": "Full Name",
      "already_have_account": "Already have an account?",
      // We will add more translations here
    }
  },
  es: {
    translation: {
      "app_name": "Task-Man",
      "login": "Iniciar Sesión",
      "register": "Registrarse",
      "email": "Correo Electrónico",
      "password": "Contraseña",
      "welcome": "Bienvenido a Task-Man",
      "dashboard": "Panel de Control",
      "projects": "Proyectos",
      "tasks": "Tareas",
      "full_name": "Nombre Completo",
      "already_have_account": "¿Ya tienes cuenta?",
      // Añadiremos más traducciones aquí
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "es", // Idioma por defecto
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
