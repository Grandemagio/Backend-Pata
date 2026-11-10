// routes/adotantes.js - perfil de compatibilidade de quem quer adotar
// (tabela "perfis_adotantes", ligada à tabela "usuarios")
const express = require('express');
const router = express.Router();
const db = require('../db');
const { autenticar, donoOuEquipe } = require('../auth');

// Todas as rotas daqui exigem login
router.use(autenticar);

// Confere se o perfil veio completo
function perfilCompleto(b) {
    return b.espaco && b.atividade && b.tempo && b.experiencia
        && b.criancas !== undefined && b.outros_pets !== undefined;
}

// POST /adotantes  -> cria o perfil (de quem está logado, ou do usuario_id enviado se for da equipe)
router.post('/', async (req, res) => {
    try {
        const b = req.body || {};
        const usuarioId = b.usuario_id || req.usuario.id;

        if (!donoOuEquipe(req, usuarioId)) {
            return res.status(403).json({ mensagem: 'Você só pode criar o seu próprio perfil.' });
        }
        if (!perfilCompleto(b)) {
            return res.status(400).json({ mensagem: 'Informe espaco, atividade, tempo, experiencia, criancas e outros_pets.' });
        }

        // o usuário precisa existir e ter perfil "adotante"
        const [usuarios] = await db.query('SELECT perfil FROM usuarios WHERE id = ?', [usuarioId]);
        if (usuarios.length === 0) {
            return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
        }
        if (usuarios[0].perfil !== 'adotante') {
            return res.status(400).json({ mensagem: 'O usuário precisa ter perfil adotante.' });
        }

        const sql = `INSERT INTO perfis_adotantes
            (usuario_id, espaco, atividade, tempo, experiencia, criancas, outros_pets)
            VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const valores = [usuarioId, b.espaco, b.atividade, b.tempo, b.experiencia, b.criancas, b.outros_pets];

        const [resultado] = await db.query(sql, valores);
        res.status(201).json({ mensagem: 'Perfil cadastrado!', id: resultado.insertId });
    } catch (erro) {
        console.log(erro);
        res.status(400).json({ mensagem: 'Não foi possível cadastrar. Esse usuário já tem perfil?' });
    }
});

// GET /adotantes/:usuario_id  -> mostra o perfil
router.get('/:usuario_id', async (req, res) => {
    try {
        if (!donoOuEquipe(req, req.params.usuario_id)) {
            return res.status(403).json({ mensagem: 'Você só pode ver o seu próprio perfil.' });
        }

        const sql = `SELECT p.*, u.nome, u.email
                     FROM perfis_adotantes p
                     INNER JOIN usuarios u ON u.id = p.usuario_id
                     WHERE p.usuario_id = ?`;
        const [perfis] = await db.query(sql, [req.params.usuario_id]);

        if (perfis.length === 0) {
            return res.status(404).json({ mensagem: 'Perfil não encontrado.' });
        }
        res.json(perfis[0]);
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao buscar o perfil.' });
    }
});

// PUT /adotantes/:usuario_id  -> atualiza o perfil
router.put('/:usuario_id', async (req, res) => {
    try {
        const b = req.body || {};

        if (!donoOuEquipe(req, req.params.usuario_id)) {
            return res.status(403).json({ mensagem: 'Você só pode alterar o seu próprio perfil.' });
        }
        if (!perfilCompleto(b)) {
            return res.status(400).json({ mensagem: 'Informe todos os campos do perfil.' });
        }

        const sql = `UPDATE perfis_adotantes
                     SET espaco = ?, atividade = ?, tempo = ?, experiencia = ?, criancas = ?, outros_pets = ?
                     WHERE usuario_id = ?`;
        const valores = [b.espaco, b.atividade, b.tempo, b.experiencia, b.criancas, b.outros_pets, req.params.usuario_id];

        const [resultado] = await db.query(sql, valores);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Perfil não encontrado.' });
        }
        res.json({ mensagem: 'Perfil atualizado!' });
    } catch (erro) {
        console.log(erro);
        res.status(400).json({ mensagem: 'Não foi possível atualizar o perfil.' });
    }
});

module.exports = router;
