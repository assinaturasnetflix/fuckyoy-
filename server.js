// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken'); // Para autenticação JWT, embora não seja usado diretamente aqui, é importante listar
const moment = require('moment'); // Para manipulação de datas/horas
const nodemailer = require('nodemailer'); // Para envio de e-mails
const multer = require('multer'); // Para upload de arquivos
const cloudinary = require('cloudinary').v2; // Para upload de arquivos para o Cloudinary
const path = require('path'); // Para manipulação de caminhos de arquivo, embora minimamente usado aqui

// Carregar variáveis de ambiente do .env
dotenv.config();

const app = express();

// Configuração do Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware para parsear JSON no corpo das requisições
app.use(express.json());

// Middleware para parsear dados de formulário URL-encoded
app.use(express.urlencoded({ extended: true }));

// Conexão com o MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Conectado ao MongoDB Atlas'))
    .catch(err => console.error('Erro de conexão ao MongoDB:', err));

// Servir arquivos estáticos (aqui, seus arquivos HTML)
// Para ocultar a extensão .html, você pode configurar rotas para cada arquivo HTML
// No entanto, como o frontend está embutido, a abordagem será diferente para servir as páginas.
// Por enquanto, vamos configurar para servir a raiz para index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Middleware para ocultar a extensão .html (exemplo básico)
// Isso não vai funcionar perfeitamente para todos os casos com arquivos embutidos,
// mas é um ponto de partida para rotas diretas.
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/wallet', (req, res) => {
    res.sendFile(path.join(__dirname, 'wallet.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
});

app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'settings.html'));
});

app.get('/referrals', (req, res) => {
    res.sendFile(path.join(__dirname, 'referrals.html'));
});

app.get('/help', (req, res) => {
    res.sendFile(path.join(__dirname, 'help.html'));
});

// Importar as rotas
const routes = require('./routes');
app.use('/api', routes); // Prefira prefixar suas rotas de API com /api

// Rota de fallback para 404
app.use((req, res, next) => {
    res.status(404).send('Página não encontrada.');
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Algo deu errado!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});