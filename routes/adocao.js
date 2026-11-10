// routes/adocao.js - pedidos de adoção (tabela "adocoes")
const express = require('express');
const router = express.Router();
const db = require('../db');
const { autenticar, somenteEquipe, donoOuEquipe, ehEquipe } = require('../auth');

const statusPermitidos = ['solicitada', 'em_analise', 'aprovada', 'recusada', 'concluida'];

// Consulta base: pedido + nome do animal + nome do adotante
const SELECT_ADOCOES = `SELECT a.id, a.status, a.data_solicitacao, a.data_conclusao, a.observacoes,
        an.id AS animal_id, an.nome AS animal_nome, an.foto_url AS animal_foto,
        u.id AS adotante_id, u.nome AS adotante_nome, u.email AS adotante_email
    FROM adocoes a
    INNER JOIN animais an ON an.id = a.animal_id
    INNER JOIN usuarios u ON u.id = a.adotante_id`;

// Todas as rotas daqui exigem login
router.use(autenticar);

// GET /adocao  -> lista todos os pedidos (só a equipe). Filtro opcional: ?status=solicitada
router.get('/', somenteEquipe, async (req, res) => {
    try {
        let sql = SELECT_ADOCOES;
        const valores = [];

        if (req.query.status) {
            sql += ' WHERE a.status = ?';
            valores.push(req.query.status);
        }
        sql += ' ORDER BY a.id DESC';

        const [adocoes] = await db.query(sql, valores);
        res.json({ quantidade: adocoes.length, adocoes: adocoes });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao listar as adoções.' });
    }
});

// GET /adocao/minhas  -> pedidos de quem está logado
router.get('/minhas', async (req, res) => {
    try {
        const [adocoes] = await db.query(SELECT_ADOCOES + ' WHERE a.adotante_id = ? ORDER BY a.id DESC', [req.usuario.id]);
        res.json({ quantidade: adocoes.length, adocoes: adocoes });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao buscar os seus pedidos.' });
    }
});

// GET /adocao/adotante/:usuario_id  -> histórico de um adotante (ele mesmo ou a equipe)
router.get('/adotante/:usuario_id', async (req, res) => {
    try {
        if (!donoOuEquipe(req, req.params.usuario_id)) {
            return res.status(403).json({ mensagem: 'Você só pode ver o seu próprio histórico.' });
        }

        const [adocoes] = await db.query(SELECT_ADOCOES + ' WHERE a.adotante_id = ? ORDER BY a.id DESC', [req.params.usuario_id]);
        res.json({ quantidade: adocoes.length, adocoes: adocoes });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao buscar o histórico.' });
    }
});

// POST /adocao  -> registra um pedido de adoção
// O adotante é quem está logado. (A equipe pode enviar adotante_id para registrar por outra pessoa.)
router.post('/', async (req, res) => {
    try {
        const corpo = req.body || {};
        const animal_id = corpo.animal_id;
        const observacoes = corpo.observacoes;
        const adotanteId = (ehEquipe(req.usuario) && corpo.adotante_id) ? corpo.adotante_id : req.usuario.id;

        if (!animal_id) {
            return res.status(400).json({ mensagem: 'Informe o animal_id.' });
        }

        // o adotante precisa existir e ter perfil "adotante"
        const [usuarios] = await db.query(
            "SELECT id FROM usuarios WHERE id = ? AND perfil = 'adotante'",
            [adotanteId]
        );
        if (usuarios.length === 0) {
            return res.status(400).json({ mensagem: 'Só usuários com perfil adotante podem pedir adoção.' });
        }

        // o animal precisa existir e estar disponível
        const [animais] = await db.query(
            "SELECT id FROM animais WHERE id = ? AND status = 'disponivel'",
            [animal_id]
        );
        if (animais.length === 0) {
            return res.status(409).json({ mensagem: 'Animal não encontrado ou não está disponível.' });
        }

        // não pode pedir duas vezes o mesmo animal
        const [repetidos] = await db.query(
            "SELECT id FROM adocoes WHERE animal_id = ? AND adotante_id = ? AND status IN ('solicitada', 'em_analise', 'aprovada')",
            [animal_id, adotanteId]
        );
        if (repetidos.length > 0) {
            return res.status(409).json({ mensagem: 'Já existe um pedido em andamento para esse animal.' });
        }

        const sql = `INSERT INTO adocoes (animal_id, adotante_id, status, data_solicitacao, observacoes)
                     VALUES (?, ?, 'solicitada', CURDATE(), ?)`;
        const [resultado] = await db.query(sql, [animal_id, adotanteId, observacoes || null]);

        res.status(201).json({ mensagem: 'Pedido registrado!', id: resultado.insertId });
    } catch (erro) {
        console.log(erro);
        res.status(400).json({ mensagem: 'Não foi possível registrar o pedido.' });
    }
});

// PUT /adocao/:id  -> muda o status do pedido (só a equipe)
router.put('/:id', somenteEquipe, async (req, res) => {
    try {
        const status = (req.body || {}).status;

        if (!statusPermitidos.includes(status)) {
            return res.status(400).json({ mensagem: 'Status inválido. Use: ' + statusPermitidos.join(', ') });
        }

        const [adocoes] = await db.query('SELECT animal_id FROM adocoes WHERE id = ?', [req.params.id]);
        if (adocoes.length === 0) {
            return res.status(404).json({ mensagem: 'Pedido não encontrado.' });
        }
        const animalId = adocoes[0].animal_id;

        await db.query('UPDATE adocoes SET status = ? WHERE id = ?', [status, req.params.id]);

        // Aprovada: o animal fica reservado
        if (status === 'aprovada') {
            await db.query("UPDATE animais SET status = 'reservado' WHERE id = ? AND status = 'disponivel'", [animalId]);
        }

        // Concluída: guarda a data e marca o animal como adotado
        if (status === 'concluida') {
            await db.query('UPDATE adocoes SET data_conclusao = CURDATE() WHERE id = ?', [req.params.id]);
            await db.query("UPDATE animais SET status = 'adotado' WHERE id = ?", [animalId]);
        }

        // Recusada: se o animal estava reservado e não há outra aprovação, ele volta a ficar disponível
        if (status === 'recusada') {
            await db.query(
                `UPDATE animais SET status = 'disponivel'
                 WHERE id = ? AND status = 'reservado'
                 AND NOT EXISTS (SELECT 1 FROM adocoes WHERE animal_id = ? AND status = 'aprovada')`,
                [animalId, animalId]
            );
        }

        res.json({ mensagem: 'Status atualizado!', status: status });
    } catch (erro) {
        console.log(erro);
        res.status(400).json({ mensagem: 'Não foi possível atualizar o pedido.' });
    }
});

// DELETE /adocao/:id  -> remove (equipe) ou cancela o próprio pedido (adotante, enquanto não foi aprovado)
router.delete('/:id', async (req, res) => {
    try {
        const [adocoes] = await db.query('SELECT adotante_id, status FROM adocoes WHERE id = ?', [req.params.id]);
        if (adocoes.length === 0) {
            return res.status(404).json({ mensagem: 'Pedido não encontrado.' });
        }

        const pedido = adocoes[0];
        const ehDono = Number(pedido.adotante_id) === Number(req.usuario.id);
        const aindaEmAberto = ['solicitada', 'em_analise'].includes(pedido.status);

        if (!ehEquipe(req.usuario) && !(ehDono && aindaEmAberto)) {
            return res.status(403).json({ mensagem: 'Você só pode cancelar o seu pedido enquanto ele não foi aprovado.' });
        }

        await db.query('DELETE FROM adocoes WHERE id = ?', [req.params.id]);
        res.json({ mensagem: 'Pedido removido!' });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao remover o pedido.' });
    }
});

module.exports = router;
