import { LayoutWrapper } from '@components/layoutWrapper';
import { AdminOnlyRoute } from '@auth/AdminOnlyRoute';
import { AuthRedirect } from '@auth/AuthRedirect';
import { ProtectedRoute } from '@auth/ProtectedRoute';
import { Activate } from '@pages/Activate';
import { AdminLogin } from '@pages/admin/AdminLogin';
import { AdminPortal } from '@pages/admin/AdminPortal';
import { Home } from '@pages/Home';
import { Login } from '@pages/Login';
import { NotFound } from '@pages/NotFound';
import { CategoriesPage } from '@pages/categories/CategoriesPage';
import { ExpenseTrackers } from '@pages/ExpenseTrackers';
import { NutritionDailyCheckinPage } from '@pages/nutrition/NutritionDailyCheckinPage';
import { NutritionDashboardPage } from '@pages/nutrition/NutritionDashboardPage';
import { NutritionGoalPlanCreatePage } from '@pages/nutrition/NutritionGoalPlanCreatePage';
import { NutritionGoalPlanPage } from '@pages/nutrition/NutritionGoalPlanPage';
import { NutritionGoalPlanSummaryPage } from '@pages/nutrition/NutritionGoalPlanSummaryPage';
import { NutritionSetupPage } from '@pages/nutrition/NutritionSetupPage';
import { NutritionWeeklyCheckinPage } from '@pages/nutrition/NutritionWeeklyCheckinPage';
import { Profile } from '@pages/Profile';
import { Register } from '@pages/Register';
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
      { index: true, element: <Home /> },
      { path: 'trackers', element: <ExpenseTrackers /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'nutrition/setup', element: <NutritionSetupPage /> },
      { path: 'nutrition/goal-plan/new', element: <NutritionGoalPlanCreatePage /> },
      { path: 'nutrition/goal-plan/:goalPlanId', element: <NutritionGoalPlanSummaryPage /> },
      { path: 'nutrition/goal-plan', element: <NutritionGoalPlanPage /> },
      { path: 'nutrition/dashboard', element: <NutritionDashboardPage /> },
      { path: 'nutrition/daily-checkin', element: <NutritionDailyCheckinPage /> },
      { path: 'nutrition/weekly-checkin', element: <NutritionWeeklyCheckinPage /> },
      { path: 'nutrition', element: <Navigate to="/nutrition/dashboard" replace /> },
      { path: 'importy', element: <Navigate to="/?tab=importy" replace /> },
      { path: 'wallets', element: <Navigate to="/" replace /> },
      { path: 'transactions', element: <Navigate to="/" replace /> },
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