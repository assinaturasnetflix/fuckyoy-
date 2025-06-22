// routes.js
const express = require('express');
const router = express.Router();
const userController = require('./controllers'); // Vamos importar o controller aqui, assumindo que teremos um arquivo controllers.js
const { protect, authorize } = require('./utils'); // Importar middlewares de autenticação e autorização

// --- Rotas de Autenticação e Usuário ---
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.get('/verify-email/:token', userController.verifyEmail);
router.get('/me', protect, userController.getProfile); // Protegida para obter o perfil do usuário logado
router.put('/me', protect, userController.updateProfile); // Protegida para atualizar o perfil
router.put('/change-password', protect, userController.changePassword); // Protegida para alterar a senha
router.put('/change-email', protect, userController.changeEmail); // Protegida para alterar o email

// --- Rotas de Planos ---
router.get('/plans', userController.getPlans); // Obter todos os planos disponíveis
router.post('/plans/:planId/buy', protect, userController.buyPlan); // Comprar um plano

// --- Rotas de Vídeos ---
router.get('/videos', protect, userController.getDailyVideos); // Obter vídeos diários do usuário
router.post('/videos/:videoId/watch', protect, userController.watchVideo); // Marcar vídeo como assistido

// --- Rotas de Carteira e Depósito ---
router.get('/wallet', protect, userController.getWalletInfo); // Obter informações da carteira do usuário
router.post('/deposit', protect, userController.requestDeposit); // Solicitar um depósito
router.get('/transactions', protect, userController.getTransactions); // Obter histórico de transações

// --- Rotas de Referência ---
router.get('/referrals', protect, userController.getReferralInfo); // Obter informações de referência do usuário

// --- Rotas do Painel Administrativo ---
// Todas as rotas de admin devem ser protegidas e autorizadas apenas para administradores
router.get('/admin/users', protect, authorize('admin'), userController.getAllUsers);
router.get('/admin/users/:userId', protect, authorize('admin'), userController.getUserById);
router.put('/admin/users/:userId/block', protect, authorize('admin'), userController.blockUser);
router.put('/admin/users/:userId/unblock', protect, authorize('admin'), userController.unblockUser);
router.post('/admin/users/:userId/add-balance', protect, authorize('admin'), userController.addBalanceToUser);
router.post('/admin/users/:userId/remove-balance', protect, authorize('admin'), userController.removeBalanceFromUser);

router.post('/admin/plans', protect, authorize('admin'), userController.createPlan); // Criar novo plano
router.put('/admin/plans/:planId', protect, authorize('admin'), userController.updatePlan); // Atualizar plano
router.delete('/admin/plans/:planId', protect, authorize('admin'), userController.deletePlan); // Excluir plano

router.post('/admin/videos', protect, authorize('admin'), userController.uploadVideo); // Fazer upload de vídeo
router.put('/admin/videos/:videoId', protect, authorize('admin'), userController.updateVideo); // Atualizar vídeo
router.delete('/admin/videos/:videoId', protect, authorize('admin'), userController.deleteVideo); // Excluir vídeo

router.get('/admin/deposits/pending', protect, authorize('admin'), userController.getPendingDeposits); // Ver depósitos pendentes
router.put('/admin/deposits/:depositId/approve', protect, authorize('admin'), userController.approveDeposit); // Aprovar depósito
router.put('/admin/deposits/:depositId/reject', protect, authorize('admin'), userController.rejectDeposit); // Rejeitar depósito

router.get('/admin/dashboard-stats', protect, authorize('admin'), userController.getAdminDashboardStats); // Estatísticas do painel admin

// Você pode adicionar rotas para saques aqui quando for implementar a funcionalidade de saque
// router.get('/admin/withdrawals/pending', protect, authorize('admin'), userController.getPendingWithdrawals);
// router.put('/admin/withdrawals/:withdrawalId/approve', protect, authorize('admin'), userController.approveWithdrawal);


module.exports = router;