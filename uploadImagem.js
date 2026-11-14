// uploadImagem.js - envio de imagens de perfil (usuário) e logo (ONG)
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const pasta = path.join(__dirname, 'uploads');
fs.mkdirSync(pasta, { recursive: true });

const extensoes = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// criarUpload('perfil', (req) => req.usuario.id)  -> arquivos "perfil-<id>-<data>.jpg"
function criarUpload(prefixo, idDe) {
    return multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, pasta),
            filename: (req, file, cb) => cb(null, prefixo + '-' + idDe(req) + '-' + Date.now() + extensoes[file.mimetype])
        }),
        limits: { fileSize: 2 * 1024 * 1024 },   // no máximo 2 MB
        fileFilter: (req, file, cb) => {
            const permitido = Boolean(extensoes[file.mimetype]);
            cb(permitido ? null : new Error('TIPO_INVALIDO'), permitido);
        }
    });
}

// Apaga a imagem antiga, mas só se for de perfil ou de ONG (nunca foto de animal)
function apagarImagemAntiga(caminho) {
    if (caminho && /^\/uploads\/(perfil|ong)-/.test(caminho)) {
        fs.unlink(path.join(pasta, path.basename(caminho)), () => {});
    }
}

function mensagemErroUpload(erro) {
    if (erro.code === 'LIMIT_FILE_SIZE') return 'A imagem pode ter no máximo 2 MB.';
    if (erro.message === 'TIPO_INVALIDO') return 'Envie uma imagem JPG, PNG ou WEBP.';
    return 'Não foi possível enviar a imagem.';
}

module.exports = { criarUpload, apagarImagemAntiga, mensagemErroUpload };
