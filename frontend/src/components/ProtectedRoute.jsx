import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

export default function ProtectedRoute() {
  const { authenticated } = useAuth()
  const location = useLocation()
  if (!authenticated) {
    return <Navigate to="/login" replace state={{ reason: 'auth', from: location.pathname }} />
  }
  return <Outlet />
}