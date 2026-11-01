import { Routes, Route } from 'react-router-dom';
import { Layout } from './layout';
import { HomePage } from './pages/HomePage';
import { FeedPage } from './pages/FeedPage';
import { RepoDetailPage } from './pages/RepoDetailPage';
import { UploadPage } from './pages/UploadPage';
import { GroupsPage } from './pages/GroupsPage';
import { GroupDetailPage } from './pages/GroupDetailPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { AdminPage } from './pages/AdminPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ConductPage } from './pages/ConductPage';
import { ContributingPage } from './pages/ContributingPage';
import { OrdersPage } from './pages/OrdersPage';
import { WalletPage } from './pages/WalletPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/marketplace" element={<FeedPage />} />
        <Route path="/free" element={<FeedPage zone="free" />} />
        <Route path="/paid" element={<FeedPage zone="paid" />} />
        <Route path="/repos/:id" element={<RepoDetailPage />} />
        <Route path="/checkout/:repoId" element={<CheckoutPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/:id" element={<GroupDetailPage />} />
        <Route path="/users/:username" element={<UserProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/conduct" element={<ConductPage />} />
        <Route path="/contributing" element={<ContributingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
