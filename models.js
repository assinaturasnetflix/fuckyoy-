// models.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// --- Esquema de Usuário (User) ---
const userSchema = new Schema({
    nome: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    senha: {
        type: String,
        required: true
    },
    avatar: {
        type: String, // URL do Cloudinary para a imagem do avatar
        default: '' // Será uma string vazia se não houver avatar
    },
    saldo: {
        type: Number,
        default: 0
    },
    planoAtual: {
        type: Schema.Types.ObjectId,
        ref: 'Plan',
        default: null
    },
    dataAtivacaoPlano: {
        type: Date,
        default: null
    },
    videosAssistidosHoje: {
        type: Number,
        default: 0
    },
    ultimoResetVideos: {
        type: Date,
        default: Date.now // Data do último reset para contagem de vídeos diários
    },
    ganhoDiario: {
        type: Number,
        default: 0 // Recompensa diária atual do usuário baseada no plano ativo
    },
    referralCode: {
        type: String,
        unique: true,
        required: true
    },
    referidoPor: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    emailVerificado: {
        type: Boolean,
        default: false
    },
    verificationToken: {
        type: String,
        default: null
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    // Histórico de vídeos assistidos (para acompanhar quais vídeos foram vistos e quando)
    historicoVideos: [
        {
            videoId: {
                type: Schema.Types.ObjectId,
                ref: 'Video'
            },
            dataAssistido: {
                type: Date,
                default: Date.now
            },
            recompensaGanhou: {
                type: Number,
                default: 0
            }
        }
    ]
}, { timestamps: true }); // Adiciona createdAt e updatedAt automaticamente

// --- Esquema de Plano (Plan) ---
const planSchema = new Schema({
    nome: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    valor: {
        type: Number,
        required: true
    },
    videosPorDia: {
        type: Number,
        required: true
    },
    duracaoDias: {
        type: Number,
        required: true
    },
    recompensaDiaria: { // Recompensa por assistir TODOS os vídeos do dia para este plano
        type: Number,
        required: true
    },
    recompensaTotalEstimada: { // Valor total que o usuário pode ganhar se assistir todos os vídeos durante a duração do plano
        type: Number,
        required: true
    }
}, { timestamps: true });

// --- Esquema de Vídeo (Video) ---
const videoSchema = new Schema({
    titulo: {
        type: String,
        required: true,
        trim: true
    },
    url: { // URL do vídeo (pode ser do Cloudinary ou um link externo)
        type: String,
        required: true
    },
    duracao: { // Duração do vídeo em segundos
        type: Number,
        required: true
    },
    ativo: { // Se o vídeo está disponível para ser assistido pelos usuários
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// --- Esquema de Depósito (Deposit) ---
const depositSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    valor: {
        type: Number,
        required: true
    },
    comprovante: { // URL da imagem do comprovante ou texto
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pendente', 'aprovado', 'rejeitado'],
        default: 'pendente'
    },
    aprovadoPor: { // Admin que aprovou o depósito
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    dataAprovacao: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// --- Esquema de Transação (Transaction) ---
const transactionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    tipo: { // Ex: 'deposito', 'compra_plano', 'recompensa_video', 'saque', 'bonus_referencia_plano', 'bonus_referencia_diario'
        type: String,
        required: true
    },
    valor: {
        type: Number,
        required: true
    },
    status: { // Para saques, por exemplo: 'pendente', 'concluido', 'cancelado'
        type: String,
        enum: ['concluido', 'pendente', 'cancelado', 'aprovado'], // Ajustar conforme os tipos de transação
        default: 'concluido' // Para recompensas e compras, assume-se concluído imediatamente
    },
    referencia: { // Opcional: ID do plano, vídeo, depósito ou saque relacionado
        type: Schema.Types.ObjectId,
        ref: 'Plan' // Pode ser um ObjectId de Plan, Video, Deposit, etc.
    },
    descricao: {
        type: String,
        trim: true
    }
}, { timestamps: true });


// --- Exportar os Modelos ---
module.exports = {
    User: mongoose.model('User', userSchema),
    Plan: mongoose.model('Plan', planSchema),
    Video: mongoose.model('Video', videoSchema),
    Deposit: mongoose.model('Deposit', depositSchema),
    Transaction: mongoose.model('Transaction', transactionSchema)
};