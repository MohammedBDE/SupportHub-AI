import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import TicketsPage from './pages/TicketsPage.jsx';
import NewTicketPage from './pages/NewTicketPage.jsx';
import TicketDetailPage from './pages/TicketDetailPage.jsx';
import KnowledgeBasePage from './pages/KnowledgeBasePage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route path="/tickets" element={<TicketsPage />} />
                <Route path="/tickets/new" element={<NewTicketPage />} />
                <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
                <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute adminOnly>
                            <DashboardPage />
                        </ProtectedRoute>
                    }
                />
            </Route>

            <Route path="*" element={<Navigate to="/tickets" replace />} />
        </Routes>
    );
}
