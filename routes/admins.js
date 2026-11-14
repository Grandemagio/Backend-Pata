// routes/admins.js - login e cadastro da EQUIPE (tabelas "usuarios" + "admins")
// O cadastro só funciona com o código da equipe (ADMIN_CODIGO no .env).
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { gerarToken, ehEquipe } = require('../auth');
const { emailValido } = require('../util');
const { resolverOngDestino } = require('../ongsUtil');

function dadosPublicos(u) {
    return { id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, perfil: u.perfil, foto_url: u.foto_url || null };
}

// Compara dois textos sem revelar, pelo tempo, quantas letras estavam certas
function codigoConfere(enviado, correto) {
    const a = crypto.createHash('sha256').update(String(enviado)).digest();
    const b = crypto.createHash('sha256').update(String(correto)).digest();
    return crypto.timingSafeEqual(a, b);
}

// POST /admins/login  -> entra na área da equipe
router.post('/login', async (req, res) => {
    try {
        const b = req.body || {};
        if (!b.email || !b.senha) {
            return res.status(400).json({ mensagem: 'Informe email e senha.' });
        }

        const [usuarios] = await db.query('SELECT * FROM usuarios WHERE email = ?', [b.email]);
        const usuario = usuarios[0];

        // Mesma mensagem para e-mail errado, senha errada ou conta que não é da equipe
        const erroGenerico = { mensagem: 'E-mail ou senha incorretos.' };
        if (!usuario || !(await bcrypt.compare(String(b.senha), usuario.senha_hash))) {
            return res.status(401).json(erroGenerico);
        }
        if (!ehEquipe(usuario)) {
            return res.status(401).json(erroGenerico);
        }

        // Se o admin foi suspenso na tabela "admins", não entra
        const [admins] = await db.query('SELECT ativo FROM admins WHERE usuario_id = ?', [usuario.id]);
        if (admins.length > 0 && !admins[0].ativo) {
            return res.status(403).json({ mensagem: 'Seu acesso está suspenso. Fale com a coordenação.' });
        }

        res.json({ mensagem: 'Login realizado!', token: gerarToken(usuario), usuario: dadosPublicos(usuario) });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao fazer login.' });
    }
});

// POST /admins/registro  -> cria um admin novo (exige o código da equipe)
router.post('/registro', async (req, res) => {
    const conexao = await db.getConnection();
    try {
        if (!process.env.ADMIN_CODIGO) {
            return res.status(503).json({ mensagem: 'Cadastro de equipe desativado: defina ADMIN_CODIGO no .env da API.' });
        }

        const b = req.body || {};
        if (!b.nome || !b.email || !b.senha || !b.codigo) {
            return res.status(400).json({ mensagem: 'Informe nome, email, senha e o código da equipe.' });
        }
        if (!codigoConfere(b.codigo, process.env.ADMIN_CODIGO)) {
            return res.status(403).json({ mensagem: 'Código da equipe incorreto.' });
        }
        if (!emailValido(b.email)) {
            return res.status(400).json({ mensagem: 'E-mail inválido.' });
        }
        if (String(b.senha).length < 6) {
            return res.status(400).json({ mensagem: 'A senha precisa ter pelo menos 6 caracteres.' });
        }

        const senhaHash = await bcrypt.hash(String(b.senha), 10);
        // ONG da pessoa: a escolhida (precisa existir) ou, se só há uma ONG, essa
        const destino = await resolverOngDestino(b.ong_id);
        if (destino.erro) {
            return res.status(400).json({ mensagem: destino.erro });
        }
        const ongId = destino.id;

        // Cria o usuário e o registro de admin juntos (ou nenhum dos dois)
        await conexao.beginTransaction();
        const [r] = await conexao.query(
            "INSERT INTO usuarios (nome, email, senha_hash, telefone, perfil, ong_id) VALUES (?, ?, ?, ?, 'admin', ?)",
            [b.nome, b.email, senhaHash, b.telefone || null, ongId]
        );
        await conexao.query('INSERT INTO admins (usuario_id, ong_id) VALUES (?, ?)', [r.insertId, ongId]);
        await conexao.commit();

        const usuario = { id: r.insertId, nome: b.nome, email: b.email, telefone: b.telefone || null, perfil: 'admin' };
        res.status(201).json({ mensagem: 'Admin cadastrado!', token: gerarToken(usuario), usuario: dadosPublicos(usuario) });
    } catch (erro) {
        await conexao.rollback();
        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ mensagem: 'Esse e-mail já está cadastrado.' });
        }
        if (erro.code === 'ER_NO_SUCH_TABLE') {
            return res.status(500).json({ mensagem: 'A tabela "admins" não existe. Rode o admins.sql.' });
        }
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao cadastrar o admin.' });
    } finally {
        conexao.release();
    }
});

module.exports = router;
