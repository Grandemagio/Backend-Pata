// auth.js - login com token (JWT) e controle de quem pode fazer o quê
require('dotenv').config();
const jwt = require('jsonwebtoken');
const db = require('./db');

// O segredo é usado para "assinar" os tokens. Fica no .env, nunca no código.
if (!process.env.JWT_SECRET) {
    console.log('ERRO: falta a linha JWT_SECRET no arquivo .env (veja o .env.example).');
    process.exit(1);
}
const SEGREDO = process.env.JWT_SECRET;

// Perfis que podem administrar a ONG (cadastrar animais, aprovar adoções...)
const perfisEquipe = ['admin', 'voluntario'];

// Cria o token que o site guarda depois do login (vale por 7 dias)
function gerarToken(usuario) {
    return jwt.sign(
        { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil },
        SEGREDO,
        { expiresIn: '7d' }
    );
}

// Lê o token enviado no cabeçalho "Authorization: Bearer <token>"
function lerToken(req) {
    const cabecalho = req.headers.authorization || '';
    const partes = cabecalho.split(' ');

    if (partes[0] !== 'Bearer' || !partes[1]) {
        return null;
    }
    try {
        return jwt.verify(partes[1], SEGREDO);
    } catch (erro) {
        return null;   // token falso ou vencido
    }
}

// Exige login. Se estiver ok, guarda os dados em req.usuario
function autenticar(req, res, next) {
    const dados = lerToken(req);
    if (!dados) {
        return res.status(401).json({ mensagem: 'Faça login para continuar.' });
    }
    req.usuario = dados;
    next();
}

// Login opcional: se tiver token, preenche req.usuario; se não, segue sem ele
function autenticarOpcional(req, res, next) {
    req.usuario = lerToken(req);
    next();
}

function ehEquipe(usuario) {
    return Boolean(usuario) && perfisEquipe.includes(usuario.perfil);
}

// Exige que o usuário seja da equipe (use depois do "autenticar")
function somenteEquipe(req, res, next) {
    if (!ehEquipe(req.usuario)) {
        return res.status(403).json({ mensagem: 'Acesso permitido só para a equipe da ONG.' });
    }
    next();
}

// ONG da pessoa da equipe (usuarios.ong_id). Sem ONG (null) = administra a plataforma toda.
async function ongDaEquipe(usuarioId) {
    const [r] = await db.query('SELECT ong_id FROM usuarios WHERE id = ?', [usuarioId]);
    return r.length && r[0].ong_id ? Number(r[0].ong_id) : null;
}

// Funções de adotante (pedir adoção, favoritos, match) não valem para contas da ONG
function somenteUsuario(req, res, next) {
    if (ehEquipe(req.usuario)) {
        return res.status(403).json({ mensagem: 'Contas da ONG não usam as funções de adotante.' });
    }
    next();
}

// A própria pessoa ou a equipe podem mexer nos dados daquele usuário
function donoOuEquipe(req, usuarioId) {
    return Number(req.usuario.id) === Number(usuarioId) || ehEquipe(req.usuario);
}

module.exports = { gerarToken, autenticar, autenticarOpcional, somenteEquipe, ehEquipe, donoOuEquipe, ongDaEquipe, somenteUsuario };
