// routes/chat.js - bate-papo entre um usuário (adotante) e uma ONG
// Tabelas: "conversas" (usuário + ONG + animal opcional) e "mensagens_chat".
const express = require('express');
const router = express.Router();
const db = require('../db');
const { autenticar, ehEquipe, ongDaEquipe, somenteUsuario } = require('../auth');
const { resolverOngDestino } = require('../ongsUtil');

const MAX_TEXTO = 1000;

router.use(autenticar);

// Carrega a conversa e confere se quem está logado participa dela.
// Se não pode, já responde o erro e devolve null.
async function conversaPermitida(req, res, id) {
    const [r] = await db.query('SELECT * FROM conversas WHERE id = ?', [id]);
    if (r.length === 0) {
        res.status(404).json({ mensagem: 'Conversa não encontrada.' });
        return null;
    }
    const conversa = r[0];
    if (ehEquipe(req.usuario)) {
        const ong = await ongDaEquipe(req.usuario.id);
        if (ong && Number(conversa.ong_id) !== ong) {
            res.status(403).json({ mensagem: 'Essa conversa é de outra ONG.' });
            return null;
        }
    } else if (Number(conversa.usuario_id) !== Number(req.usuario.id)) {
        res.status(403).json({ mensagem: 'Essa conversa não é sua.' });
        return null;
    }
    return conversa;
}

// Valida o texto de uma mensagem (devolve o texto limpo ou responde o erro)
function textoValido(req, res) {
    const texto = String((req.body || {}).texto || '').trim();
    if (!texto) {
        res.status(400).json({ mensagem: 'Escreva uma mensagem.' });
        return null;
    }
    if (texto.length > MAX_TEXTO) {
        res.status(400).json({ mensagem: 'A mensagem pode ter no máximo ' + MAX_TEXTO + ' caracteres.' });
        return null;
    }
    return texto;
}

// GET /chat/nao-lidas  -> quantas mensagens novas existem (para o número no menu)
router.get('/nao-lidas', async (req, res) => {
    try {
        let sql;
        const valores = [];
        if (ehEquipe(req.usuario)) {
            const ong = await ongDaEquipe(req.usuario.id);
            sql = "SELECT COUNT(*) AS total FROM mensagens_chat m INNER JOIN conversas c ON c.id = m.conversa_id WHERE m.autor_tipo = 'usuario' AND m.lida = 0";
            if (ong) { sql += ' AND c.ong_id = ?'; valores.push(ong); }
        } else {
            sql = "SELECT COUNT(*) AS total FROM mensagens_chat m INNER JOIN conversas c ON c.id = m.conversa_id WHERE m.autor_tipo = 'ong' AND m.lida = 0 AND c.usuario_id = ?";
            valores.push(req.usuario.id);
        }
        const [r] = await db.query(sql, valores);
        res.json({ total: Number(r[0].total) });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao contar as mensagens.' });
    }
});

// GET /chat/conversas  -> minhas conversas (usuário) ou conversas da minha ONG (equipe)
router.get('/conversas', async (req, res) => {
    try {
        const equipe = ehEquipe(req.usuario);
        const outroLado = equipe ? 'usuario' : 'ong';   // quem escreve para mim
        const valores = [];

        let sql = `SELECT c.id, c.ong_id, c.usuario_id, c.animal_id, c.ultima_msg_em,
                          o.nome AS ong_nome, o.logo_url AS ong_logo, u.nome AS usuario_nome, u.foto_url AS usuario_foto,
                          an.nome AS animal_nome, an.foto_url AS animal_foto,
                          (SELECT texto FROM mensagens_chat WHERE conversa_id = c.id ORDER BY id DESC LIMIT 1) AS ultima_texto,
                          (SELECT COUNT(*) FROM mensagens_chat WHERE conversa_id = c.id AND autor_tipo = '${outroLado}' AND lida = 0) AS nao_lidas
                   FROM conversas c
                   LEFT JOIN ongs o ON o.id = c.ong_id
                   INNER JOIN usuarios u ON u.id = c.usuario_id
                   LEFT JOIN animais an ON an.id = c.animal_id`;

        if (equipe) {
            const ong = await ongDaEquipe(req.usuario.id);
            if (ong) { sql += ' WHERE c.ong_id = ?'; valores.push(ong); }
        } else {
            sql += ' WHERE c.usuario_id = ?';
            valores.push(req.usuario.id);
        }
        sql += ' ORDER BY c.ultima_msg_em DESC';

        const [conversas] = await db.query(sql, valores);
        res.json({ quantidade: conversas.length, conversas: conversas });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao listar as conversas.' });
    }
});

// POST /chat/conversas  -> o usuário começa (ou retoma) uma conversa com a ONG
// Corpo: { texto, animal_id? (a ONG vem do animal), ong_id? (se não houver animal) }
router.post('/conversas', somenteUsuario, async (req, res) => {
    try {
        const texto = textoValido(req, res);
        if (texto === null) return;
        const b = req.body || {};

        let ongId = null;
        let animalId = null;
        if (b.animal_id) {
            const [animais] = await db.query('SELECT id, ong_id FROM animais WHERE id = ?', [b.animal_id]);
            if (animais.length === 0) {
                return res.status(404).json({ mensagem: 'Animal não encontrado.' });
            }
            animalId = animais[0].id;
            ongId = animais[0].ong_id;
        }
        if (!ongId) {
            const destino = await resolverOngDestino(b.ong_id);
            if (destino.erro) return res.status(400).json({ mensagem: destino.erro });
            ongId = destino.id;
        }
        if (!ongId) {
            return res.status(400).json({ mensagem: 'Nenhuma ONG disponível para conversar.' });
        }

        // já existe conversa com essa ONG sobre esse animal? então continua nela
        const [existentes] = await db.query(
            'SELECT id FROM conversas WHERE usuario_id = ? AND ong_id = ? AND animal_id <=> ?',
            [req.usuario.id, ongId, animalId]
        );
        let conversaId;
        if (existentes.length > 0) {
            conversaId = existentes[0].id;
        } else {
            const [nova] = await db.query(
                'INSERT INTO conversas (ong_id, usuario_id, animal_id) VALUES (?, ?, ?)',
                [ongId, req.usuario.id, animalId]
            );
            conversaId = nova.insertId;
        }

        await db.query(
            "INSERT INTO mensagens_chat (conversa_id, autor_tipo, autor_id, texto) VALUES (?, 'usuario', ?, ?)",
            [conversaId, req.usuario.id, texto]
        );
        await db.query('UPDATE conversas SET ultima_msg_em = NOW() WHERE id = ?', [conversaId]);

        res.status(201).json({ mensagem: 'Mensagem enviada!', conversa_id: conversaId });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao iniciar a conversa.' });
    }
});

// GET /chat/conversas/:id/mensagens  -> mensagens da conversa (e marca as recebidas como lidas)
// Opcional: ?depois=ID  devolve só as mensagens mais novas que esse id (para atualizar a tela)
router.get('/conversas/:id/mensagens', async (req, res) => {
    try {
        const conversa = await conversaPermitida(req, res, req.params.id);
        if (!conversa) return;

        const depois = Number(req.query.depois) || 0;
        const [mensagens] = await db.query(
            `SELECT m.id, m.autor_tipo, m.autor_id, m.texto, m.lida, m.criado_em, u.nome AS autor_nome
             FROM mensagens_chat m LEFT JOIN usuarios u ON u.id = m.autor_id
             WHERE m.conversa_id = ? AND m.id > ? ORDER BY m.id ASC LIMIT 200`,
            [conversa.id, depois]
        );

        const outroLado = ehEquipe(req.usuario) ? 'usuario' : 'ong';
        await db.query('UPDATE mensagens_chat SET lida = TRUE WHERE conversa_id = ? AND autor_tipo = ? AND lida = FALSE', [conversa.id, outroLado]);

        res.json({ quantidade: mensagens.length, mensagens: mensagens });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao buscar as mensagens.' });
    }
});

// POST /chat/conversas/:id/mensagens  -> envia uma mensagem (usuário ou ONG)
router.post('/conversas/:id/mensagens', async (req, res) => {
    try {
        const conversa = await conversaPermitida(req, res, req.params.id);
        if (!conversa) return;
        const texto = textoValido(req, res);
        if (texto === null) return;

        const autorTipo = ehEquipe(req.usuario) ? 'ong' : 'usuario';
        const [r] = await db.query(
            'INSERT INTO mensagens_chat (conversa_id, autor_tipo, autor_id, texto) VALUES (?, ?, ?, ?)',
            [conversa.id, autorTipo, req.usuario.id, texto]
        );
        await db.query('UPDATE conversas SET ultima_msg_em = NOW() WHERE id = ?', [conversa.id]);

        res.status(201).json({ mensagem: 'Mensagem enviada!', id: r.insertId });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao enviar a mensagem.' });
    }
});

module.exports = router;
