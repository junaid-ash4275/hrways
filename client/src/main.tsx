import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './pages/App'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Attendance from './pages/Attendance'
import Meetings from './pages/Meetings'
import Payroll from './pages/Payroll'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'
import Admin from './pages/Admin'
import RequireRole from './shared/RequireRole'
import { AuthProvider } from './auth/AuthContext'
import Login from './pages/Login'
import Protected from './shared/Protected'
import ForgotPassword from './pages/ForgotPassword'
import VerifyReset from './pages/VerifyReset'
import ResetPassword from './pages/ResetPassword'

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Protected>
        <App />
      </Protected>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'employees', element: <Employees /> },
      { path: 'attendance', element: <Attendance /> },
      { path: 'meetings', element: <Meetings /> },
      { path: 'payroll', element: <Payroll /> },
      { path: 'settings', element: <Settings /> },
      { path: 'admin', element: (
        <RequireRole role="ADMIN">
          <Admin />
        </RequireRole>
      ) },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/login', element: <Login /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/verify-reset', element: <VerifyReset /> },
  { path: '/reset-password', element: <ResetPassword /> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
)
