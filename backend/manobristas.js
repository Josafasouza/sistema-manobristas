const db = require('./db');
let emitirFilaAtualizada = () => {};

const setSocketNotifier = (notifier) => {
    emitirFilaAtualizada = notifier;
};

// --- CRUD Manobristas (Admin) ---
// ... (código getManobristas, cadastrarManobrista, etc. omitido por brevidade)

// Função para deletar um manobrista cadastrado (ID do manobrista)
const deletarManobrista = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM manobristas WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) return res.status(404).json({ error: 'Manobrista não encontrado.' });
        
        // Reorganiza a ordem após a exclusão
        await db.query(`
            UPDATE fila_ativa f1
            SET ordem = (SELECT COUNT(f2.id) + 1 FROM fila_ativa f2 WHERE f2.ordem < f1.ordem AND f2.status_servico = 'espera')
            WHERE f1.status_servico = 'espera'
        `);
        
        emitirFilaAtualizada();
        res.json({ message: 'Manobrista deletado com sucesso.' });
    } catch (err) {
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Manobrista em serviço ou na fila e não pode ser deletado.' });
        }
        res.status(500).json({ error: 'Erro ao deletar manobrista.' });
    }
};

// --- Funções da Fila ---

// ... (código getFila, registrarChegada, chamarProximo, retornoManobrista, moverItemNaFila omitido por brevidade) ...

// Implementação da nova função: Excluir item da fila (ID do item da fila)
const deletarItemDaFila = async (req, res) => {
    const { id } = req.params; 

    try {
        const query = 'DELETE FROM fila_ativa WHERE id = $1 RETURNING *';
        const result = await db.query(query, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Item da fila não encontrado.' });
        }
        
        // Reorganiza a ordem de todos os itens restantes na fila
        await db.query(`
            UPDATE fila_ativa f1
            SET ordem = (SELECT COUNT(f2.id) + 1 FROM fila_ativa f2 WHERE f2.ordem < f1.ordem AND f2.status_servico = 'espera')
            WHERE f1.status_servico = 'espera'
        `);

        // Notifica o frontend
        if (emitirFilaAtualizada) emitirFilaAtualizada();

        res.status(200).json({ message: 'Item removido da fila com sucesso.' });
    } catch (error) {
        console.error('Erro ao deletar item da fila:', error);
        res.status(500).json({ error: 'Erro interno ao deletar item.' });
    }
};

module.exports = {
    setSocketNotifier,
    getManobristas: async (req, res) => { /* Implementação completa aqui */ },
    cadastrarManobrista: async (req, res) => { /* Implementação completa aqui */ },
    editarManobrista: async (req, res) => { /* Implementação completa aqui */ },
    deletarManobrista, // Completo acima
    getFila: async (req, res) => { /* Implementação completa aqui */ },
    registrarChegada: async (req, res) => { /* Implementação completa aqui */ },
    chamarProximo: async (req, res) => { /* Implementação completa aqui */ },
    retornoManobrista: async (req, res) => { /* Implementação completa aqui */ },
    moverItemNaFila: async (req, res) => { /* Implementação completa aqui */ },
    deletarItemDaFila, // NOVO
};