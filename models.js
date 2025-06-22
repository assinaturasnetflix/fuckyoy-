// models.js
const mongoose = require('mongoose');
const { Schema } = mongoose; // Desestruturar Schema para uso mais limpo
const moment = require('moment-timezone'); // Usar moment-timezone para datas

// --- User Schema ---
const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Por favor, insira um e-mail válido']
    },
    password: {
        type: String,
        required: true
    },
    avatar: {
        type: String, // URL do Cloudinary para a imagem do avatar
        default: 'https://res.cloudinary.com/dje6f5k5u/image/upload/v1718873000/default-avatar.png' // Avatar padrão
    },
    balance: {
        type: Number,
        default: 0
    },
    plan: {
        type: Schema.Types.ObjectId,
        ref: 'Plan',
        default: null
    },
    planExpiresAt: {
        type: Date,
        default: null
    },
    videosWatchedToday: {
        type: Number,
        default: 0
    },
    lastVideoWatchDate: {
        type: Date, // Data da última vez que o usuário assistiu um vídeo (para resetar contagem diária)
        default: null
    },
    dailyRewardClaimed: {
        type: Boolean,
        default: false
    },
    referralCode: {
        type: String,
        unique: true,
        trim: true
    },
    referredBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    isActive: {
        type: Boolean,
        default: true // Para bloquear/desbloquear usuários
    },
    passwordResetToken: String,
    passwordResetExpires: Date
}, { timestamps: true }); // Adiciona createdAt e updatedAt automaticamente

// --- Plan Schema ---
const planSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    value: { // Custo do plano
        type: Number,
        required: true
    },
    videosPerDay: {
        type: Number,
        required: true
    },
    durationDays: { // Duração do plano em dias
        type: Number,
        required: true
    },
    dailyReward: { // Recompensa por vídeo assistido
        type: Number,
        required: true
    },
    totalReward: { // Recompensa total que o usuário pode ganhar (para fins de exibição/cálculo)
        type: Number,
        required: true
    }
}, { timestamps: true });

// --- Video Schema ---
const videoSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    url: { // URL do vídeo (pode ser Cloudinary ou outra URL externa)
        type: String,
        required: true
    },
    duration: { // Duração do vídeo em segundos
        type: Number,
        required: true
    },
    isActive: { // Para ativar/desativar vídeos
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// --- Deposit Schema ---
const depositSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    method: {
        type: String,
        enum: ['M-Pesa', 'e-Mola'],
        required: true
    },
    proof: { // URL do Cloudinary para o comprovante de imagem ou texto
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    processedBy: { // Admin que processou
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    processedAt: {
        type: Date
    }
}, { timestamps: true });

// --- Withdrawal Schema ---
const withdrawalSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    method: {
        type: String,
        enum: ['M-Pesa', 'e-Mola'],
        required: true
    },
    accountNumber: { // Número M-Pesa/e-Mola para o levantamento
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    processedBy: { // Admin que processou
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    processedAt: {
        type: Date
    }
}, { timestamps: true });

// --- Transaction Schema (para histórico de saldo, depósitos, levantamentos, recompensas, etc.) ---
const transactionSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['deposit', 'withdrawal', 'plan_purchase', 'video_reward', 'referral_plan_bonus', 'referral_daily_bonus', 'admin_adjustment'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: { // Descrição detalhada da transação
        type: String,
        required: true
    },
    reference: { // Pode ser um ID de depósito, levantamento, plano, etc.
        type: Schema.Types.ObjectId,
        refPath: 'type', // Refere-se a um modelo diferente dependendo do 'type'
        default: null
    }
}, { timestamps: true });

// --- WatchedVideo Schema (para registrar vídeos assistidos por usuário) ---
const watchedVideoSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    video: {
        type: Schema.Types.ObjectId,
        ref: 'Video',
        required: true
    },
    watchedAt: {
        type: Date,
        default: Date.now // Momento em que o vídeo foi marcado como assistido
    },
    rewardEarned: {
        type: Number,
        default: 0
    }
});


// --- Exportar os modelos ---
const User = mongoose.model('User', userSchema);
const Plan = mongoose.model('Plan', planSchema);
const Video = mongoose.model('Video', videoSchema);
const Deposit = mongoose.model('Deposit', depositSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const WatchedVideo = mongoose.model('WatchedVideo', watchedVideoSchema);

module.exports = {
    User,
    Plan,
    Video,
    Deposit,
    Withdrawal,
    Transaction,
    WatchedVideo
};