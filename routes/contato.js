// routes/contato.js - mensagens do formulário "Contato" (tabela "contatos")
const express = require('express');
const router = express.Router();
const db = require('../db');
const { autenticar, somenteEquipe } = require('../auth');
const { emailValido } = require('../util');

// POST /contato  -> qualquer pessoa envia uma mensagem
router.post('/', async (req, res) => {
    try {
        const b = req.body || {};

        if (!b.nome || !b.email || !b.mensagem) {
            return res.status(400).json({ mensagem: 'Informe nome, email e mensagem.' });
        }
        if (!emailValido(b.email)) {
            return res.status(400).json({ mensagem: 'E-mail inválido.' });
        }
        if (String(b.mensagem).length > 2000) {
            return res.status(400).json({ mensagem: 'A mensagem pode ter no máximo 2000 caracteres.' });
        }

        const sql = 'INSERT INTO contatos (nome, email, assunto, mensagem) VALUES (?, ?, ?, ?)';
        const [resultado] = await db.query(sql, [b.nome, b.email, b.assunto || null, b.mensagem]);

        res.status(201).json({ mensagem: 'Mensagem enviada! Responderemos em breve.', id: resultado.insertId });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao enviar a mensagem.' });
    }
});

// GET /contato  -> lista as mensagens (só a equipe). Filtro opcional: ?lido=0
router.get('/', autenticar, somenteEquipe, async (req, res) => {
    try {
        let sql = 'SELECT * FROM contatos';
        const valores = [];

        if (req.query.lido !== undefined) {
            sql += ' WHERE lido = ?';
            valores.push(req.query.lido === '1' ? 1 : 0);
        }
        sql += ' ORDER BY id DESC';

        const [mensagens] = await db.query(sql, valores);
        res.json({ quantidade: mensagens.length, mensagens: mensagens });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao listar as mensagens.' });
    }
});

// PUT /contato/:id/lido  -> marca a mensagem como lida (só a equipe)
router.put('/:id/lido', autenticar, somenteEquipe, async (req, res) => {
    try {
        const [resultado] = await db.query('UPDATE contatos SET lido = TRUE WHERE id = ?', [req.params.id]);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Mensagem não encontrada.' });
        }
        res.json({ mensagem: 'Mensagem marcada como lida.' });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao atualizar a mensagem.' });
    }
});

// DELETE /contato/:id  -> apaga a mensagem (só a equipe)
router.delete('/:id', autenticar, somenteEquipe, async (req, res) => {
    try {
        const [resultado] = await db.query('DELETE FROM contatos WHERE id = ?', [req.params.id]);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Mensagem não encontrada.' });
        }
        res.json({ mensagem: 'Mensagem apagada.' });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao apagar a mensagem.' });
    }
});

module.exports = router;
