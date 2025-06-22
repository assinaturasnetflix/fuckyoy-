// routes.js

const express = require('express');
const router = express.Router();

// Importar os controllers
const userController = require('./controllers');
const adminController = require('./controllers');
const videoController = require('./controllers');
const depositController = require('./controllers');
const withdrawalController = require('./controllers');
const planController = require('./controllers');

// Importar middlewares de autenticação
const { protect, authorize } = require('./utils');

// --- Rota de Teste para a Raiz da API ---
// Esta rota responderá a GET /api/
router.get('/', (req, res) => {
    res.status(200).json({ message: 'Bem-vindo à API do VEED! O servidor está funcionando.' });
});

// --- Rotas de Autenticação e Usuário ---
router.post('/register', userController.registerUser);
router.get('/verify-email', userController.verifyEmail); // Nova rota para verificação de email
router.post('/login', userController.loginUser);
router.get('/me', protect, userController.getMe);
router.put('/profile', protect, userController.updateProfile);
router.put('/change-password', protect, userController.changePassword);
router.get('/wallet', protect, userController.getWallet);
router.get('/transactions', protect, userController.getTransactions);
router.post('/deposit-request', protect, depositController.requestDeposit);
router.post('/withdrawal-request', protect, withdrawalController.requestWithdrawal);
router.get('/referrals', protect, userController.getReferrals);
router.get('/plans', protect, planController.getAvailablePlans);
router.post('/purchase-plan', protect, planController.purchasePlan);
router.post('/watch-video/:videoId', protect, videoController.watchVideo);

// --- Rotas de Administração ---
router.post('/admin/plans', protect, authorize('admin'), adminController.createPlan);
router.put('/admin/plans/:id', protect, authorize('admin'), adminController.updatePlan);
router.delete('/admin/plans/:id', protect, authorize('admin'), adminController.deletePlan);
router.get('/admin/users', protect, authorize('admin'), adminController.getAllUsers);
router.put('/admin/users/:id/block', protect, authorize('admin'), adminController.blockUser);
router.put('/admin/users/:id/unblock', protect, authorize('admin'), adminController.unblockUser);
router.post('/admin/videos', protect, authorize('admin'), adminController.addVideo);
router.put('/admin/videos/:id', protect, authorize('admin'), adminController.updateVideo);
router.delete('/admin/videos/:id', protect, authorize('admin'), adminController.deleteVideo);
router.get('/admin/deposits/pending', protect, authorize('admin'), adminController.getPendingDeposits);
router.put('/admin/deposits/:id/approve', protect, authorize('admin'), adminController.approveDeposit);
router.put('/admin/deposits/:id/reject', protect, authorize('admin'), adminController.rejectDeposit);
router.get('/admin/withdrawals/pending', protect, authorize('admin'), adminController.getPendingWithdrawals);
router.put('/admin/withdrawals/:id/approve', protect, authorize('admin'), adminController.approveWithdrawal);
router.put('/admin/withdrawals/:id/reject', protect, authorize('admin'), adminController.rejectWithdrawal);
router.post('/admin/add-balance/:userId', protect, authorize('admin'), adminController.addBalanceManually);
router.post('/admin/remove-balance/:userId', protect, authorize('admin'), adminController.removeBalanceManually);

module.exports = router;