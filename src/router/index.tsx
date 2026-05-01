import { LayoutWrapper } from '@components/layoutWrapper';
import { AdminOnlyRoute } from '@auth/AdminOnlyRoute';
import { AuthRedirect } from '@auth/AuthRedirect';
import { ProtectedRoute } from '@auth/ProtectedRoute';
import { Activate } from '@pages/Activate';
import { AdminLogin } from '@pages/admin/AdminLogin';
import { AdminPortal } from '@pages/admin/AdminPortal';
import { Home } from '@pages/Home';
import { Login } from '@pages/Login';
import { ModuleHubPage } from '@pages/ModuleHubPage';
import { NotFound } from '@pages/NotFound';
import { CategoriesPage } from '@pages/categories/CategoriesPage';
import { ExpenseTrackers } from '@pages/ExpenseTrackers';
import { NutritionDailyCheckinPage } from '@pages/nutrition/NutritionDailyCheckinPage';
import { NutritionDashboardPage } from '@pages/nutrition/NutritionDashboardPage';
import { NutritionGoalPlanCreatePage } from '@pages/nutrition/NutritionGoalPlanCreatePage';
import { NutritionGoalPlanPage } from '@pages/nutrition/NutritionGoalPlanPage';
import { NutritionGoalPlanSummaryPage } from '@pages/nutrition/NutritionGoalPlanSummaryPage';
import { NutritionSetupPage } from '@pages/nutrition/NutritionSetupPage';
import { NutritionTargetHistoryPage } from '@pages/nutrition/NutritionTargetHistoryPage';
import { NutritionWeeklyCheckinPage } from '@pages/nutrition/NutritionWeeklyCheckinPage';
import { HabitAgendaPage } from '@pages/habits/HabitAgendaPage';
import { HabitDetailPage } from '@pages/habits/HabitDetailPage';
import { HabitFormPage } from '@pages/habits/HabitFormPage';
import { HabitsListPage } from '@pages/habits/HabitsListPage';
import { HabitsModuleLayout } from '@pages/habits/HabitsModuleLayout';
import { HabitWeekOverviewPage } from '@pages/habits/HabitWeekOverviewPage';
import { Profile } from '@pages/Profile';
import { Register } from '@pages/Register';
import { TransactionsPage } from '@pages/TransactionsPage';
import { createBrowserRouter, Navigate } from 'react-router-dom';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <LayoutWrapper />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/moduly" replace /> },
      { path: 'moduly', element: <ModuleHubPage /> },
      { path: 'prehled', element: <Home /> },
      { path: 'trackers', element: <ExpenseTrackers /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'nutrition/setup', element: <NutritionSetupPage /> },
      { path: 'nutrition/goal-plan/new', element: <NutritionGoalPlanCreatePage /> },
      { path: 'nutrition/goal-plan/:goalPlanId', element: <NutritionGoalPlanSummaryPage /> },
      { path: 'nutrition/goal-plan', element: <NutritionGoalPlanPage /> },
      { path: 'nutrition/dashboard', element: <NutritionDashboardPage /> },
      { path: 'nutrition/daily-checkin', element: <NutritionDailyCheckinPage /> },
      { path: 'nutrition/weekly-checkin', element: <NutritionWeeklyCheckinPage /> },
      { path: 'nutrition/target-history', element: <NutritionTargetHistoryPage /> },
      { path: 'nutrition', element: <Navigate to="/nutrition/dashboard" replace /> },
      {
        path: 'habits',
        element: <HabitsModuleLayout />,
        children: [
          { index: true, element: <Navigate to="agenda" replace /> },
          { path: 'agenda', element: <HabitAgendaPage /> },
          { path: 'week', element: <HabitWeekOverviewPage /> },
          { path: 'list', element: <HabitsListPage /> },
          { path: 'new', element: <HabitFormPage /> },
          { path: ':habitId/edit', element: <HabitFormPage /> },
          { path: ':habitId', element: <HabitDetailPage /> },
        ],
      },
      { path: 'importy', element: <Navigate to="/prehled?tab=importy" replace /> },
      { path: 'exporty', element: <Navigate to="/prehled?tab=exporty" replace /> },
      { path: 'wallets', element: <Navigate to="/prehled" replace /> },
      { path: 'transactions', element: <TransactionsPage /> },
      /** SPA route — must not be `/profile` (conflicts with API `GET /profile` + Vite proxy). */
      { path: 'settings', element: <Profile /> },
      { path: 'profile', element: <Navigate to="/settings" replace /> },
    ],
    errorElement: <NotFound />,
  },
  {
    path: '/login',
    element: (
      <AuthRedirect>
        <Login />
      </AuthRedirect>
    ),
  },
  {
    path: '/register',
    element: (
      <AuthRedirect>
        <Register />
      </AuthRedirect>
    ),
  },
  {
    path: '/activate',
    element: (
      <AuthRedirect>
        <Activate />
      </AuthRedirect>
    ),
  },
  {
    path: '/admin',
    element: <AdminLogin />,
  },
  {
    path: '/admin/portal',
    element: (
      <ProtectedRoute redirectTo="/admin">
        <AdminOnlyRoute>
          <AdminPortal />
        </AdminOnlyRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: (
      <ProtectedRoute>
        <NotFound />
      </ProtectedRoute>
    ),
  },
]);