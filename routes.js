// routes.js
const express = require('express');
const router = express.Router();
const controllers = require('./controllers'); // Importa todas as funções do controllers.js
const { upload } = require('./server'); // Importa a instância do multer configurada no server.js

// --- Rotas de Autenticação e Usuário ---

// Rota de registro de usuário
// POST /api/register
router.post('/register', controllers.registerUser);

// Rota de login de usuário
// POST /api/login
router.post('/login', controllers.loginUser);

// Rota para solicitar recuperação de senha
// POST /api/forgot-password
router.post('/forgot-password', controllers.forgotPassword);

// Rota para redefinir senha (com token no URL)
// POST /api/reset-password/:token
router.post('/reset-password/:token', controllers.resetPassword);

// Obter perfil do usuário logado
// GET /api/profile (Protegida)
router.get('/profile', controllers.protect, controllers.getUserProfile);

// Atualizar perfil do usuário logado
// PUT /api/profile (Protegida)
router.put('/profile', controllers.protect, controllers.updateUserProfile);

// Atualizar avatar do usuário (com upload de arquivo)
// POST /api/profile/avatar (Protegida, requer Multer para upload)
router.post('/profile/avatar', controllers.protect, upload.single('avatar'), controllers.updateUserAvatar);

// --- Rotas de Planos (Admin) ---

// Criar novo plano (Protegida, apenas Admin)
// POST /api/admin/plans
router.post('/admin/plans', controllers.protect, controllers.authorizeAdmin, controllers.createPlan);

// Obter todos os planos
// GET /api/plans (Pode ser pública ou protegida, dependendo da necessidade de ver planos antes de logar)
router.get('/plans', controllers.getAllPlans); // Deixado público para fins de demonstração na página inicial

// Obter um plano específico por ID
// GET /api/plans/:id
router.get('/plans/:id', controllers.getPlanById); // Deixado público

// --- Rotas de Depósito (Usuário e Admin) ---

// Solicitar um novo depósito (Usuário)
// POST /api/deposits (Protegida)
router.post('/deposits', controllers.protect, controllers.createDeposit);

// Obter todos os depósitos pendentes (Admin)
// GET /api/admin/deposits/pending (Protegida, apenas Admin)
router.get('/admin/deposits/pending', controllers.protect, controllers.authorizeAdmin, controllers.getPendingDeposits);

// Aprovar um depósito (Admin)
// PUT /api/admin/deposits/:depositId/approve (Protegida, apenas Admin)
router.put('/admin/deposits/:depositId/approve', controllers.protect, controllers.authorizeAdmin, controllers.approveDeposit);

// Rejeitar um depósito (Admin)
// PUT /api/admin/deposits/:depositId/reject (Protegida, apenas Admin)
router.put('/admin/deposits/:depositId/reject', controllers.protect, controllers.authorizeAdmin, controllers.rejectDeposit);


// --- Rotas de Compra de Plano (Usuário) ---

// Comprar um plano (Usuário)
// POST /api/plans/purchase (Protegida)
router.post('/plans/purchase', controllers.protect, controllers.purchasePlan);

// --- Rotas de Vídeos (Admin e Usuário) ---

// Adicionar um novo vídeo (Admin)
// POST /api/admin/videos/url (Para vídeos por URL)
router.post('/admin/videos/url', controllers.protect, controllers.authorizeAdmin, controllers.addVideo);

// Adicionar um novo vídeo via upload local (Admin)
// POST /api/admin/videos/upload (Requer Multer para upload)
router.post('/admin/videos/upload', controllers.protect, controllers.authorizeAdmin, upload.single('video'), controllers.uploadVideoLocal);

// Obter vídeos diários para o usuário
// GET /api/videos/daily (Protegida)
router.get('/videos/daily', controllers.protect, controllers.getDailyVideos);

// Marcar vídeo como assistido e creditar recompensa
// POST /api/videos/:videoId/watched (Protegida)
router.post('/videos/:videoId/watched', controllers.protect, controllers.markVideoAsWatched);

// Obter histórico de vídeos assistidos pelo usuário
// GET /api/videos/history (Protegida)
router.get('/videos/history', controllers.protect, controllers.getVideoHistory);


// --- Rotas de Levantamento (Usuário e Admin) ---

// Solicitar um novo levantamento (Usuário)
// POST /api/withdrawals (Protegida)
router.post('/withdrawals', controllers.protect, controllers.requestWithdrawal);

// Obter todos os levantamentos pendentes (Admin)
// GET /api/admin/withdrawals/pending (Protegida, apenas Admin)
router.get('/admin/withdrawals/pending', controllers.protect, controllers.authorizeAdmin, controllers.getPendingWithdrawals);

// Aprovar um levantamento (Admin)
// PUT /api/admin/withdrawals/:withdrawalId/approve (Protegida, apenas Admin)
router.put('/admin/withdrawals/:withdrawalId/approve', controllers.protect, controllers.authorizeAdmin, controllers.approveWithdrawal);

// Rejeitar um levantamento (Admin)
// PUT /api/admin/withdrawals/:withdrawalId/reject (Protegida, apenas Admin)
router.put('/admin/withdrawals/:withdrawalId/reject', controllers.protect, controllers.authorizeAdmin, controllers.rejectWithdrawal);


// --- Rotas de Transações (Usuário) ---

// Obter histórico de transações do usuário
// GET /api/transactions (Protegida)
router.get('/transactions', controllers.protect, controllers.getUserTransactions);


// --- Rotas de Admin Dashboard e Gerenciamento ---

// Obter estatísticas do painel administrativo
// GET /api/admin/dashboard/stats (Protegida, apenas Admin)
router.get('/admin/dashboard/stats', controllers.protect, controllers.authorizeAdmin, controllers.getAdminDashboardStats);

// Obter todos os usuários (Admin)
// GET /api/admin/users (Protegida, apenas Admin)
router.get('/admin/users', controllers.protect, controllers.authorizeAdmin, controllers.getAllUsers);

// Alternar status de ativo/inativo de um usuário (Admin)
// PUT /api/admin/users/:userId/toggle-status (Protegida, apenas Admin)
router.put('/admin/users/:userId/toggle-status', controllers.protect, controllers.authorizeAdmin, controllers.toggleUserActiveStatus);

// Adicionar ou remover saldo de um usuário manualmente (Admin)
// POST /api/admin/users/:userId/adjust-balance (Protegida, apenas Admin)
router.post('/admin/users/:userId/adjust-balance', controllers.protect, controllers.authorizeAdmin, controllers.addRemoveUserBalance);


// Exportar o router para ser usado em server.js
module.exports = router;