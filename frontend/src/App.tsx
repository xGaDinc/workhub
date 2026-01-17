import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Auth from './Auth';
import ProjectList from './ProjectList';
import Board from './Board';
import { User, Project } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const savedProjectId = localStorage.getItem('currentProjectId');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userData: User, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('token', userToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setCurrentProject(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentProjectId');
  };

  const handleSelectProject = (project: Project) => {
    setCurrentProject(project);
    localStorage.setItem('currentProjectId', project.id.toString());
  };

  const handleBackToProjects = () => {
    setCurrentProject(null);
    localStorage.removeItem('currentProjectId');
  };

  if (!user || !token) {
    return (
      <>
        <Toaster position="top-right" />
        <Auth onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      {currentProject ? (
        <Board 
          user={user} 
          project={currentProject}
          onLogout={handleLogout}
          onBack={handleBackToProjects}
        />
      ) : (
        <ProjectList 
          user={user}
          onLogout={handleLogout}
          onSelectProject={handleSelectProject}
        />
      )}
    </>
  );
}

export default App;
