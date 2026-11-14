// routes/favoritos.js - animais favoritados pelo usuário (tabela "favoritos")
const express = require('express');
const router = express.Router();
const db = require('../db');
const { autenticar, somenteUsuario } = require('../auth');
const { COLUNAS_ANIMAL, formatarAnimal } = require('../util');

// Todas as rotas daqui exigem login
router.use(autenticar, somenteUsuario);

// GET /favoritos  -> lista os animais favoritos de quem está logado
router.get('/', async (req, res) => {
    try {
        const sql = 'SELECT ' + COLUNAS_ANIMAL + ` FROM favoritos f
                     INNER JOIN animais a ON a.id = f.animal_id
                     WHERE f.usuario_id = ?
                     ORDER BY f.criado_em DESC`;
        const [animais] = await db.query(sql, [req.usuario.id]);
        res.json({ quantidade: animais.length, animais: animais.map(formatarAnimal) });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao listar os favoritos.' });
    }
});

// POST /favoritos/:animal_id  -> favorita um animal
router.post('/:animal_id', async (req, res) => {
    try {
        const [animais] = await db.query('SELECT id FROM animais WHERE id = ?', [req.params.animal_id]);
        if (animais.length === 0) {
            return res.status(404).json({ mensagem: 'Animal não encontrado.' });
        }

        // INSERT IGNORE: se já era favorito, não dá erro
        await db.query('INSERT IGNORE INTO favoritos (usuario_id, animal_id) VALUES (?, ?)',
            [req.usuario.id, req.params.animal_id]);
        res.status(201).json({ mensagem: 'Animal favoritado!' });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao favoritar o animal.' });
    }
});

// DELETE /favoritos/:animal_id  -> tira dos favoritos
router.delete('/:animal_id', async (req, res) => {
    try {
        await db.query('DELETE FROM favoritos WHERE usuario_id = ? AND animal_id = ?',
            [req.usuario.id, req.params.animal_id]);
        res.json({ mensagem: 'Animal removido dos favoritos.' });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao remover o favorito.' });
    }
});

module.exports = router;
