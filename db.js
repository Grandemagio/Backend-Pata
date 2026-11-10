// db.js - conexão com o banco de dados MySQL
require('dotenv').config();
const mysql = require('mysql2/promise');

// Lemos usuário, senha e nome do banco do arquivo .env
// (assim a senha não fica escrita dentro do código)
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    port: process.env.DB_PORT || 3306,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ong_protecao_animal',
    dateStrings: true   // datas voltam como texto "2024-05-20" (mais fácil de usar no site)
});

module.exports = db;
