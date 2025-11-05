import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import PainelOperador from './pages/PainelOperador';
import AdminDashboard from './pages/AdminDashboard'; 

function App() {
    return (
        <Router>
            <nav style={{ padding: '10px 20px', backgroundColor: '#333', color: 'white', display: 'flex', gap: '20px' }}>
                <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>Painel da Fila</Link>
                <Link to="/admin" style={{ color: 'white', textDecoration: 'none' }}>Administração</Link>
            </nav>
            <Routes>
                <Route path="/" element={<PainelOperador />} />
                <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
        </Router>
    );
}

export default App;