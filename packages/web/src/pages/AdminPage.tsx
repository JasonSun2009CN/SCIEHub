import { Navigate } from 'react-router-dom';
import { FaShieldAlt } from 'react-icons/fa';
import { PageMeta } from '@/components/common/PageMeta';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { OverviewTab } from '@/components/admin/OverviewTab';
import { ReportsTab } from '@/components/admin/ReportsTab';
import { UsersTab } from '@/components/admin/UsersTab';
import { ReposTab } from '@/components/admin/ReposTab';

export function AdminPage() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace state={{ from: '/admin' }} />;
  if (!user.isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageMeta title="Admin console" />
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-accent">
          <FaShieldAlt className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-3xl">Admin console</h1>
          <p className="text-sm text-muted-foreground">Moderate content, reports and users.</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="repos">Repositories</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="repos">
          <ReposTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
