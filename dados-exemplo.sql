-- dados-exemplo.sql - os 8 animais que já aparecem na página "Adotar" do site
-- Execute DEPOIS do banco.sql e do atualizacao-banco.sql.
-- As fotos são as da pasta public/assets/image-animais do front-end.
USE ong_protecao_animal;

-- (Opcional) Se você ainda tem os animais de teste antigos (Thor, Luna e Rex) e quer começar limpo,
-- tire os dois "--" das linhas abaixo antes de executar:
-- DELETE FROM adocoes;
-- DELETE FROM animais;

INSERT INTO animais
    (nome, especie, sexo, porte, data_nascimento, nascimento_estimado, historia, foto_url,
     espaco, energia, atencao, experiencia, criancas, outros_pets, status)
VALUES
    ('Luna',   'Gato',     'femea', 'pequeno', DATE_SUB(CURDATE(), INTERVAL 4 YEAR),  TRUE, 'Calma e carinhosa, adora colo.',          '/assets/image-animais/luna.png',   'apartamento', 'baixa', 'pouca', 'iniciante',  TRUE,  TRUE,  'disponivel'),
    ('Luke',   'Cachorro', 'macho', 'medio',   DATE_SUB(CURDATE(), INTERVAL 3 YEAR),  TRUE, 'Brincalhão e muito leal.',               '/assets/image-animais/luke.png',   'casa_grande', 'alta',  'muita', 'experiente', TRUE,  TRUE,  'disponivel'),
    ('Pipoca', 'Gato',     'femea', 'pequeno', DATE_SUB(CURDATE(), INTERVAL 3 MONTH), TRUE, 'Filhote curioso, cheio de energia.',     '/assets/image-animais/pipoca.png', 'apartamento', 'alta',  'muita', 'iniciante',  TRUE,  TRUE,  'disponivel'),
    ('Chico',  'Cachorro', 'macho', 'grande',  DATE_SUB(CURDATE(), INTERVAL 2 YEAR),  TRUE, 'Grandão, amigo e protetor.',             '/assets/image-animais/chico.png',  'casa_grande', 'alta',  'muita', 'experiente', TRUE,  FALSE, 'disponivel'),
    ('Snoopy', 'Cachorro', 'macho', 'medio',   DATE_SUB(CURDATE(), INTERVAL 1 YEAR),  TRUE, 'Jovem, sociável e brincalhão.',          '/assets/image-animais/snoopy.png', 'casa_grande', 'alta',  'muita', 'iniciante',  TRUE,  TRUE,  'disponivel'),
    ('Nina',   'Gato',     'femea', 'pequeno', DATE_SUB(CURDATE(), INTERVAL 4 YEAR),  TRUE, 'Tranquila e independente.',              '/assets/image-animais/nina.png',   'apartamento', 'baixa', 'pouca', 'iniciante',  TRUE,  TRUE,  'disponivel'),
    ('Bob',    'Cachorro', 'macho', 'medio',   DATE_SUB(CURDATE(), INTERVAL 2 YEAR),  TRUE, 'Calmo e obediente.',                     '/assets/image-animais/bob.png',    'casa_grande', 'baixa', 'pouca', 'iniciante',  TRUE,  TRUE,  'disponivel'),
    ('Mel',    'Gato',     'femea', 'pequeno', DATE_SUB(CURDATE(), INTERVAL 1 YEAR),  TRUE, 'Doce, dorminhoca e muito carinhosa.',   '/assets/image-animais/mel.png',    'apartamento', 'baixa', 'pouca', 'iniciante',  TRUE,  TRUE,  'disponivel');
