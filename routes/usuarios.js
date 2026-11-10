// routes/usuarios.js - cadastro, login e conta do usuário (tabela "usuarios")
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { gerarToken, autenticar, somenteEquipe } = require('../auth');
const { emailValido } = require('../util');

// Quem pode se cadastrar sozinho. "admin" e "voluntario" só são criados direto no banco.
const perfisPermitidos = ['adotante', 'padrinho', 'doador'];

// Dados do usuário que podem ser mostrados (nunca o senha_hash)
function dadosPublicos(u) {
    return { id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, perfil: u.perfil };
}

// POST /usuarios/registro  -> cria um usuário novo (e já devolve o token de login)
router.post('/registro', async (req, res) => {
    try {
        const b = req.body || {};

        if (!b.nome || !b.email || !b.senha) {
            return res.status(400).json({ mensagem: 'Informe nome, email e senha.' });
        }
        if (!emailValido(b.email)) {
            return res.status(400).json({ mensagem: 'E-mail inválido.' });
        }
        if (String(b.senha).length < 6) {
            return res.status(400).json({ mensagem: 'A senha precisa ter pelo menos 6 caracteres.' });
        }

        const perfil = b.perfil || 'adotante';
        if (!perfisPermitidos.includes(perfil)) {
            return res.status(400).json({ mensagem: 'Perfil inválido. Use: ' + perfisPermitidos.join(', ') });
        }

        // A senha NUNCA é guardada pura: guardamos só o "hash" (senha embaralhada)
        const senhaHash = await bcrypt.hash(String(b.senha), 10);

        const sql = 'INSERT INTO usuarios (nome, email, senha_hash, telefone, perfil) VALUES (?, ?, ?, ?, ?)';
        const [resultado] = await db.query(sql, [b.nome, b.email, senhaHash, b.telefone || null, perfil]);

        const usuario = { id: resultado.insertId, nome: b.nome, email: b.email, telefone: b.telefone || null, perfil: perfil };
        res.status(201).json({
            mensagem: 'Usuário cadastrado!',
            id: usuario.id,
            token: gerarToken(usuario),
            usuario: dadosPublicos(usuario)
        });
    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ mensagem: 'Esse e-mail já está cadastrado.' });
        }
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao cadastrar o usuário.' });
    }
});

// POST /usuarios/login  -> confere e-mail e senha e devolve o token
router.post('/login', async (req, res) => {
    try {
        const b = req.body || {};

        if (!b.email || !b.senha) {
            return res.status(400).json({ mensagem: 'Informe email e senha.' });
        }

        const [usuarios] = await db.query('SELECT * FROM usuarios WHERE email = ?', [b.email]);

        // A mesma mensagem para "e-mail errado" e "senha errada"
        if (usuarios.length === 0) {
            return res.status(401).json({ mensagem: 'E-mail ou senha incorretos.' });
        }

        const usuario = usuarios[0];
        const senhaCerta = await bcrypt.compare(String(b.senha), usuario.senha_hash);
        if (!senhaCerta) {
            return res.status(401).json({ mensagem: 'E-mail ou senha incorretos.' });
        }

        res.json({
            mensagem: 'Login realizado!',
            token: gerarToken(usuario),
            usuario: dadosPublicos(usuario)
        });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao fazer login.' });
    }
});

// GET /usuarios/eu  -> dados de quem está logado
router.get('/eu', autenticar, async (req, res) => {
    try {
        const [usuarios] = await db.query('SELECT * FROM usuarios WHERE id = ?', [req.usuario.id]);

        if (usuarios.length === 0) {
            return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
        }
        res.json(dadosPublicos(usuarios[0]));
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao buscar o usuário.' });
    }
});

// PUT /usuarios/eu  -> altera nome e telefone de quem está logado
router.put('/eu', autenticar, async (req, res) => {
    try {
        const b = req.body || {};

        if (!b.nome) {
            return res.status(400).json({ mensagem: 'Informe o nome.' });
        }

        await db.query('UPDATE usuarios SET nome = ?, telefone = ? WHERE id = ?',
            [b.nome, b.telefone || null, req.usuario.id]);
        res.json({ mensagem: 'Dados atualizados!' });
    } catch (erro) {
        console.log(erro);
        res.status(400).json({ mensagem: 'Não foi possível atualizar os dados.' });
    }
});

// PUT /usuarios/eu/senha  -> troca a senha (precisa da senha atual)
router.put('/eu/senha', autenticar, async (req, res) => {
    try {
        const b = req.body || {};

        if (!b.senha_atual || !b.senha_nova) {
            return res.status(400).json({ mensagem: 'Informe senha_atual e senha_nova.' });
        }
        if (String(b.senha_nova).length < 6) {
            return res.status(400).json({ mensagem: 'A senha nova precisa ter pelo menos 6 caracteres.' });
        }

        const [usuarios] = await db.query('SELECT senha_hash FROM usuarios WHERE id = ?', [req.usuario.id]);
        if (usuarios.length === 0) {
            return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
        }

        const senhaCerta = await bcrypt.compare(String(b.senha_atual), usuarios[0].senha_hash);
        if (!senhaCerta) {
            return res.status(401).json({ mensagem: 'A senha atual está incorreta.' });
        }

        const novoHash = await bcrypt.hash(String(b.senha_nova), 10);
        await db.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [novoHash, req.usuario.id]);
        res.json({ mensagem: 'Senha alterada!' });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao trocar a senha.' });
    }
});

// GET /usuarios  -> lista todos os usuários (só a equipe)
router.get('/', autenticar, somenteEquipe, async (req, res) => {
    try {
        const [usuarios] = await db.query(
            'SELECT id, nome, email, telefone, perfil, criado_em FROM usuarios ORDER BY id DESC'
        );
        res.json({ quantidade: usuarios.length, usuarios: usuarios });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao listar os usuários.' });
    }
});

module.exports = router;
