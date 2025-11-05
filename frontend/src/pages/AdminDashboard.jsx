import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// 🚨 ALTERAÇÃO CRÍTICA: URL do Render para a API
const API_URL = 'https://manobrista-api.onrender.com/api';

const AdminDashboard = () => {
    const [manobristas, setManobristas] = useState([]);
    const [form, setForm] = useState({ id: null, nome: '', matricula: '', status: 'ativo' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchManobristas = async () => {
        try {
            // Busca todos os manobristas (incluindo inativos para o admin)
            const res = await axios.get(`${API_URL}/manobristas`);
            setManobristas(res.data);
        } catch (e) {
            setError('Erro ao carregar manobristas.');
        }
    };

    useEffect(() => {
        fetchManobristas();
    }, []);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (form.id) {
                // EDIÇÃO (PUT)
                await axios.put(`${API_URL}/manobristas/${form.id}`, { 
                    nome: form.nome, 
                    matricula: form.matricula, 
                    status: form.status 
                });
            } else {
                // CRIAÇÃO (POST)
                await axios.post(`${API_URL}/manobristas`, { nome: form.nome, matricula: form.matricula });
            }
            
            setForm({ id: null, nome: '', matricula: '', status: 'ativo' });
            fetchManobristas();
        } catch (e) {
            setError(e.response?.data?.error || 'Erro ao salvar. Verifique a matrícula.');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (manobrista) => {
        setForm(manobrista);
        window.scrollTo(0, 0); // Volta para o topo para editar
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Tem certeza que deseja DELETAR este manobrista?")) return;
        setLoading(true);
        try {
            await axios.delete(`${API_URL}/manobristas/${id}`);
            fetchManobristas();
        } catch (e) {
            setError(e.response?.data?.error || 'Erro ao deletar. Remova-o da fila/serviço primeiro.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2>🔧 Gerenciamento de Manobristas (Admin)</h2>
            {error && <div style={{ color: 'red', marginBottom: '10px', padding: '10px', border: '1px solid red' }}>{error}</div>}

            {/* FORMULÁRIO DE CADASTRO/EDIÇÃO */}
            <form onSubmit={handleSave} style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '30px' }}>
                <h3>{form.id ? 'Editar Manobrista (ID: ' + form.id + ')' : 'Novo Cadastro'}</h3>
                
                <input 
                    name="nome"
                    value={form.nome}
                    onChange={handleChange}
                    placeholder="Nome Completo"
                    required
                    style={{ marginRight: '10px', padding: '8px', width: '180px' }}
                />
                <input 
                    name="matricula"
                    value={form.matricula}
                    onChange={handleChange}
                    placeholder="Matrícula"
                    required
                    style={{ marginRight: '10px', padding: '8px', width: '100px' }}
                />
                
                {form.id && (
                    <select name="status" value={form.status} onChange={handleChange} style={{ marginRight: '10px', padding: '8px' }}>
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                    </select>
                )}

                <button type="submit" disabled={loading} style={{ padding: '10px', backgroundColor: form.id ? '#ffc107' : '#4CAF50', color: form.id ? 'black' : 'white', border: 'none', cursor: 'pointer' }}>
                    {loading ? 'Processando...' : (form.id ? 'Salvar Edição' : 'Cadastrar')}
                </button>
                {form.id && (
                    <button type="button" onClick={() => setForm({ id: null, nome: '', matricula: '', status: 'ativo' })} style={{ marginLeft: '10px', padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', cursor: 'pointer' }}>
                        Cancelar
                    </button>
                )}
            </form>

            {/* LISTA DE MANOBRISTAS */}
            <h3>Lista de Manobristas (Total: {manobristas.length})</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f2f2f2' }}>
                        <th style={{ border: '1px solid #ddd', padding: '10px' }}>ID</th>
                        <th style={{ border: '1px solid #ddd', padding: '10px' }}>Matrícula</th>
                        <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Nome</th>
                        <th style={{ border: '1px solid #ddd', padding: '10px' }}>Status</th>
                        <th style={{ border: '1px solid #ddd', padding: '10px' }}>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {manobristas.map((m) => (
                        <tr key={m.id}>
                            <td style={{ border: '1px solid #ddd', padding: '10px' }}>{m.id}</td>
                            <td style={{ border: '1px solid #ddd', padding: '10px' }}>{m.matricula}</td>
                            <td style={{ border: '1px solid #ddd', padding: '10px' }}>{m.nome}</td>
                            <td style={{ border: '1px solid #ddd', padding: '10px', color: m.status === 'ativo' ? 'green' : 'red' }}>{m.status.toUpperCase()}</td>
                            <td style={{ border: '1px solid #ddd', padding: '10px' }}>
                                <button onClick={() => handleEdit(m)} style={{ backgroundColor: '#ffc107', color: 'black', border: 'none', padding: '5px 10px', marginRight: '5px', cursor: 'pointer' }}>
                                    Editar
                                </button>
                                <button onClick={() => handleDelete(m.id)} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>
                                    Apagar
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AdminDashboard;