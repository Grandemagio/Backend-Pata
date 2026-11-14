-- admins.sql
-- Cria a tabela "admins": o cadastro da equipe que administra a ONG.
-- O LOGIN continua na tabela "usuarios" (e-mail + senha_hash + perfil), que é
-- o que a API usa. Esta tabela guarda os dados extras da equipe e liga cada
-- admin ao seu usuário.
-- Execute DEPOIS do banco.sql e do atualizacao-banco.sql. Pode rodar mais de uma vez.
USE ong_protecao_animal;

CREATE TABLE IF NOT EXISTS admins (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,                       -- conta de login do admin
    ong_id INT NULL,                               -- ONG que ele administra (opcional)
    cargo VARCHAR(80) NOT NULL DEFAULT 'Administrador',
    nivel ENUM('admin', 'voluntario') NOT NULL DEFAULT 'admin',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,           -- FALSE = acesso suspenso, sem apagar o histórico
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_admins_usuario (usuario_id),     -- um usuário só aparece uma vez
    KEY idx_admins_ong (ong_id),
    CONSTRAINT fk_admins_usuario
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- COMO CRIAR O PRIMEIRO ADMIN
-- 1) Cadastre a conta pela API (gera a senha criptografada):
--      POST http://localhost:3001/usuarios/registro
--      { "nome": "Seu Nome", "email": "voce@email.com", "senha": "suasenha" }
-- 2) Troque TROQUE_PELO_EMAIL abaixo pelo e-mail cadastrado e rode as duas linhas:

UPDATE usuarios SET perfil = 'admin' WHERE email = 'TROQUE_PELO_EMAIL';

INSERT IGNORE INTO admins (usuario_id)
SELECT id FROM usuarios WHERE email = 'TROQUE_PELO_EMAIL';

-- Conferir quem é admin:
-- SELECT a.id, u.nome, u.email, a.cargo, a.nivel, a.ativo
-- FROM admins a INNER JOIN usuarios u ON u.id = a.usuario_id;
