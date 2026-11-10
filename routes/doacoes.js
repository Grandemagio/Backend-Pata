// routes/doacoes.js - doações (tabela "doacoes")
// Obs.: a API só REGISTRA a doação. Não existe pagamento online: a equipe confirma depois.
const express = require('express');
const router = express.Router();
const db = require('../db');
const { autenticar, autenticarOpcional, somenteEquipe } = require('../auth');
const { emailValido } = require('../util');

const tiposPermitidos = ['dinheiro', 'alimento', 'medicamento', 'outro'];
const statusPermitidos = ['pendente', 'confirmada', 'cancelada'];

// GET /doacoes/resumo  -> total arrecadado (aberto a todos, bom para a página Doar)
router.get('/resumo', async (req, res) => {
    try {
        const [linhas] = await db.query(
            `SELECT COALESCE(SUM(valor), 0) AS total, COUNT(*) AS quantidade
             FROM doacoes WHERE status = 'confirmada'`
        );
        res.json({ total_arrecadado: Number(linhas[0].total), quantidade: linhas[0].quantidade });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao calcular o resumo.' });
    }
});

// POST /doacoes  -> registra uma doação (com ou sem login)
router.post('/', autenticarOpcional, async (req, res) => {
    try {
        const b = req.body || {};
        const tipo = b.tipo || 'dinheiro';

        if (!tiposPermitidos.includes(tipo)) {
            return res.status(400).json({ mensagem: 'Tipo inválido. Use: ' + tiposPermitidos.join(', ') });
        }

        let valor = null;
        if (tipo === 'dinheiro') {
            valor = Number(b.valor);
            if (!(valor > 0)) {
                return res.status(400).json({ mensagem: 'Informe um valor maior que zero.' });
            }
        }

        // Quem está logado usa os próprios dados; visitante precisa informar nome e e-mail
        let nome = b.nome;
        let email = b.email;
        let usuarioId = null;

        if (req.usuario) {
            usuarioId = req.usuario.id;
            const [usuarios] = await db.query('SELECT nome, email FROM usuarios WHERE id = ?', [usuarioId]);
            if (usuarios.length > 0) {
                nome = nome || usuarios[0].nome;
                email = email || usuarios[0].email;
            }
        }

        if (!nome || !email) {
            return res.status(400).json({ mensagem: 'Informe nome e email.' });
        }
        if (!emailValido(email)) {
            return res.status(400).json({ mensagem: 'E-mail inválido.' });
        }

        const sql = `INSERT INTO doacoes (usuario_id, nome, email, tipo, valor, mensagem)
                     VALUES (?, ?, ?, ?, ?, ?)`;
        const [resultado] = await db.query(sql, [usuarioId, nome, email, tipo, valor, b.mensagem || null]);

        res.status(201).json({ mensagem: 'Doação registrada! Obrigado por ajudar.', id: resultado.insertId });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao registrar a doação.' });
    }
});

// GET /doacoes/minhas  -> doações de quem está logado
router.get('/minhas', autenticar, async (req, res) => {
    try {
        const [doacoes] = await db.query(
            'SELECT * FROM doacoes WHERE usuario_id = ? ORDER BY id DESC',
            [req.usuario.id]
        );
        res.json({ quantidade: doacoes.length, doacoes: doacoes });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao buscar as suas doações.' });
    }
});

// GET /doacoes  -> lista todas (só a equipe). Filtro opcional: ?status=pendente
router.get('/', autenticar, somenteEquipe, async (req, res) => {
    try {
        let sql = 'SELECT * FROM doacoes';
        const valores = [];

        if (req.query.status) {
            sql += ' WHERE status = ?';
            valores.push(req.query.status);
        }
        sql += ' ORDER BY id DESC';

        const [doacoes] = await db.query(sql, valores);
        res.json({ quantidade: doacoes.length, doacoes: doacoes });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao listar as doações.' });
    }
});

// PUT /doacoes/:id  -> muda o status (confirmar ou cancelar). Só a equipe.
router.put('/:id', autenticar, somenteEquipe, async (req, res) => {
    try {
        const status = (req.body || {}).status;

        if (!statusPermitidos.includes(status)) {
            return res.status(400).json({ mensagem: 'Status inválido. Use: ' + statusPermitidos.join(', ') });
        }

        const [resultado] = await db.query('UPDATE doacoes SET status = ? WHERE id = ?', [status, req.params.id]);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Doação não encontrada.' });
        }
        res.json({ mensagem: 'Status atualizado!', status: status });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao atualizar a doação.' });
    }
});

module.exports = router;
