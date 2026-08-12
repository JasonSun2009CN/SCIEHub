import { Outlet } from 'react-router-dom';
import { Header } from './components/generated/Header';
import { Footer } from './components/generated/Footer';
import { WelcomeBanner } from './components/common/WelcomeBanner';
import { useAuth } from './context/AuthContext';

export function Layout() {
  const { showWelcome, dismissWelcome } = useAuth();
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {showWelcome && <WelcomeBanner onDismiss={dismissWelcome} />}
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
