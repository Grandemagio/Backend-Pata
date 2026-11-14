-- PetMatch / PataAmiga - script reconstruído para desenvolvimento
-- ATENÇÃO:
-- 1. Este arquivo é uma reconstrução baseada na estrutura discutida; não é uma cópia
--    exata do antigo banco_completo-adaptado.sql.
-- 2. Não apaga tabelas existentes. Faça backup antes de executar em um banco já usado.
-- 3. Ajuste nomes/tipos de colunas conforme o projeto real, se necessário.

CREATE DATABASE IF NOT EXISTS ong_protecao_animal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ong_protecao_animal;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT NOT NULL AUTO_INCREMENT,
    ong_id INT NULL,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    telefone VARCHAR(20) NULL,
    perfil ENUM('admin', 'voluntario', 'adotante', 'padrinho', 'doador') NOT NULL DEFAULT 'adotante',
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS animais (
    id INT NOT NULL AUTO_INCREMENT,
    ong_id INT NULL,
    nome VARCHAR(120) NOT NULL,
    especie VARCHAR(80) NULL,
    raca VARCHAR(100) NULL,
    sexo ENUM('macho', 'femea', 'indefinido') NOT NULL DEFAULT 'indefinido',
    porte ENUM('mini', 'pequeno', 'medio', 'grande', 'gigante') NULL,
    data_nascimento DATE NULL,
    nascimento_estimado BOOLEAN NOT NULL DEFAULT FALSE,
    peso_kg DECIMAL(6,2) NULL,
    castrado BOOLEAN NOT NULL DEFAULT FALSE,
    microchip VARCHAR(100) NULL,
    temperamento TEXT NULL,
    convive_com_criancas BOOLEAN NULL,
    convive_com_animais BOOLEAN NULL,
    necessidades_especiais TEXT NULL,
    historia TEXT NULL,
    espaco VARCHAR(40) NULL,
    energia VARCHAR(40) NULL,
    atencao VARCHAR(40) NULL,
    experiencia VARCHAR(40) NULL,
    sociabilidade VARCHAR(40) NULL,
    criancas BOOLEAN NULL,
    outros_pets BOOLEAN NULL,
    status ENUM('disponivel', 'reservado', 'adotado', 'indisponivel') NOT NULL DEFAULT 'disponivel',
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_animais_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS perfis_adotantes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    espaco VARCHAR(40) NOT NULL,
    atividade VARCHAR(40) NOT NULL,
    tempo VARCHAR(40) NOT NULL,
    experiencia VARCHAR(40) NOT NULL,
    criancas BOOLEAN NOT NULL DEFAULT FALSE,
    outros_pets BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_perfis_adotantes_usuario (usuario_id),
    CONSTRAINT fk_perfis_adotantes_usuario
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS adocoes (
    id INT NOT NULL AUTO_INCREMENT,
    animal_id INT NOT NULL,
    adotante_id INT NOT NULL,
    status ENUM('solicitada', 'em_analise', 'aprovada', 'recusada', 'concluida') NOT NULL DEFAULT 'solicitada',
    data_solicitacao DATE NOT NULL DEFAULT (CURRENT_DATE),
    data_conclusao DATE NULL,
    observacoes TEXT NULL,
    compatibilidade TINYINT UNSIGNED NULL,   -- % de match no momento do pedido
    motivos TEXT NULL,                       -- motivos do match (JSON)
    PRIMARY KEY (id),
    KEY idx_adocoes_adotante (adotante_id),
    KEY idx_adocoes_animal (animal_id),
    CONSTRAINT fk_adocoes_animal
      FOREIGN KEY (animal_id) REFERENCES animais(id),
    CONSTRAINT fk_adocoes_adotante
      FOREIGN KEY (adotante_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- Dados de exemplo opcionais:
-- Cadastre usuários pelo endpoint POST /usuarios/registro para gerar senha_hash
-- corretamente com bcrypt. Não insira senhas em texto puro nesta tabela.
-- Exemplo de animal:
-- INSERT INTO animais (nome, especie, porte, energia, atencao, espaco, status)
-- VALUES ('Thor', 'Cachorro', 'grande', 'alta', 'muita', 'casa_grande', 'disponivel');
