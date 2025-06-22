// utils.js

const jwt = require('jsonwebtoken');
const { User } = require('./models'); // Importar o modelo de usuário
const cloudinary = require('cloudinary').v2; // Necessário para a configuração
const multer = require('multer'); // Necessário para o middleware de upload

// --- Configurações de Cloudinary e Multer (reconfirmadas aqui para clareza) ---
// Configuração do Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuração do Multer para upload em memória
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware para upload de arquivo único
exports.uploadSingle = (fieldName) => upload.single(fieldName);

// --- Middleware de Autenticação (JWT) ---

// @desc    Protege as rotas, verificando se o usuário está logado
const protect = async (req, res, next) => {
    let token;

    // Verifica se o token está no cabeçalho da requisição
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Obter token do cabeçalho
            token = req.headers.authorization.split(' ')[1];

            // Verificar token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Anexar o usuário à requisição (excluímos a senha)
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'Não autorizado, token falhou (usuário não encontrado).' });
            }

            next(); // Próximo middleware ou rota
        } catch (error) {
            console.error('Erro no middleware de proteção:', error.message);
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Não autorizado, token expirado.' });
            }
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Não autorizado, token inválido.' });
            }
            res.status(401).json({ message: 'Não autorizado, token falhou.' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Não autorizado, nenhum token.' });
    }
};

// @desc    Middleware de autorização para papéis específicos (ex: 'admin')
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.isAdmin ? 'admin' : 'user')) { // Assumindo 'isAdmin' no modelo User
            return res.status(403).json({ message: `Usuário ${req.user ? req.user.username : ''} não autorizado a acessar esta rota.` });
        }
        next();
    };
};

// Exportar os middlewares
module.exports = {
    protect,
    authorize,
    uploadSingle: exports.uploadSingle // Re-exportar a função de upload se precisar dela explicitamente
};