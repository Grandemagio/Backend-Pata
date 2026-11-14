// routes/pets.js - animais (tabela "animais")
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const router = express.Router();
const db = require('../db');
const { autenticar, somenteEquipe, ongDaEquipe } = require('../auth');
const { COLUNAS_ANIMAL, formatarAnimal } = require('../util');
const { registrar } = require('../historico');

// Colunas da tabela "animais" que a API aceita receber
const campos = [
    'ong_id', 'nome', 'especie', 'raca', 'sexo', 'porte', 'data_nascimento', 'nascimento_estimado',
    'peso_kg', 'castrado', 'microchip', 'temperamento', 'necessidades_especiais',
    'convive_com_criancas', 'convive_com_animais',
    'espaco', 'energia', 'atencao', 'experiencia', 'sociabilidade',
    'criancas', 'outros_pets', 'foto_url', 'status'
];
const statusPermitidos = ['disponivel', 'reservado', 'adotado', 'indisponivel'];

// Separa do corpo do pedido só os campos que existem na tabela
function pegarCampos(body) {
    const colunas = [];
    const valores = [];

    for (const campo of campos) {
        if (body[campo] !== undefined) {
            colunas.push(campo);
            valores.push(body[campo] === '' ? null : body[campo]);   // texto vazio vira NULL
        }
    }

    // O site chama de "descricao", mas no banco a coluna se chama "historia"
    const descricao = body.descricao !== undefined ? body.descricao : body.historia;
    if (descricao !== undefined) {
        colunas.push('historia');
        valores.push(descricao === '' ? null : descricao);
    }

    return { colunas: colunas, valores: valores };
}

// ---------- Upload de foto (multer) ----------
const pastaUploads = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(pastaUploads, { recursive: true });

const extensoes = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, pastaUploads),
        filename: (req, file, cb) => cb(null, 'animal-' + req.params.id + '-' + Date.now() + extensoes[file.mimetype])
    }),
    limits: { fileSize: 2 * 1024 * 1024 },   // no máximo 2 MB
    fileFilter: (req, file, cb) => {
        const permitido = Boolean(extensoes[file.mimetype]);
        cb(permitido ? null : new Error('TIPO_INVALIDO'), permitido);
    }
});

// ---------- Rotas públicas (qualquer pessoa vê) ----------

// Confere se o animal existe e é da ONG de quem está logado. Se não, já responde o erro e devolve null.
async function animalDaOng(req, res, id) {
    const [r] = await db.query('SELECT id, nome, ong_id FROM animais WHERE id = ?', [id]);
    if (r.length === 0) {
        res.status(404).json({ mensagem: 'Animal não encontrado.' });
        return null;
    }
    const ong = await ongDaEquipe(req.usuario.id);
    if (ong && Number(r[0].ong_id) !== ong) {
        res.status(403).json({ mensagem: 'Este animal pertence a outra ONG.' });
        return null;
    }
    return { animal: r[0], ong: ong };
}

// GET /pets  -> lista os animais. Filtros opcionais na URL:
//   ?status=disponivel  ?especie=Cachorro  ?porte=pequeno  ?faixa=filhote|adulto  ?busca=luna
router.get('/', async (req, res) => {
    try {
        const { status, especie, porte, faixa, busca, ong_id } = req.query;
        const condicoes = [];
        const valores = [];

        if (status) { condicoes.push('a.status = ?'); valores.push(status); }
        if (ong_id) { condicoes.push('a.ong_id = ?'); valores.push(ong_id); }
        if (especie) { condicoes.push('a.especie = ?'); valores.push(especie); }
        if (porte) { condicoes.push('a.porte = ?'); valores.push(porte); }
        if (faixa === 'filhote') { condicoes.push('TIMESTAMPDIFF(MONTH, a.data_nascimento, CURDATE()) < 12'); }
        if (faixa === 'adulto') { condicoes.push('TIMESTAMPDIFF(MONTH, a.data_nascimento, CURDATE()) >= 12'); }
        if (busca) {
            const texto = '%' + busca + '%';
            condicoes.push('(a.nome LIKE ? OR a.especie LIKE ? OR a.raca LIKE ?)');
            valores.push(texto, texto, texto);
        }

        let sql = 'SELECT ' + COLUNAS_ANIMAL + ' FROM animais a';
        if (condicoes.length > 0) {
            sql += ' WHERE ' + condicoes.join(' AND ');
        }
        sql += ' ORDER BY a.id DESC';

        const [animais] = await db.query(sql, valores);
        res.json({ quantidade: animais.length, animais: animais.map(formatarAnimal) });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao listar os animais.' });
    }
});

// GET /pets/:id  -> busca um animal pelo id
router.get('/:id', async (req, res) => {
    try {
        const [animais] = await db.query(
            'SELECT ' + COLUNAS_ANIMAL + ' FROM animais a WHERE a.id = ?',
            [req.params.id]
        );

        if (animais.length === 0) {
            return res.status(404).json({ mensagem: 'Animal não encontrado.' });
        }
        res.json(formatarAnimal(animais[0]));
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao buscar o animal.' });
    }
});

// ---------- Rotas da equipe (precisa de login com perfil admin ou voluntario) ----------

// POST /pets  -> cadastra um animal novo
router.post('/', autenticar, somenteEquipe, async (req, res) => {
    try {
        const body = req.body || {};

        // quem é de uma ONG só cadastra animais da própria ONG
        const ongEquipe = await ongDaEquipe(req.usuario.id);
        if (ongEquipe) body.ong_id = ongEquipe;

        if (!body.nome) {
            return res.status(400).json({ mensagem: 'Informe o nome do animal.' });
        }
        if (body.status && !statusPermitidos.includes(body.status)) {
            return res.status(400).json({ mensagem: 'Status inválido. Use: ' + statusPermitidos.join(', ') });
        }

        const { colunas, valores } = pegarCampos(body);
        const interrogacoes = colunas.map(() => '?').join(', ');
        const sql = 'INSERT INTO animais (' + colunas.join(', ') + ') VALUES (' + interrogacoes + ')';

        const [resultado] = await db.query(sql, valores);
        await registrar(req.usuario, 'cadastrou', 'animal', resultado.insertId, body.nome, body.ong_id);
        res.status(201).json({ mensagem: 'Animal cadastrado!', id: resultado.insertId });
    } catch (erro) {
        console.log(erro);
        res.status(400).json({ mensagem: 'Não foi possível cadastrar. Confira os campos (sexo, porte e status têm valores fixos).' });
    }
});

// PUT /pets/:id  -> atualiza só os campos enviados
router.put('/:id', autenticar, somenteEquipe, async (req, res) => {
    try {
        const body = req.body || {};

        if (body.status && !statusPermitidos.includes(body.status)) {
            return res.status(400).json({ mensagem: 'Status inválido. Use: ' + statusPermitidos.join(', ') });
        }

        const dono = await animalDaOng(req, res, req.params.id);
        if (!dono) return;
        if (dono.ong) delete body.ong_id;   // a ONG não passa o animal para outra

        const { colunas, valores } = pegarCampos(body);
        if (colunas.length === 0) {
            return res.status(400).json({ mensagem: 'Informe ao menos um campo para atualizar.' });
        }

        const sql = 'UPDATE animais SET ' + colunas.map((c) => c + ' = ?').join(', ') + ' WHERE id = ?';
        valores.push(req.params.id);

        const [resultado] = await db.query(sql, valores);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Animal não encontrado.' });
        }
        await registrar(req.usuario, 'atualizou', 'animal', Number(req.params.id), dono.animal.nome, dono.animal.ong_id);
        res.json({ mensagem: 'Animal atualizado!' });
    } catch (erro) {
        console.log(erro);
        res.status(400).json({ mensagem: 'Não foi possível atualizar o animal.' });
    }
});

// POST /pets/:id/foto  -> envia a foto do animal (formulário com um arquivo no campo "foto")
router.post('/:id/foto', autenticar, somenteEquipe, (req, res) => {
    upload.single('foto')(req, res, async (erroUpload) => {
        if (erroUpload) {
            let mensagem = 'Não foi possível enviar a foto.';
            if (erroUpload.code === 'LIMIT_FILE_SIZE') mensagem = 'A foto pode ter no máximo 2 MB.';
            if (erroUpload.message === 'TIPO_INVALIDO') mensagem = 'Envie uma imagem JPG, PNG ou WEBP.';
            return res.status(400).json({ mensagem: mensagem });
        }
        if (!req.file) {
            return res.status(400).json({ mensagem: 'Envie a imagem no campo "foto".' });
        }

        try {
            const dono = await animalDaOng(req, res, req.params.id);
            if (!dono) {
                fs.unlink(req.file.path, () => {});
                return;
            }
            const caminho = '/uploads/' + req.file.filename;
            const [resultado] = await db.query('UPDATE animais SET foto_url = ? WHERE id = ?', [caminho, req.params.id]);

            if (resultado.affectedRows === 0) {
                fs.unlink(req.file.path, () => {});   // animal não existe: apaga a foto enviada
                return res.status(404).json({ mensagem: 'Animal não encontrado.' });
            }
            await registrar(req.usuario, 'atualizou a foto de', 'animal', Number(req.params.id), dono.animal.nome, dono.animal.ong_id);
            res.json({ mensagem: 'Foto salva!', foto_url: caminho });
        } catch (erro) {
            console.log(erro);
            res.status(500).json({ mensagem: 'Erro ao salvar a foto.' });
        }
    });
});

// DELETE /pets/:id  -> remove um animal
router.delete('/:id', autenticar, somenteEquipe, async (req, res) => {
    try {
        const dono = await animalDaOng(req, res, req.params.id);
        if (!dono) return;

        await db.query('DELETE FROM animais WHERE id = ?', [req.params.id]);
        await registrar(req.usuario, 'removeu', 'animal', Number(req.params.id), dono.animal.nome, dono.animal.ong_id);
        res.json({ mensagem: 'Animal removido!' });
    } catch (erro) {
        // O banco não deixa apagar um animal que já tem pedido de adoção
        if (erro.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ mensagem: 'Esse animal tem pedidos de adoção. Mude o status para "indisponivel" em vez de remover.' });
        }
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao remover o animal.' });
    }
});

module.exports = router;
