// server.js - arquivo principal: liga o servidor e conecta as rotas
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./db');
require('./auth');   // confere logo no início se o JWT_SECRET existe

const app = express();

app.use(cors());          // deixa o React (outra porta) acessar a API
app.use(express.json());  // permite receber dados em JSON no corpo da requisição

// Fotos enviadas pela ONG ficam acessíveis em /uploads/nome-do-arquivo
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rotas de cada assunto, cada uma no seu arquivo
app.use('/usuarios', require('./routes/usuarios'));
app.use('/pets', require('./routes/pets'));
app.use('/favoritos', require('./routes/favoritos'));
app.use('/adotantes', require('./routes/adotantes'));
app.use('/match', require('./routes/match'));
app.use('/adocao', require('./routes/adocao'));
app.use('/doacoes', require('./routes/doacoes'));
app.use('/contato', require('./routes/contato'));

// Rota de teste: a API está ligada?
app.get('/', (req, res) => {
    res.json({ mensagem: 'Pata Amiga API funcionando!' });
});

// Rota de teste: o banco está conectado?
app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ api: 'ok', banco: 'conectado' });
    } catch (erro) {
        console.log(erro);
        res.status(503).json({ mensagem: 'A API está ligada, mas o banco não responde.' });
    }
});

// Nenhuma rota combinou
app.use((req, res) => {
    res.status(404).json({ mensagem: 'Rota não encontrada.' });
});

// Erros que escaparam das rotas (por exemplo, JSON escrito errado)
app.use((erro, req, res, next) => {
    if (erro.type === 'entity.parse.failed') {
        return res.status(400).json({ mensagem: 'O JSON enviado está inválido.' });
    }
    console.log(erro);
    res.status(500).json({ mensagem: 'Erro interno da API.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, (erro) => {
    // Se a porta já estiver em uso, o erro chega aqui
    if (erro) {
        console.log('Não foi possível iniciar a API na porta ' + PORT + ': ' + erro.message);
        process.exit(1);
    }
    console.log('API rodando em http://localhost:' + PORT);
});
