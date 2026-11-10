// util.js - funções pequenas usadas por várias rotas

// Colunas dos animais + a idade em meses (calculada pelo banco a partir da data de nascimento).
// Use sempre com a tabela apelidada de "a":  SELECT ${COLUNAS_ANIMAL} FROM animais a
const COLUNAS_ANIMAL = 'a.*, TIMESTAMPDIFF(MONTH, a.data_nascimento, CURDATE()) AS idade_meses';

const portes = { mini: 'Mini', pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande', gigante: 'Gigante' };

// 3 -> "3 meses", 14 -> "1 ano", 50 -> "4 anos"
function textoIdade(meses) {
    if (meses === null || meses === undefined) return null;
    if (meses < 1) return 'menos de 1 mês';
    if (meses < 12) return meses + (meses === 1 ? ' mês' : ' meses');
    const anos = Math.floor(meses / 12);
    return anos + (anos === 1 ? ' ano' : ' anos');
}

// Deixa o animal pronto para o site: acrescenta tipo, idade escrita, faixa etária etc.
function formatarAnimal(a) {
    const especie = a.especie || '';
    const ehGata = especie.toLowerCase() === 'gato' && a.sexo === 'femea';
    const semIdade = a.idade_meses === null || a.idade_meses === undefined;

    return {
        ...a,
        descricao: a.historia,                          // o site chama a "historia" de "descricao"
        tipo: ehGata ? 'Gata' : especie,
        porte_label: portes[a.porte] || null,
        idade: textoIdade(a.idade_meses),
        faixa_etaria: semIdade ? null : (a.idade_meses < 12 ? 'Filhote' : 'Adulto')
    };
}

function emailValido(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = { COLUNAS_ANIMAL, formatarAnimal, emailValido };
