const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');
const manobristasDB = require('./manobristas'); 

const app = express();
const server = http.createServer(app);

// 🚨 CORREÇÃO FINAL DE CORS:
// Usando a URL de Endpoint de Site Estático do seu Bucket S3.
const allowedOrigin = 'http://manobrista-josafasouza-app.s3-website-us-west-2.amazonaws.com';

// Define a origem permitida para requisições HTTP
app.use(cors({ origin: allowedOrigin })); 
app.use(express.json());

// --- FUNÇÃO AUXILIAR PARA ESPERA ---
const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// ------------------------------------

// --- SOCKET.IO CONFIG ---
const io = new Server(server, {
    cors: {
        origin: allowedOrigin, // Usando a mesma origem permitida para o Socket.IO
        methods: ['GET', 'POST']
    }
});

const emitirFilaAtualizada = async () => {
    // Chamando getFila internamente, sem req e res
    const data = await manobristasDB.getFila();
    io.emit('fila_atualizada', data);
};
manobristasDB.setSocketNotifier(emitirFilaAtualizada);

io.on('connection', async (socket) => {
    console.log(`Usuário conectado: ${socket.id}`);
    try {
        socket.emit('fila_inicial', await manobristasDB.getFila());
    } catch (e) {
        console.error("Não foi possível enviar fila inicial: DB inacessível temporariamente.");
    }
});
// --------------------------

// --- ROTAS DA API (CRUD e Fila) ---

// CRUD Manobristas (Admin)
app.get('/api/manobristas', manobristasDB.getManobristas);
app.post('/api/manobristas', manobristasDB.cadastrarManobrista);
app.put('/api/manobristas/:id', manobristasDB.editarManobrista);
app.delete('/api/manobristas/:id', manobristasDB.deletarManobrista);

// Fila (Operações em Tempo Real)
app.get('/api/fila', manobristasDB.getFila);
app.post('/api/fila/chegada', manobristasDB.registrarChegada);
app.post('/api/fila/chamar', manobristasDB.chamarProximo);
app.post('/api/fila/retorno', manobristasDB.retornoManobrista);
app.post('/api/fila/mover', manobristasDB.moverItemNaFila);


const PORT = process.env.PORT || 3000;

const iniciarServidor = async () => {
    // 1. LÓGICA DE RETRY PARA O DB (Solução ECONNREFUSED)
    let tentativas = 10; 
    while (tentativas > 0) {
        try {
            await db.inicializarDB();
            console.log("Conexão com o Banco de Dados estabelecida e tabelas verificadas.");
            break; 
        } catch (error) {
            console.error(`Aguardando DB... Tentativas restantes: ${--tentativas}. Erro: ${error.code || error.message}`);
            if (tentativas === 0) {
                console.error("ERRO FATAL: Falha ao conectar ao Banco de Dados após múltiplas tentativas.");
                process.exit(1);
            }
            await esperar(2000);
        }
    }
    
    // 2. INICIAR O SERVIDOR EXPRESS E SOCKET.IO
    server.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
};

iniciarServidor();