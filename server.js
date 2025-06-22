// server.js

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors'); // Importar o pacote cors

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

// Rotas (serão definidas no arquivo routes.js)
// Por enquanto, apenas um placeholder para garantir que o servidor está funcionando
app.get('/', (req, res) => {
    res.send('Bem-vindo à API do VEED!');
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor VEED rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
});