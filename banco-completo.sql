-- Pata Amiga: banco completo (tabelas + animais de exemplo + admins).
-- Pode ser executado inteiro, mais de uma vez: nada é apagado nem duplicado.

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
    foto_url VARCHAR(255) NULL,
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


-- ---- parte 2: tabelas extras (favoritos, doacoes, contatos) ----
-- Acrescenta ao banco do projeto o que a API nova precisa:
--   tabelas favoritos, doacoes e contatos
USE ong_protecao_animal;

-- 1) a coluna foto_url já é criada na tabela animais, lá em cima

-- animais favoritados por cada usuário
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

-- doações (usuario_id fica vazio quando a pessoa doa sem ter conta)
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

-- mensagens do formulário de contato
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


-- dados-exemplo.sql - os 8 animais que já aparecem na página "Adotar" do site
-- Execute DEPOIS do banco.sql e do atualizacao-banco.sql.
-- As fotos são as da pasta public/assets/image-animais do front-end.
USE ong_protecao_animal;

-- (Opcional) Se você ainda tem os animais de teste antigos (Thor, Luna e Rex) e quer começar limpo,
-- tire os dois "--" das linhas abaixo antes de executar:
-- DELETE FROM adocoes;
-- DELETE FROM animais;

INSERT INTO animais
    (nome, especie, sexo, porte, data_nascimento, nascimento_estimado, historia, foto_url, espaco, energia, atencao, experiencia, criancas, outros_pets, status)
SELECT * FROM (
    SELECT 'Luna' AS nome, 'Gato' AS especie, 'femea' AS sexo, 'pequeno' AS porte, DATE_SUB(CURDATE(), INTERVAL 4 YEAR) AS data_nascimento, TRUE AS nascimento_estimado, 'Calma e carinhosa, adora colo.' AS historia, '/assets/image-animais/luna.png' AS foto_url, 'apartamento' AS espaco, 'baixa' AS energia, 'pouca' AS atencao, 'iniciante' AS experiencia, TRUE AS criancas, TRUE AS outros_pets, 'disponivel' AS status
    UNION ALL
    SELECT 'Luke', 'Cachorro', 'macho', 'medio', DATE_SUB(CURDATE(), INTERVAL 3 YEAR), TRUE, 'Brincalhão e muito leal.', '/assets/image-animais/luke.png', 'casa_grande', 'alta', 'muita', 'experiente', TRUE, TRUE, 'disponivel'
    UNION ALL
    SELECT 'Pipoca', 'Gato', 'femea', 'pequeno', DATE_SUB(CURDATE(), INTERVAL 3 MONTH), TRUE, 'Filhote curioso, cheio de energia.', '/assets/image-animais/pipoca.png', 'apartamento', 'alta', 'muita', 'iniciante', TRUE, TRUE, 'disponivel'
    UNION ALL
    SELECT 'Chico', 'Cachorro', 'macho', 'grande', DATE_SUB(CURDATE(), INTERVAL 2 YEAR), TRUE, 'Grandão, amigo e protetor.', '/assets/image-animais/chico.png', 'casa_grande', 'alta', 'muita', 'experiente', TRUE, FALSE, 'disponivel'
    UNION ALL
    SELECT 'Snoopy', 'Cachorro', 'macho', 'medio', DATE_SUB(CURDATE(), INTERVAL 1 YEAR), TRUE, 'Jovem, sociável e brincalhão.', '/assets/image-animais/snoopy.png', 'casa_grande', 'alta', 'muita', 'iniciante', TRUE, TRUE, 'disponivel'
    UNION ALL
    SELECT 'Nina', 'Gato', 'femea', 'pequeno', DATE_SUB(CURDATE(), INTERVAL 4 YEAR), TRUE, 'Tranquila e independente.', '/assets/image-animais/nina.png', 'apartamento', 'baixa', 'pouca', 'iniciante', TRUE, TRUE, 'disponivel'
    UNION ALL
    SELECT 'Bob', 'Cachorro', 'macho', 'medio', DATE_SUB(CURDATE(), INTERVAL 2 YEAR), TRUE, 'Calmo e obediente.', '/assets/image-animais/bob.png', 'casa_grande', 'baixa', 'pouca', 'iniciante', TRUE, TRUE, 'disponivel'
    UNION ALL
    SELECT 'Mel', 'Gato', 'femea', 'pequeno', DATE_SUB(CURDATE(), INTERVAL 1 YEAR), TRUE, 'Doce, dorminhoca e muito carinhosa.', '/assets/image-animais/mel.png', 'apartamento', 'baixa', 'pouca', 'iniciante', TRUE, TRUE, 'disponivel'
) AS novos
WHERE NOT EXISTS (SELECT 1 FROM animais);   -- só insere se a tabela estiver vazia


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
-- 1) Coloque ADMIN_CODIGO=algum-codigo no .env da API e reinicie a API.
-- 2) No site, abra /admin/login > "Criar conta" e use esse código.
--
-- Conferir quem é admin:
-- SELECT a.id, u.nome, u.email, a.cargo, a.nivel, a.ativo
-- FROM admins a INNER JOIN usuarios u ON u.id = a.usuario_id;
