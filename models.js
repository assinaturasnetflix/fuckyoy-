// models.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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
        match: [/.+@.+\..+/, 'Por favor, insira um email válido']
    },
    password: {
        type: String,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    balance: {
        type: Number,
        default: 0
    },
    avatar: {
        type: String, // URL do Cloudinary para a imagem do avatar
        default: '' // Será 'preto' se não definido, ou uma URL vazia que o frontend interpretará
    },
    currentPlan: {
        type: Schema.Types.ObjectId,
        ref: 'Plan',
        default: null
    },
    planActivationDate: {
        type: Date,
        default: null
    },
    videosWatchedToday: {
        type: Number,
        default: 0
    },
    lastVideoWatchDate: {
        type: Date,
        default: null
    },
    referredBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    referralCode: {
        type: String,
        unique: true,
        trim: true
    },
    isAdmin: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true // Adiciona createdAt e updatedAt automaticamente
});

// --- Plan Schema ---
const planSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    cost: {
        type: Number,
        required: true
    },
    dailyReward: {
        type: Number, // Recompensa por dia
        required: true
    },
    videosPerDay: {
        type: Number,
        required: true
    },
    durationDays: {
        type: Number, // Duração do plano em dias
        required: true
    },
    totalReward: {
        type: Number, // Recompensa total que o usuário pode ganhar no plano
        required: true
    }
}, {
    timestamps: true
});

// --- Video Schema ---
const videoSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    videoUrl: {
        type: String, // URL do Cloudinary ou URL externa do vídeo
        required: true
    },
    duration: {
        type: Number, // Duração do vídeo em segundos
        required: true
    },
    rewardAmount: {
        type: Number, // Recompensa por assistir este vídeo
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// --- Deposit Schema ---
const depositSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String, // 'M-Pesa' ou 'e-Mola'
        required: true
    },
    proof: {
        type: String, // URL do Cloudinary para a imagem do comprovante ou texto
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    transactionId: {
        type: String, // Opcional: ID da transação no M-Pesa/e-Mola, se aplicável
        trim: true
    }
}, {
    timestamps: true
});

// --- Withdrawal Schema ---
const withdrawalSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String, // 'M-Pesa' ou 'e-Mola'
        required: true
    },
    phoneNumber: {
        type: String, // Número para o qual o dinheiro será enviado
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    }
}, {
    timestamps: true
});

// --- Transaction History Schema ---
const transactionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['deposit', 'withdrawal', 'plan_purchase', 'video_reward', 'referral_plan_bonus', 'referral_daily_bonus'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    relatedId: { // ID do documento relacionado (e.g., depositId, withdrawalId, planId, videoId)
        type: Schema.Types.ObjectId,
        default: null
    },
    status: {
        type: String,
        enum: ['completed', 'pending', 'failed'], // Para transações que podem ter status (e.g. depósito/levantamento)
        default: 'completed'
    }
}, {
    timestamps: true
});

// --- Video History Schema (para registrar vídeos assistidos por usuário) ---
const videoHistorySchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    videoId: {
        type: Schema.Types.ObjectId,
        ref: 'Video',
        required: true
    },
    watchedAt: {
        type: Date,
        default: Date.now
    },
    rewardEarned: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});


// Exportar os modelos
module.exports = {
    User: mongoose.model('User', userSchema),
    Plan: mongoose.model('Plan', planSchema),
    Video: mongoose.model('Video', videoSchema),
    Deposit: mongoose.model('Deposit', depositSchema),
    Withdrawal: mongoose.model('Withdrawal', withdrawalSchema),
    Transaction: mongoose.model('Transaction', transactionSchema),
    VideoHistory: mongoose.model('VideoHistory', videoHistorySchema)
};