# Pata Amiga API

API em Node.js + Express + MySQL para a plataforma de adoção de animais.

## Como rodar

1. No MySQL Workbench, execute nesta ordem:
   1. `banco.sql` (cria o banco `ong_protecao_animal` e as tabelas)
   2. `atualizacao-banco.sql` (foto do animal, favoritos, doações e contato)
   3. `dados-exemplo.sql` (os 8 animais da página Adotar)
2. No terminal, dentro desta pasta: `npm install`
3. Copie `.env.example` para `.env` e preencha a senha do MySQL e o `JWT_SECRET`.
4. `npm start`
5. Teste: http://localhost:3001/health

## Login

`POST /usuarios/login` devolve um `token`. Nas rotas protegidas, envie o cabeçalho:

```
Authorization: Bearer <token>
```

Para criar um administrador, cadastre o usuário normalmente e depois rode no MySQL:

```sql
UPDATE usuarios SET perfil = 'admin' WHERE email = 'seu@email.com';
```

(Depois disso a pessoa precisa fazer login de novo para receber um token novo.)

Legenda: 🌐 aberta a todos · 🔑 precisa de login · 🛠️ só equipe (admin ou voluntario)

## Rotas

| Rota | Quem | O que faz |
|------|------|-----------|
| `GET /` e `GET /health` | 🌐 | Testam a API e o banco |
| `POST /usuarios/registro` | 🌐 | Cadastra usuário (devolve token) |
| `POST /usuarios/login` | 🌐 | Login (devolve token) |
| `GET /usuarios/eu` · `PUT /usuarios/eu` | 🔑 | Ver e editar os próprios dados |
| `PUT /usuarios/eu/senha` | 🔑 | Trocar a senha |
| `GET /usuarios` | 🛠️ | Lista usuários |
| `GET /pets` | 🌐 | Lista animais (`?status=` `?especie=` `?porte=` `?faixa=filhote\|adulto` `?busca=`) |
| `GET /pets/:id` | 🌐 | Busca um animal |
| `POST /pets` · `PUT /pets/:id` · `DELETE /pets/:id` | 🛠️ | Cadastra, edita e remove animais |
| `POST /pets/:id/foto` | 🛠️ | Envia a foto (form-data, campo `foto`, até 2 MB) |
| `GET /favoritos` | 🔑 | Lista os favoritos |
| `POST /favoritos/:animal_id` · `DELETE /favoritos/:animal_id` | 🔑 | Favorita e desfavorita |
| `POST /adotantes` · `GET/PUT /adotantes/:usuario_id` | 🔑 | Perfil de compatibilidade |
| `GET /match/adotante/:usuario_id` | 🔑 | Animais por compatibilidade |
| `POST /adocao` | 🔑 | Pede a adoção de um animal (`animal_id`) |
| `GET /adocao/minhas` | 🔑 | Meus pedidos |
| `GET /adocao` · `PUT /adocao/:id` | 🛠️ | Lista pedidos e muda o status |
| `DELETE /adocao/:id` | 🔑 | Cancela o próprio pedido (se ainda não aprovado); a equipe remove qualquer um |
| `POST /doacoes` | 🌐 | Registra uma doação (com ou sem login) |
| `GET /doacoes/resumo` | 🌐 | Total arrecadado |
| `GET /doacoes/minhas` | 🔑 | Minhas doações |
| `GET /doacoes` · `PUT /doacoes/:id` | 🛠️ | Lista e confirma/cancela doações |
| `POST /contato` | 🌐 | Envia mensagem pelo formulário de contato |
| `GET /contato` · `PUT /contato/:id/lido` · `DELETE /contato/:id` | 🛠️ | Caixa de mensagens |

## Valores fixos (ENUM) do banco

- `sexo`: macho, femea, indefinido
- `porte`: mini, pequeno, medio, grande, gigante
- `status` do animal: disponivel, reservado, adotado, indisponivel
- `status` da adoção: solicitada, em_analise, aprovada, recusada, concluida
- `status` da doação: pendente, confirmada, cancelada

## Observações

- Adoção aprovada deixa o animal `reservado`; concluída, `adotado`; recusada devolve a `disponivel`.
- Doações são só registradas: não há pagamento online.
- As fotos enviadas ficam na pasta `uploads/`, servida em `/uploads/arquivo`.
