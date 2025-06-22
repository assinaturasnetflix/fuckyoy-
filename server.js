// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const moment = require('moment-timezone');
const multer = require('multer');
const cloudinary = require('cloudinary').v2; // Importar Cloudinary v2
const cors = require('cors'); // Importar o módulo CORS
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Configuração do Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware para permitir requisições de qualquer origem (CORS)
app.use(cors());

// Middleware para parsear JSON e URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// server.js
// ... outros middlewares
app.use('/api', routes); // Monta todas as rotas com o prefixo /api
// ...
// Configuração do Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

// Conexão com o MongoDB Atlas
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Conexão com MongoDB Atlas estabelecida com sucesso!'))
    .catch(err => console.error('Erro ao conectar ao MongoDB Atlas:', err));

// Definição dos modelos Mongoose (serão importados de models.js posteriormente)
// Por enquanto, vamos deixá-los aqui para fins de demonstração inicial
// Eles serão movidos para models.js quando for a hora.

// Define storage for multer (since we are using Cloudinary, multer will handle memory storage)
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });

// Exemplo de rota de teste
app.get('/api/status', (req, res) => {
    res.json({ message: 'Servidor VEED está online!' });
});

// Incluir as rotas aqui (serão importadas de routes.js posteriormente)
// Exemplo: app.use('/api', require('./routes'));

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Algo deu errado no servidor!');
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor VEED rodando na porta ${PORT}`);
});

// Exportar módulos necessários para outros arquivos
module.exports = { app, mongoose, jwt, bcrypt, nodemailer, moment, multer, cloudinary, transporter, upload, JWT_SECRET };