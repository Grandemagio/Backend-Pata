// historico.js - registra quem (de qual ONG) fez cada ação importante
const db = require('./db');
const { ongDaEquipe } = require('./auth');

// registrar(req.usuario, 'cadastrou', 'animal', id, 'Thor', ongIdDoAnimal)
async function registrar(usuario, acao, entidade, entidadeId, descricao, ongId) {
    try {
        const ong = (ongId !== undefined && ongId !== null) ? ongId : await ongDaEquipe(usuario.id);
        await db.query(
            'INSERT INTO historico (ong_id, usuario_id, usuario_nome, acao, entidade, entidade_id, descricao) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [ong || null, usuario.id, usuario.nome || null, acao, entidade, entidadeId || null, descricao ? String(descricao).slice(0, 255) : null]
        );
    } catch (erro) {
        console.log('Aviso: não foi possível gravar o histórico: ' + erro.message);
    }
}

module.exports = { registrar };
