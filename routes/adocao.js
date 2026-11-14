// routes/adocao.js - pedidos de adoção (tabela "adocoes")
const express = require('express');
const router = express.Router();
const db = require('../db');
const { autenticar, somenteEquipe, donoOuEquipe, ehEquipe, ongDaEquipe, somenteUsuario } = require('../auth');
const { registrar } = require('../historico');
const { calcularMatch } = require('../compatibilidade');

const statusPermitidos = ['solicitada', 'em_analise', 'aprovada', 'recusada', 'concluida'];

// Consulta base: pedido + nome do animal + nome do adotante
const SELECT_ADOCOES = `SELECT a.id, a.status, a.data_solicitacao, a.data_conclusao, a.observacoes, a.compatibilidade, a.motivos,
        an.id AS animal_id, an.nome AS animal_nome, an.foto_url AS animal_foto,
        u.id AS adotante_id, u.nome AS adotante_nome, u.email AS adotante_email
    FROM adocoes a
    INNER JOIN animais an ON an.id = a.animal_id
    INNER JOIN usuarios u ON u.id = a.adotante_id`;

// Consulta da equipe: inclui telefone, ONG do animal e as respostas do questionário do adotante
const SELECT_EQUIPE = `SELECT a.id, a.status, a.data_solicitacao, a.data_conclusao, a.observacoes, a.compatibilidade, a.motivos,
        an.id AS animal_id, an.nome AS animal_nome, an.foto_url AS animal_foto, an.ong_id AS ong_id,
        u.id AS adotante_id, u.nome AS adotante_nome, u.email AS adotante_email, u.telefone AS adotante_telefone, u.foto_url AS adotante_foto,
        pa.espaco AS q_espaco, pa.atividade AS q_atividade, pa.tempo AS q_tempo,
        pa.experiencia AS q_experiencia, pa.criancas AS q_criancas, pa.outros_pets AS q_outros_pets
    FROM adocoes a
    INNER JOIN animais an ON an.id = a.animal_id
    INNER JOIN usuarios u ON u.id = a.adotante_id
    LEFT JOIN perfis_adotantes pa ON pa.usuario_id = u.id`;

// "motivos" é guardado como texto JSON; aqui volta a ser uma lista
function tratar(linhas) {
    return linhas.map((l) => {
        if (typeof l.motivos === 'string') {
            try { l.motivos = JSON.parse(l.motivos); } catch (e) { l.motivos = []; }
        }
        if (l.motivos == null) l.motivos = [];
        return l;
    });
}

// Todas as rotas daqui exigem login
router.use(autenticar);

// GET /adocao  -> pedidos da ONG de quem está logado (só a equipe).
// Quem tem ong_id vê apenas os pedidos dos animais da sua ONG; sem ong_id vê todos.
// Filtro opcional: ?status=solicitada
router.get('/', somenteEquipe, async (req, res) => {
    try {
        const ong = await ongDaEquipe(req.usuario.id);
        const filtros = [];
        const valores = [];

        if (req.query.status) {
            filtros.push('a.status = ?');
            valores.push(req.query.status);
        }
        if (ong) {
            filtros.push('an.ong_id = ?');
            valores.push(ong);
        }

        let sql = SELECT_EQUIPE;
        if (filtros.length > 0) sql += ' WHERE ' + filtros.join(' AND ');
        sql += ' ORDER BY a.id DESC';

        const [adocoes] = await db.query(sql, valores);
        res.json({ quantidade: adocoes.length, adocoes: tratar(adocoes) });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao listar as adoções.' });
    }
});

// GET /adocao/minhas  -> pedidos de quem está logado
router.get('/minhas', async (req, res) => {
    try {
        const [adocoes] = await db.query(SELECT_ADOCOES + ' WHERE a.adotante_id = ? ORDER BY a.id DESC', [req.usuario.id]);
        res.json({ quantidade: adocoes.length, adocoes: tratar(adocoes) });
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
        res.json({ quantidade: adocoes.length, adocoes: tratar(adocoes) });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao buscar o histórico.' });
    }
});

// POST /adocao  -> registra um pedido de adoção
// O adotante é quem está logado. (A equipe pode enviar adotante_id para registrar por outra pessoa.)
router.post('/', somenteUsuario, async (req, res) => {
    try {
        const corpo = req.body || {};
        const animal_id = corpo.animal_id;
        const observacoes = corpo.observacoes;
        const adotanteId = req.usuario.id;

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
            "SELECT * FROM animais WHERE id = ? AND status = 'disponivel'",
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

        // calcula a compatibilidade com o questionário do adotante (se ele já respondeu)
        const [perfis] = await db.query('SELECT * FROM perfis_adotantes WHERE usuario_id = ?', [adotanteId]);
        let compatibilidade = null;
        let motivos = null;
        if (perfis.length > 0) {
            const resultadoMatch = calcularMatch(perfis[0], animais[0]);
            compatibilidade = resultadoMatch.pontos;
            motivos = JSON.stringify(resultadoMatch.motivos);
        }

        const sql = `INSERT INTO adocoes (animal_id, adotante_id, status, data_solicitacao, observacoes, compatibilidade, motivos)
                     VALUES (?, ?, 'solicitada', CURDATE(), ?, ?, ?)`;
        const [resultado] = await db.query(sql, [animal_id, adotanteId, observacoes || null, compatibilidade, motivos]);

        res.status(201).json({ mensagem: 'Pedido registrado!', id: resultado.insertId, compatibilidade: compatibilidade });
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

        const [adocoes] = await db.query(
            `SELECT a.animal_id, an.ong_id, an.nome AS animal_nome, an.status AS animal_status
             FROM adocoes a INNER JOIN animais an ON an.id = a.animal_id WHERE a.id = ?`,
            [req.params.id]
        );
        if (adocoes.length === 0) {
            return res.status(404).json({ mensagem: 'Pedido não encontrado.' });
        }
        const animalId = adocoes[0].animal_id;

        // a ONG só decide sobre os pedidos dos seus próprios animais
        const ong = await ongDaEquipe(req.usuario.id);
        if (ong && Number(adocoes[0].ong_id) !== ong) {
            return res.status(403).json({ mensagem: 'Esse pedido é de um animal de outra ONG.' });
        }

        // a decisão continua humana, mas não dá para aprovar o mesmo animal duas vezes
        if (status === 'aprovada') {
            const [outras] = await db.query(
                "SELECT id FROM adocoes WHERE animal_id = ? AND id <> ? AND status IN ('aprovada', 'concluida')",
                [animalId, req.params.id]
            );
            if (outras.length > 0 || adocoes[0].animal_status === 'adotado') {
                return res.status(409).json({ mensagem: 'Este animal já tem um pedido aprovado ou já foi adotado.' });
            }
        }

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

        const acoes = { solicitada: 'reabriu', em_analise: 'iniciou a análise de', aprovada: 'aprovou', recusada: 'recusou', concluida: 'concluiu' };
        await registrar(req.usuario, acoes[status], 'pedido', Number(req.params.id), 'Pedido #' + req.params.id + ' - ' + adocoes[0].animal_nome, adocoes[0].ong_id);
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

        if (!(ehDono && aindaEmAberto)) {
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
