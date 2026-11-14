// routes/ongs.js - lista de ONGs e a ONG de quem está logado
const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const { autenticar, somenteEquipe, ongDaEquipe } = require('../auth');
const { registrar } = require('../historico');
const { criarUpload, apagarImagemAntiga, mensagemErroUpload } = require('../uploadImagem');

// guarda em req.ongId a ONG de quem está logado (conta sem ONG não tem logo para trocar)
async function exigirOng(req, res, next) {
    try {
        const ong = await ongDaEquipe(req.usuario.id);
        if (!ong) return res.status(400).json({ mensagem: 'Sua conta não está ligada a uma ONG.' });
        req.ongId = ong;
        next();
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao identificar a ONG.' });
    }
}
const uploadLogo = criarUpload('ong', (req) => req.ongId);

// GET /ongs  -> lista pública (usada em Doar, Contato e no cadastro da equipe)
router.get('/', async (req, res) => {
    try {
        const [ongs] = await db.query('SELECT id, nome, logo_url FROM ongs ORDER BY nome');
        res.json({ quantidade: ongs.length, ongs: ongs });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao listar as ONGs.' });
    }
});

// GET /ongs/minha  -> a ONG de quem é da equipe
router.get('/minha', autenticar, somenteEquipe, async (req, res) => {
    try {
        const ongId = await ongDaEquipe(req.usuario.id);
        if (!ongId) return res.json({ id: null, nome: 'Administração geral' });
        const [r] = await db.query('SELECT id, nome, logo_url FROM ongs WHERE id = ?', [ongId]);
        res.json(r[0] || { id: ongId, nome: 'ONG #' + ongId });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao buscar a ONG.' });
    }
});

// POST /ongs/minha/logo  -> troca a logo da ONG de quem está logado (campo "logo")
router.post('/minha/logo', autenticar, somenteEquipe, exigirOng, (req, res) => {
    uploadLogo.single('logo')(req, res, async (erroUpload) => {
        if (erroUpload) return res.status(400).json({ mensagem: mensagemErroUpload(erroUpload) });
        if (!req.file) return res.status(400).json({ mensagem: 'Envie a imagem no campo "logo".' });

        try {
            const [atual] = await db.query('SELECT nome, logo_url FROM ongs WHERE id = ?', [req.ongId]);
            if (atual.length === 0) {
                fs.unlink(req.file.path, () => {});
                return res.status(404).json({ mensagem: 'ONG não encontrada.' });
            }
            const caminho = '/uploads/' + req.file.filename;
            await db.query('UPDATE ongs SET logo_url = ? WHERE id = ?', [caminho, req.ongId]);
            apagarImagemAntiga(atual[0].logo_url);
            await registrar(req.usuario, 'atualizou a logo da', 'ong', req.ongId, atual[0].nome, req.ongId);
            res.json({ mensagem: 'Logo salva!', logo_url: caminho });
        } catch (erro) {
            fs.unlink(req.file.path, () => {});
            console.log(erro);
            res.status(500).json({ mensagem: 'Erro ao salvar a logo.' });
        }
    });
});

// DELETE /ongs/minha/logo  -> remove a logo da ONG
router.delete('/minha/logo', autenticar, somenteEquipe, exigirOng, async (req, res) => {
    try {
        const [atual] = await db.query('SELECT nome, logo_url FROM ongs WHERE id = ?', [req.ongId]);
        await db.query('UPDATE ongs SET logo_url = NULL WHERE id = ?', [req.ongId]);
        if (atual.length) {
            apagarImagemAntiga(atual[0].logo_url);
            await registrar(req.usuario, 'removeu a logo da', 'ong', req.ongId, atual[0].nome, req.ongId);
        }
        res.json({ mensagem: 'Logo removida.' });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao remover a logo.' });
    }
});

module.exports = router;
