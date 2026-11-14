// routes/contato.js - mensagens do formulário "Contato" (tabela "contatos")
const express = require('express');
const router = express.Router();
const db = require('../db');
const { autenticar, somenteEquipe, ongDaEquipe } = require('../auth');
const { registrar } = require('../historico');
const { resolverOngDestino } = require('../ongsUtil');

// Confere se a mensagem existe e é da ONG de quem está logado; senão já responde o erro e devolve null
async function mensagemDaOng(req, res) {
    const [r] = await db.query('SELECT id, nome, assunto, ong_id FROM contatos WHERE id = ?', [req.params.id]);
    if (r.length === 0) {
        res.status(404).json({ mensagem: 'Mensagem não encontrada.' });
        return null;
    }
    const ong = await ongDaEquipe(req.usuario.id);
    if (ong && Number(r[0].ong_id) !== ong) {
        res.status(403).json({ mensagem: 'Essa mensagem é de outra ONG.' });
        return null;
    }
    return r[0];
}
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

        const destino = await resolverOngDestino(b.ong_id);
        if (destino.erro) {
            return res.status(400).json({ mensagem: destino.erro });
        }

        const sql = 'INSERT INTO contatos (nome, email, assunto, mensagem, ong_id) VALUES (?, ?, ?, ?, ?)';
        const [resultado] = await db.query(sql, [b.nome, b.email, b.assunto || null, b.mensagem, destino.id]);

        res.status(201).json({ mensagem: 'Mensagem enviada! Responderemos em breve.', id: resultado.insertId });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao enviar a mensagem.' });
    }
});

// GET /contato  -> lista as mensagens (só a equipe). Filtro opcional: ?lido=0
router.get('/', autenticar, somenteEquipe, async (req, res) => {
    try {
        const ong = await ongDaEquipe(req.usuario.id);
        const filtros = [];
        const valores = [];

        if (req.query.lido !== undefined) { filtros.push('lido = ?'); valores.push(req.query.lido === '1' ? 1 : 0); }
        if (ong) { filtros.push('ong_id = ?'); valores.push(ong); }   // cada ONG lê só as suas

        let sql = 'SELECT * FROM contatos';
        if (filtros.length) sql += ' WHERE ' + filtros.join(' AND ');
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
        const msg = await mensagemDaOng(req, res);
        if (!msg) return;

        await db.query('UPDATE contatos SET lido = TRUE WHERE id = ?', [req.params.id]);
        await registrar(req.usuario, 'marcou como lida', 'mensagem', Number(req.params.id), 'Mensagem de ' + msg.nome, msg.ong_id);
        res.json({ mensagem: 'Mensagem marcada como lida.' });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao atualizar a mensagem.' });
    }
});

// DELETE /contato/:id  -> apaga a mensagem (só a equipe)
router.delete('/:id', autenticar, somenteEquipe, async (req, res) => {
    try {
        const msg = await mensagemDaOng(req, res);
        if (!msg) return;

        await db.query('DELETE FROM contatos WHERE id = ?', [req.params.id]);
        await registrar(req.usuario, 'apagou', 'mensagem', Number(req.params.id), 'Mensagem de ' + msg.nome, msg.ong_id);
        res.json({ mensagem: 'Mensagem apagada.' });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao apagar a mensagem.' });
    }
});

module.exports = router;
