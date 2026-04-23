import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import LoginPage from './views/LoginPage';
import { getToken, clearTokens } from './api/client';

const AuthWrapper: React.FC = () => {
  const [isAuthed, setIsAuthed] = useState(() => !!getToken());

  useEffect(() => {
    const handleUnauthorized = () => {
      clearTokens();
      setIsAuthed(false);
    };
    window.addEventListener('kairos:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('kairos:unauthorized', handleUnauthorized);
  }, []);

  if (!isAuthed) {
    return <LoginPage onAuth={() => setIsAuthed(true)} />;
  }

  return <App onLogout={() => { clearTokens(); setIsAuthed(false); }} />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AuthWrapper />
  </BrowserRouter>
);
