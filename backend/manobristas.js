const db = require('./db');
let emitirFilaAtualizada = () => {};

const setSocketNotifier = (notifier) => {
    emitirFilaAtualizada = notifier;
};

// --- CRUD Manobristas (Admin) ---

const getManobristas = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM manobristas ORDER BY nome');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar manobristas.' });
    }
};

const cadastrarManobrista = async (req, res) => {
    const { nome, matricula } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO manobristas (nome, matricula) VALUES ($1, $2) RETURNING *',
            [nome, matricula]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
             return res.status(400).json({ error: 'Matrícula já cadastrada.' });
        }
        res.status(500).json({ error: 'Erro ao cadastrar manobrista.' });
    }
};

const editarManobrista = async (req, res) => {
    const { id } = req.params;
    const { nome, matricula, status } = req.body;

    let query = 'UPDATE manobristas SET ';
    const params = [];
    
    if (nome) { params.push(nome); query += `nome = $${params.length}, `; }
    if (matricula) { params.push(matricula); query += `matricula = $${params.length}, `; }
    if (status) { params.push(status); query += `status = $${params.length}, `; }

    query = query.slice(0, -2);
    params.push(id);
    query += ` WHERE id = $${params.length} RETURNING *`;

    try {
        const result = await db.query(query, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Manobrista não encontrado.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao editar manobrista.' });
    }
};

const deletarManobrista = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM manobristas WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) return res.status(404).json({ error: 'Manobrista não encontrado.' });
        
        // CORREÇÃO APLICADA: Usando crases para string de query
        await db.query(`
            UPDATE fila_ativa f1
            SET ordem = (SELECT COUNT(f2.id) + 1 FROM fila_ativa f2 WHERE f2.ordem < f1.ordem AND f2.status_servico = 'espera')
            WHERE f1.status_servico = 'espera'
        `);
        
        emitirFilaAtualizada(); // Notifica o frontend

        res.json({ message: 'Manobrista deletado com sucesso.' });
    } catch (err) {
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Manobrista em serviço ou na fila e não pode ser deletado.' });
        }
        res.status(500).json({ error: 'Erro ao deletar manobrista.' });
    }
};

// --- Funções da Fila ---

const getFila = async (req, res) => {
    try {
        const filaAtivaResult = await db.query(
            'SELECT * FROM fila_ativa WHERE status_servico = $1 ORDER BY ordem',
            ['espera']
        );
        const emServicoResult = await db.query(
            'SELECT * FROM fila_ativa WHERE status_servico = $1',
            ['em_servico']
        );
        
        const result = { filaAtiva: filaAtivaResult.rows, emServico: emServicoResult.rows };

        if (res) {
            return res.json(result);
        }
        return result;
    } catch (err) {
        console.error("Erro ao buscar fila:", err);
        if (res) { return res.status(500).json({ error: 'Erro ao buscar fila.' }); }
        return { filaAtiva: [], emServico: [] };
    }
};

const registrarChegada = async (req, res) => {
    const { manobristaId } = req.body;
    
    const manobristaResult = await db.query(
        'SELECT nome FROM manobristas WHERE id = $1 AND status = $2', 
        [manobristaId, 'ativo']
    );
    if (manobristaResult.rows.length === 0) {
        return res.status(400).json({ error: 'Manobrista não encontrado ou inativo.' });
    }
    const nomeManobrista = manobristaResult.rows[0].nome;

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        const maxOrdemResult = await client.query(
            'SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima_ordem FROM fila_ativa WHERE status_servico = $1',
            ['espera']
        );
        const novaOrdem = maxOrdemResult.rows[0].proxima_ordem;

        const insertResult = await client.query(
            'INSERT INTO fila_ativa (id_manobrista, nome, ordem, status_servico, timestamp_chegada) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
            [manobristaId, nomeManobrista, novaOrdem, 'espera']
        );

        await client.query('COMMIT');
        
        emitirFilaAtualizada();
        return res.status(201).json(insertResult.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Erro ao registrar chegada:", err);
        return res.status(500).json({ error: 'Erro no servidor ao registrar chegada.' });
    } finally {
        client.release();
    }
};

const chamarProximo = async (req, res) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        const proximoResult = await client.query(
            'SELECT id FROM fila_ativa WHERE status_servico = $1 ORDER BY ordem ASC LIMIT 1',
            ['espera']
        );

        if (proximoResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Fila vazia.' });
        }
        const filaItemId = proximoResult.rows[0].id;

        const updateResult = await client.query(
            'UPDATE fila_ativa SET status_servico = $1, ordem = 0 WHERE id = $2 RETURNING *',
            ['em_servico', filaItemId]
        );

        await client.query(
            'UPDATE fila_ativa SET ordem = ordem - 1 WHERE status_servico = $1 AND ordem > 0',
            ['espera']
        );
        
        await client.query('COMMIT');

        emitirFilaAtualizada();
        return res.json(updateResult.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Erro ao chamar próximo:", err);
        return res.status(500).json({ error: 'Erro no servidor ao chamar o próximo manobrista.' });
    } finally {
        client.release();
    }
};

const retornoManobrista = async (req, res) => {
    const { filaItemId } = req.body;
    
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        const updateStatusResult = await client.query(
            'UPDATE fila_ativa SET status_servico = $1 WHERE id = $2 AND status_servico = $3 RETURNING *',
            ['espera', filaItemId, 'em_servico']
        );

        if (updateStatusResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Item não encontrado em serviço.' });
        }

        const maxOrdemResult = await db.query(
            'SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima_ordem FROM fila_ativa WHERE status_servico = $1',
            ['espera']
        );
        const novaOrdem = maxOrdemResult.rows[0].proxima_ordem;

        const finalUpdateResult = await client.query(
            'UPDATE fila_ativa SET ordem = $1, timestamp_chegada = NOW() WHERE id = $2 RETURNING *',
            [novaOrdem, filaItemId]
        );

        await client.query('COMMIT');

        emitirFilaAtualizada();
        return res.json(finalUpdateResult.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Erro ao registrar retorno:", err);
        return res.status(500).json({ error: 'Erro no servidor ao registrar retorno.' });
    } finally {
        client.release();
    }
};

const moverItemNaFila = async (req, res) => {
    const { id: filaItemId, novaOrdem } = req.body;
    const novaOrdemInt = parseInt(novaOrdem);

    if (!filaItemId || !novaOrdemInt) {
        return res.status(400).json({ error: 'ID do item e nova ordem são obrigatórios.' });
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        const resultItem = await client.query(
            'SELECT ordem, status_servico FROM fila_ativa WHERE id = $1 AND status_servico = $2',
            [filaItemId, 'espera']
        );

        if (resultItem.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Item da fila não encontrado ou não está em espera.' });
        }

        const antigaOrdem = resultItem.rows[0].ordem;

        if (antigaOrdem === novaOrdemInt) {
            await client.query('COMMIT');
            return res.json({ message: 'Ordem não alterada.' });
        }

        let queryReordenacao = '';
        const paramsReordenacao = [];

        // CORREÇÃO JÁ APLICADA: As queries de reordenação internas já usam template literals (crases)
        if (antigaOrdem < novaOrdemInt) {
            queryReordenacao = `
                UPDATE fila_ativa 
                SET ordem = ordem - 1 
                WHERE ordem > $1 AND ordem <= $2 AND status_servico = $3
            `;
            paramsReordenacao.push(antigaOrdem, novaOrdemInt, 'espera');
        } else {
            queryReordenacao = `
                UPDATE fila_ativa 
                SET ordem = ordem + 1 
                WHERE ordem >= $1 AND ordem < $2 AND status_servico = $3
            `;
            paramsReordenacao.push(novaOrdemInt, antigaOrdem, 'espera');
        }

        await client.query(queryReordenacao, paramsReordenacao);

        const resultUpdate = await client.query(
            'UPDATE fila_ativa SET ordem = $1 WHERE id = $2 RETURNING *',
            [novaOrdemInt, filaItemId]
        );

        await client.query('COMMIT');
        
        emitirFilaAtualizada(); 

        return res.json(resultUpdate.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Erro ao mover item na fila:", err);
        return res.status(500).json({ error: 'Erro no servidor ao reordenar a fila.' });
    } finally {
        client.release();
    }
};

module.exports = {
    setSocketNotifier,
    getManobristas,
    cadastrarManobrista,
    editarManobrista,
    deletarManobrista,
    getFila,
    registrarChegada,
    chamarProximo,
    retornoManobrista,
    moverItemNaFila,
};