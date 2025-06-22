// server.js

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const routes = require('./routes'); // Importar as rotas
const path = require('path'); // Necessário para lidar com caminhos de arquivos

dotenv.config(); // Carrega as variáveis de ambiente do arquivo .env

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para permitir requisições de qualquer origem
app.use(cors());

// Middleware para parsear o corpo das requisições como JSON
app.use(express.json());

// Conexão com o MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Conexão com MongoDB Atlas estabelecida com sucesso!');
    })
    .catch((error) => {
        console.error('Erro ao conectar ao MongoDB Atlas:', error.message);
    });

// Use as rotas da API sob o prefixo /api
app.use('/api', routes);

// Rota de fallback para a raiz do servidor
// Esta rota é para o caso de alguém acessar https://fuckyoy.onrender.com/ diretamente
app.get('/', (req, res) => {
    // Redireciona para o frontend (assumindo que index.html será a página inicial)
    // No futuro, quando tiver o frontend, você pode servir o index.html aqui.
    // Por enquanto, uma mensagem ou um pequeno HTML de "Bem-vindo" é o suficiente.
    res.send('Bem-vindo à plataforma VEED! Acesse /api para a API.');
});

// Este middleware deve ser o último para lidar com rotas não encontradas
app.use((req, res, next) => {
    res.status(404).json({ message: `Rota ${req.originalUrl} não encontrada.` });
});


// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor VEED rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
});