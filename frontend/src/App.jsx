import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import { ToastProvider } from './components/ToastProvider.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { AppShell } from './components/AppShell.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import BugNew from './pages/BugNew.jsx'
import BugDetail from './pages/BugDetail.jsx'
import BugEdit from './pages/BugEdit.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/bugs/new" element={<BugNew />} />
              <Route path="/bugs/:id" element={<BugDetail />} />
              <Route path="/bugs/:id/edit" element={<BugEdit />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}