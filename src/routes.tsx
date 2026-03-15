import LoginPage from './pages/LoginPage';
import FleetMapPage from './pages/FleetMapPage';
import AnalyticsDashboardPage from './pages/AnalyticsDashboardPage';
import InfrastructurePlannerPage from './pages/InfrastructurePlannerPage';
import TransactionsPage from './pages/TransactionsPage';
import AdminPage from './pages/AdminPage';
import UserSettingsPage from './pages/UserSettingsPage';
import NotFound from './pages/NotFound';
import type { ReactNode } from 'react';

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: 'Login',
    path: '/login',
    element: <LoginPage />,
    visible: false,
  },
  {
    name: 'Fleet Map',
    path: '/',
    element: <FleetMapPage />,
  },
  {
    name: 'Analytics',
    path: '/analytics',
    element: <AnalyticsDashboardPage />,
  },
  {
    name: 'Infrastructure',
    path: '/infrastructure',
    element: <InfrastructurePlannerPage />,
  },
  {
    name: 'Transactions',
    path: '/transactions',
    element: <TransactionsPage />,
  },
  {
    name: 'Settings',
    path: '/settings',
    element: <UserSettingsPage />,
    visible: false,
  },
  {
    name: 'Admin',
    path: '/admin',
    element: <AdminPage />,
    visible: false,
  },
  {
    name: 'Not Found',
    path: '/404',
    element: <NotFound />,
    visible: false,
  },
];

export default routes;
