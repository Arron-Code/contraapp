import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import {
  ClaimsPage, ContactsPage, ContractsPage, DocumentsPage,
  SettingsPage, TasksPage, TeamPage,
} from './pages/ResourcePages';

export function App() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="vertraege" element={<ContractsPage />} />
        <Route path="forderungen" element={<ClaimsPage />} />
        <Route path="kontakte" element={<ContactsPage />} />
        <Route path="aufgaben" element={<TasksPage />} />
        <Route path="dokumente" element={<DocumentsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="einstellungen" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
