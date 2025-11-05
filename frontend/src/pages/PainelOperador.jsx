import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import io from 'socket.io-client';

// 🚨 ALTERADO: Porta 3002
const API_URL = 'http://localhost:3002/api';
const SOCKET_URL = 'http://localhost:3002';
const socket = io(SOCKET_URL);

// --- Componente AlertaVoz ---
const AlertaVoz = React.memo(({ nome }) => {
    useEffect(() => {
        if (nome && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`Próximo Manobrista: ${nome}`);
            utterance.lang = 'pt-BR';
            window.speechSynthesis.speak(utterance);
        }
    }, [nome]);
    return null;
});

function PainelOperador() {
    const [fila, setFila] = useState({ filaAtiva: [], emServico: [] });
    const [manobristas, setManobristas] = useState([]);
    const [manobristaSelecionado, setManobristaSelecionado] = useState('');

    const manobristasAtivos = manobristas.filter(m => m.status === 'ativo');

    const primeiroDaFila = useMemo(() => fila.filaAtiva[0]?.nome || null, [fila.filaAtiva]);

    // 1. Gerenciamento de Dados em Tempo Real (Socket.IO)
    useEffect(() => {
        socket.on('fila_inicial', (data) => setFila(data));
        socket.on('fila_atualizada', (data) => setFila(data));

        return () => {
            socket.off('fila_inicial');
            socket.off('fila_atualizada');
        };
    }, []);

    // 2. Carregar Manobristas Cadastrados
    const fetchManobristas = useCallback(() => {
        axios.get(`${API_URL}/manobristas`).then(res => setManobristas(res.data));
    }, []);

    useEffect(() => {
        fetchManobristas();
    }, [fetchManobristas]);

    // 3. Ações da Fila
    const registrarChegada = useCallback(async () => {
        if (!manobristaSelecionado) return alert('Selecione um manobrista!');
        await axios.post(`${API_URL}/fila/chegada`, { manobristaId: manobristaSelecionado });
        setManobristaSelecionado('');
    }, [manobristaSelecionado]);

    const chamarProximo = useCallback(async () => {
        try {
            await axios.post(`${API_URL}/fila/chamar`);
        } catch (e) {
            alert(e.response?.data?.error || 'Erro ao chamar o próximo.');
        }
    }, []);

    const registrarRetorno = useCallback(async (filaItemId) => {
        try {
            await axios.post(`${API_URL}/fila/retorno`, { filaItemId });
        } catch (e) {
            alert(e.response?.data?.error || 'Erro ao registrar retorno.');
        }
    }, []);

    // 4. Drag and Drop
    const onDragEnd = useCallback(async (result) => {
        const { destination, source, draggableId } = result;
        if (!destination || destination.droppableId !== 'fila' || destination.index === source.index) return;

        // Optimistic update
        const novaFila = Array.from(fila.filaAtiva);
        const [removido] = novaFila.splice(source.index, 1);
        novaFila.splice(destination.index, 0, removido);

        setFila(prev => ({ ...prev, filaAtiva: novaFila }));

        // Envia atualização para o Backend
        try {
            await axios.post(`${API_URL}/fila/mover`, { 
                id: draggableId, 
                novaOrdem: destination.index + 1 
            });
        } catch (e) {
            alert(e.response?.data?.error || 'Erro ao mover item.');
            // Reverte em caso de erro
            setFila(fila); 
        }
    }, [fila]);


    return (
        <div style={{ padding: '20px', display: 'flex', gap: '30px' }}>
            {primeiroDaFila && <AlertaVoz nome={primeiroDaFila} />}
            
            {/* PAINEL DE CHEGADA */}
            <div style={{ flex: 1, border: '1px solid #ccc', padding: '15px' }}>
                <h2>🚗 Registro de Chegada</h2>
                <select 
                    value={manobristaSelecionado} 
                    onChange={(e) => setManobristaSelecionado(e.target.value)}
                    style={{ padding: '8px', marginRight: '10px', width: '200px' }}
                >
                    <option value="">-- Selecione o Manobrista --</option>
                    {manobristasAtivos.map(m => (
                        <option key={m.id} value={m.id}>
                            {m.matricula} - {m.nome}
                        </option>
                    ))}
                </select>
                <button 
                    onClick={registrarChegada} 
                    disabled={!manobristaSelecionado}
                    style={{ padding: '8px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}
                >
                    Registrar Chegada
                </button>
            </div>

            {/* LISTA DE SERVIÇO */}
            <div style={{ flex: 1, border: '1px solid #ccc', padding: '15px' }}>
                <h2>🛠️ Manobristas em Serviço</h2>
                {fila.emServico.map(item => (
                    <div key={item.id} style={{ border: '1px solid #007bff', padding: '10px', margin: '5px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>**{item.nome}** (Mat: {item.id_manobrista})</div>
                        <button 
                            onClick={() => registrarRetorno(item.id)} 
                            style={{ marginLeft: '10px', backgroundColor: '#ffc107', border: 'none', padding: '5px 10px', cursor: 'pointer' }}
                        >
                            Retorno (Fim da Fila)
                        </button>
                    </div>
                ))}
                {!fila.emServico.length && <p>Nenhum manobrista em serviço.</p>}
            </div>

            {/* PAINEL DE FILA (DRAG AND DROP) */}
            <div style={{ flex: 1, border: '1px solid #ccc', padding: '15px' }}>
                <h2>🥇 Fila de Espera (Prioridade)</h2>
                {fila.filaAtiva.length > 0 && (
                     <button 
                        onClick={chamarProximo} 
                        style={{ padding: '10px', marginBottom: '15px', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer', width: '100%' }}
                    >
                        CHAMAR Próximo ({primeiroDaFila || '...'})
                    </button>
                )}
                
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="fila">
                        {(provided) => (
                            <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                            >
                                {fila.filaAtiva.map((item, index) => (
                                    <Draggable key={String(item.id)} draggableId={String(item.id)} index={index}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                                style={{
                                                    padding: '10px',
                                                    margin: '5px 0',
                                                    backgroundColor: snapshot.isDragging ? '#e0f7fa' : (index === 0 ? '#d4edda' : '#f8f9fa'),
                                                    border: index === 0 ? '2px solid #28a745' : '1px solid #ccc',
                                                    cursor: 'grab',
                                                    ...provided.draggableProps.style,
                                                }}
                                            >
                                                **{index + 1}. {item.nome}** (Mat: {item.id_manobrista})
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
                {!fila.filaAtiva.length && <p>A fila de espera está vazia.</p>}
            </div>
        </div>
    );
}

export default PainelOperador;