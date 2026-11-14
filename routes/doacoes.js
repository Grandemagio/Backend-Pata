// routes/doacoes.js - doações (tabela "doacoes")
// Obs.: a API só REGISTRA a doação. Não existe pagamento online: a equipe confirma depois.
const express = require('express');
const router = express.Router();
const db = require('../db');
const { autenticar, autenticarOpcional, somenteEquipe, ongDaEquipe, ehEquipe } = require('../auth');
const { registrar } = require('../historico');
const { resolverOngDestino } = require('../ongsUtil');
const { emailValido } = require('../util');

const tiposPermitidos = ['dinheiro', 'alimento', 'medicamento', 'outro'];
const statusPermitidos = ['pendente', 'confirmada', 'cancelada'];

// GET /doacoes/resumo  -> total arrecadado (aberto a todos, bom para a página Doar)
router.get('/resumo', async (req, res) => {
    try {
        // ?ong_id=1 mostra o total de uma ONG; sem isso, o total geral
        const valores = [];
        let filtroOng = '';
        if (req.query.ong_id) { filtroOng = ' AND ong_id = ?'; valores.push(req.query.ong_id); }
        const [linhas] = await db.query(
            `SELECT COALESCE(SUM(valor), 0) AS total, COUNT(*) AS quantidade
             FROM doacoes WHERE status = 'confirmada'` + filtroOng,
            valores
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
        if (ehEquipe(req.usuario)) {
            return res.status(403).json({ mensagem: 'Contas da ONG não fazem doações.' });
        }
        const destino = await resolverOngDestino(b.ong_id);
        if (destino.erro) {
            return res.status(400).json({ mensagem: destino.erro });
        }

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

        const sql = `INSERT INTO doacoes (usuario_id, nome, email, tipo, valor, mensagem, ong_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [resultado] = await db.query(sql, [usuarioId, nome, email, tipo, valor, b.mensagem || null, destino.id]);

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
        const ong = await ongDaEquipe(req.usuario.id);
        const filtros = [];
        const valores = [];

        if (req.query.status) { filtros.push('status = ?'); valores.push(req.query.status); }
        if (ong) { filtros.push('ong_id = ?'); valores.push(ong); }   // cada ONG vê só as suas

        let sql = 'SELECT * FROM doacoes';
        if (filtros.length) sql += ' WHERE ' + filtros.join(' AND ');
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

        const [doacoes] = await db.query('SELECT ong_id, nome, tipo, valor FROM doacoes WHERE id = ?', [req.params.id]);
        if (doacoes.length === 0) {
            return res.status(404).json({ mensagem: 'Doação não encontrada.' });
        }
        const ong = await ongDaEquipe(req.usuario.id);
        if (ong && Number(doacoes[0].ong_id) !== ong) {
            return res.status(403).json({ mensagem: 'Essa doação é de outra ONG.' });
        }

        await db.query('UPDATE doacoes SET status = ? WHERE id = ?', [status, req.params.id]);
        const acoes = { pendente: 'reabriu', confirmada: 'confirmou', cancelada: 'cancelou' };
        await registrar(req.usuario, acoes[status], 'doacao', Number(req.params.id), 'Doação #' + req.params.id + ' de ' + doacoes[0].nome, doacoes[0].ong_id);
        res.json({ mensagem: 'Status atualizado!', status: status });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao atualizar a doação.' });
    }
});

module.exports = router;
