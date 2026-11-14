// routes/historico.js - o que cada ONG cadastrou, atualizou, removeu, aprovou...
const express = require('express');
const router = express.Router();
const db = require('../db');
const { autenticar, somenteEquipe, ongDaEquipe } = require('../auth');

// GET /historico  -> últimas 200 ações (da sua ONG; sem ONG vê todas). Filtro opcional: ?entidade=animal
router.get('/', autenticar, somenteEquipe, async (req, res) => {
    try {
        const ong = await ongDaEquipe(req.usuario.id);
        const filtros = [];
        const valores = [];
        if (ong) { filtros.push('h.ong_id = ?'); valores.push(ong); }
        if (req.query.entidade) { filtros.push('h.entidade = ?'); valores.push(req.query.entidade); }

        let sql = 'SELECT h.*, o.nome AS ong_nome FROM historico h LEFT JOIN ongs o ON o.id = h.ong_id';
        if (filtros.length) sql += ' WHERE ' + filtros.join(' AND ');
        sql += ' ORDER BY h.id DESC LIMIT 200';

        const [historico] = await db.query(sql, valores);
        res.json({ quantidade: historico.length, historico: historico });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao buscar o histórico.' });
    }
});

module.exports = router;
