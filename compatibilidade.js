// compatibilidade.js - regra única de compatibilidade adotante x animal
// (usada no PetMatch e também gravada em cada pedido de adoção)

// Compara o perfil do adotante com um animal e devolve a pontuação (0 a 100)
function calcularMatch(adotante, animal) {
    let pontos = 0;
    const motivos = [];

    // Espaço (25 pontos)
    if (adotante.espaco === animal.espaco) {
        pontos += 25;
        motivos.push('Espaço compatível');
    }

    // Atividade do adotante x energia do animal (20 pontos)
    if (adotante.atividade === animal.energia) {
        pontos += 20;
        motivos.push('Nível de atividade compatível');
    }

    // Tempo disponível x atenção que o animal precisa (20 pontos)
    if ((adotante.tempo === 'muito' && animal.atencao === 'muita') ||
        (adotante.tempo === 'pouco' && animal.atencao === 'pouca')) {
        pontos += 20;
        motivos.push('Tempo disponível compatível');
    }

    // Experiência (15 pontos)
    if (adotante.experiencia === animal.experiencia) {
        pontos += 15;
        motivos.push('Experiência compatível');
    }

    // Crianças (10 pontos)
    if (animal.criancas !== null && Boolean(adotante.criancas) === Boolean(animal.criancas)) {
        pontos += 10;
        motivos.push('Compatível com crianças');
    }

    // Outros animais (10 pontos)
    if (animal.outros_pets !== null && Boolean(adotante.outros_pets) === Boolean(animal.outros_pets)) {
        pontos += 10;
        motivos.push('Compatível com outros animais');
    }

    return { pontos: pontos, motivos: motivos };
}

module.exports = { calcularMatch };
