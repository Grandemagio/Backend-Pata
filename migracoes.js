// migracoes.js - cria sozinho, ao ligar a API, o que o banco ainda não tem
const db = require('./db');

async function colunaExiste(tabela, coluna) {
    const [r] = await db.query(
        'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [tabela, coluna]
    );
    return r.length > 0;
}

async function adicionarColuna(tabela, coluna, definicao) {
    if (!(await colunaExiste(tabela, coluna))) {
        await db.query('ALTER TABLE ' + tabela + ' ADD COLUMN ' + coluna + ' ' + definicao);
        console.log('Banco atualizado: ' + tabela + '.' + coluna);
    }
}

async function atualizarBanco() {
    // compatibilidade (0 a 100) e motivos guardados no momento do pedido de adoção
    await adicionarColuna('adocoes', 'compatibilidade', 'TINYINT UNSIGNED NULL');
    await adicionarColuna('adocoes', 'motivos', 'TEXT NULL');

    // ONGs
    await db.query(`CREATE TABLE IF NOT EXISTS ongs (
        id INT NOT NULL AUTO_INCREMENT,
        nome VARCHAR(150) NOT NULL,
        criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) ENGINE=InnoDB`);
    // primeira ONG (troque o nome depois: UPDATE ongs SET nome = '...' WHERE id = 1)
    await db.query("INSERT INTO ongs (nome) SELECT 'ONG Pata Amiga' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM ongs)");

    // foto de perfil de cada conta e logo de cada ONG (campos separados: uma não interfere na outra)
    await adicionarColuna('usuarios', 'foto_url', 'VARCHAR(255) NULL');
    await adicionarColuna('ongs', 'logo_url', 'VARCHAR(255) NULL');

    // doações e mensagens de contato passam a pertencer a uma ONG
    await adicionarColuna('doacoes', 'ong_id', 'INT NULL');
    await adicionarColuna('contatos', 'ong_id', 'INT NULL');

    // histórico: quem (de qual ONG) cadastrou, atualizou, removeu, aprovou...
    await db.query(`CREATE TABLE IF NOT EXISTS historico (
        id INT NOT NULL AUTO_INCREMENT,
        ong_id INT NULL,
        usuario_id INT NULL,
        usuario_nome VARCHAR(120) NULL,
        acao VARCHAR(40) NOT NULL,
        entidade VARCHAR(30) NOT NULL,
        entidade_id INT NULL,
        descricao VARCHAR(255) NULL,
        criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_historico_ong (ong_id, id)
    ) ENGINE=InnoDB`);

    // bate-papo entre usuário e ONG
    await db.query(`CREATE TABLE IF NOT EXISTS conversas (
        id INT NOT NULL AUTO_INCREMENT,
        ong_id INT NOT NULL,
        usuario_id INT NOT NULL,
        animal_id INT NULL,
        criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ultima_msg_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_conversas_usuario (usuario_id),
        KEY idx_conversas_ong (ong_id),
        CONSTRAINT fk_conversas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        CONSTRAINT fk_conversas_animal FOREIGN KEY (animal_id) REFERENCES animais(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`);
    await db.query(`CREATE TABLE IF NOT EXISTS mensagens_chat (
        id INT NOT NULL AUTO_INCREMENT,
        conversa_id INT NOT NULL,
        autor_tipo ENUM('usuario', 'ong') NOT NULL,
        autor_id INT NOT NULL,
        texto VARCHAR(1000) NOT NULL,
        lida BOOLEAN NOT NULL DEFAULT FALSE,
        criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_mensagens_conversa (conversa_id, id),
        CONSTRAINT fk_mensagens_conversa FOREIGN KEY (conversa_id) REFERENCES conversas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    // Enquanto existir UMA só ONG, tudo que ainda não tem dono passa a ser dela
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM ongs');
    if (Number(total) === 1) {
        const [[ong]] = await db.query('SELECT id FROM ongs LIMIT 1');
        for (const tabela of ['animais', 'doacoes', 'contatos']) {
            await db.query('UPDATE ' + tabela + ' SET ong_id = ? WHERE ong_id IS NULL', [ong.id]);
        }
        await db.query("UPDATE usuarios SET ong_id = ? WHERE ong_id IS NULL AND perfil IN ('admin', 'voluntario')", [ong.id]);
    }
}

module.exports = { atualizarBanco };
