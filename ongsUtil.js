// ongsUtil.js - descobre para qual ONG vai uma doação ou mensagem
const db = require('./db');

// Devolve { id } (pode ser null se não há ONGs) ou { erro } com o texto para o usuário.
// Se só existe uma ONG e nenhuma foi escolhida, usa essa.
async function resolverOngDestino(ongIdEnviado) {
    if (ongIdEnviado !== undefined && ongIdEnviado !== null && ongIdEnviado !== '') {
        const [r] = await db.query('SELECT id FROM ongs WHERE id = ?', [ongIdEnviado]);
        return r.length ? { id: r[0].id } : { erro: 'ONG não encontrada.' };
    }
    const [todas] = await db.query('SELECT id FROM ongs');
    if (todas.length === 1) return { id: todas[0].id };
    if (todas.length === 0) return { id: null };
    return { erro: 'Escolha para qual ONG vai.' };
}

module.exports = { resolverOngDestino };
