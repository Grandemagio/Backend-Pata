// routes/match.js - calcula a compatibilidade entre um adotante e os animais
const express = require('express');
const router = express.Router();
const db = require('../db');
const { autenticar, donoOuEquipe } = require('../auth');
const { COLUNAS_ANIMAL, formatarAnimal } = require('../util');

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

// GET /match/adotante/:usuario_id  -> animais disponíveis, do mais ao menos compatível
router.get('/adotante/:usuario_id', autenticar, async (req, res) => {
    try {
        if (!donoOuEquipe(req, req.params.usuario_id)) {
            return res.status(403).json({ mensagem: 'Você só pode ver o seu próprio match.' });
        }

        // 1) busca o perfil do adotante
        const [perfis] = await db.query(
            'SELECT * FROM perfis_adotantes WHERE usuario_id = ?',
            [req.params.usuario_id]
        );
        if (perfis.length === 0) {
            return res.status(404).json({ mensagem: 'Perfil do adotante não encontrado.' });
        }
        const adotante = perfis[0];

        // 2) busca os animais disponíveis
        const [animais] = await db.query(
            'SELECT ' + COLUNAS_ANIMAL + " FROM animais a WHERE a.status = 'disponivel'"
        );

        // 3) calcula a pontuação de cada animal
        const lista = [];
        for (const animal of animais) {
            const resultado = calcularMatch(adotante, animal);
            lista.push({
                ...formatarAnimal(animal),
                compatibilidade: resultado.pontos,
                motivos: resultado.motivos
            });
        }

        // 4) ordena do maior para o menor
        lista.sort((a, b) => b.compatibilidade - a.compatibilidade);

        res.json({ quantidade: lista.length, animais: lista });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ mensagem: 'Erro ao calcular a compatibilidade.' });
    }
});

module.exports = router;
