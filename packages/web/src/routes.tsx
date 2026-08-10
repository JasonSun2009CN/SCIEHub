import { Routes, Route } from 'react-router-dom';
import { Layout } from './layout';
import { HomePage } from './pages/HomePage';
import { FeedPage } from './pages/FeedPage';
import { ResourceDetailPage } from './pages/ResourceDetailPage';
import { UploadPage } from './pages/UploadPage';
import { GroupsPage } from './pages/GroupsPage';
import { GroupDetailPage } from './pages/GroupDetailPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/resources/:id" element={<ResourceDetailPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/:id" element={<GroupDetailPage />} />
        <Route path="/users/:username" element={<UserProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
