-- atualizacao-banco.sql
-- Acrescenta ao banco do projeto o que a API nova precisa:
--   1) coluna foto_url na tabela animais
--   2) tabela favoritos
--   3) tabela doacoes
--   4) tabela contatos
-- Execute UMA vez, DEPOIS do banco.sql. (Rodar de novo dá erro "Duplicate column" na foto_url.)
USE ong_protecao_animal;

-- 1) foto do animal (caminho da imagem, ex.: /assets/image-animais/luna.png ou /uploads/animal-1.jpg)
ALTER TABLE animais ADD COLUMN foto_url VARCHAR(255) NULL AFTER historia;

-- 2) animais favoritados por cada usuário
CREATE TABLE IF NOT EXISTS favoritos (
    usuario_id INT NOT NULL,
    animal_id INT NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, animal_id),
    CONSTRAINT fk_favoritos_usuario
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_favoritos_animal
      FOREIGN KEY (animal_id) REFERENCES animais(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3) doações (usuario_id fica vazio quando a pessoa doa sem ter conta)
CREATE TABLE IF NOT EXISTS doacoes (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NULL,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL,
    tipo ENUM('dinheiro', 'alimento', 'medicamento', 'outro') NOT NULL DEFAULT 'dinheiro',
    valor DECIMAL(10,2) NULL,
    mensagem TEXT NULL,
    status ENUM('pendente', 'confirmada', 'cancelada') NOT NULL DEFAULT 'pendente',
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_doacoes_usuario (usuario_id),
    CONSTRAINT fk_doacoes_usuario
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 4) mensagens do formulário de contato
CREATE TABLE IF NOT EXISTS contatos (
    id INT NOT NULL AUTO_INCREMENT,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL,
    assunto VARCHAR(150) NULL,
    mensagem TEXT NOT NULL,
    lido BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB;
