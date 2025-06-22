// utils.js
const jwt = require('jsonwebtoken');
const { User } = require('./models');
const dotenv = require('dotenv');

dotenv.config();

// Middleware de proteção de rotas (autenticação)
const protect = async (req, res, next) => {
    let token;

    // Verificar se o token JWT está no cabeçalho Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Obter token do cabeçalho
            token = req.headers.authorization.split(' ')[1];

            // Verificar token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Anexar o usuário decodificado à requisição
            req.user = await User.findById(decoded.id).select('-senha'); // Excluir a senha
            
            // Verificar se o usuário existe e se o email está verificado
            if (!req.user) {
                return res.status(401).json({ message: 'Não autorizado, token falhou (usuário não encontrado).' });
            }
            if (!req.user.emailVerificado) {
                return res.status(401).json({ message: 'Não autorizado, email não verificado.' });
            }

            next(); // Prosseguir para a próxima função middleware/rota
        } catch (error) {
            console.error('Erro de autenticação do token:', error.message);
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Não autorizado, token expirado.' });
            }
            res.status(401).json({ message: 'Não autorizado, token falhou.' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Não autorizado, nenhum token.' });
    }
};

// Middleware de autorização (verificar nível de acesso)
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            // Este caso não deveria ocorrer se 'protect' vier antes, mas para segurança extra
            return res.status(403).json({ message: 'Acesso negado, usuário não autenticado.' });
        }
        if (!roles.includes(req.user.isAdmin ? 'admin' : 'user')) { // Verifica se o usuário tem a role necessária
            return res.status(403).json({ message: 'Acesso negado, você não tem permissão para esta ação.' });
        }
        next();
    };
};

// Funções auxiliares adicionais podem ser colocadas aqui, se necessário.
// Exemplo: função para gerar códigos de referência, validações complexas, etc.

module.exports = {
    protect,
    authorize
};