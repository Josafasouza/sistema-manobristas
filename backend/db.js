const { Pool } = require('pg');

// 🚨 ALTERAÇÃO CRUCIAL:
// Lê a string de conexão completa da variável de ambiente que será definida no Render.
const connectionString = process.env.DATABASE_URL;

// Verifica se a variável de ambiente existe
if (!connectionString) {
    console.error("ERRO FATAL: Variável de ambiente DATABASE_URL não está configurada.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString,
    // Adiciona a configuração SSL necessária para serviços cloud (como Neon e Render)
    ssl: {
        rejectUnauthorized: false
    }
});

// Inicialização e Criação das Tabelas
const inicializarDB = async () => {
    try {
        // Tenta se conectar e criar o pool
        await pool.query(`
            CREATE TABLE IF NOT EXISTS manobristas (
                id SERIAL PRIMARY KEY,
                matricula VARCHAR(20) UNIQUE NOT NULL,
                nome VARCHAR(100) NOT NULL,
                status VARCHAR(10) DEFAULT 'ativo'
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS fila_ativa (
                id SERIAL PRIMARY KEY,
                id_manobrista INTEGER REFERENCES manobristas(id) ON DELETE CASCADE,
                nome VARCHAR(100) NOT NULL,
                ordem INTEGER NOT NULL,
                status_servico VARCHAR(20) DEFAULT 'espera',
                timestamp_chegada TIMESTAMP NOT NULL
            );
        `);
        console.log("Banco de dados inicializado e tabelas criadas com sucesso.");
        
        // Inserir dados de teste se as tabelas estiverem vazias
        const count = await pool.query('SELECT COUNT(*) FROM manobristas');
        if (parseInt(count.rows[0].count) === 0) {
            console.log("Inserindo dados iniciais...");
            await pool.query("INSERT INTO manobristas (matricula, nome) VALUES ('M001', 'João da Silva'), ('M002', 'Maria Souza')");
        }

    } catch (err) {
        // Lógica de erro de inicialização não deve ser fatal aqui se estiver dentro de um retry loop
        console.error("Erro ao inicializar o banco de dados:", err.message || err.code);
        throw err; // Lança o erro para ser capturado pela lógica de retry no index.js
    }
};

module.exports = {
    pool, 
    query: (text, params) => pool.query(text, params),
    inicializarDB,
};