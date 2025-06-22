// controllers.js

const { User, Plan, Video, Deposit, Withdrawal, Transaction, VideoHistory } = require('./models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const moment = require('moment-timezone'); // Para lidar com fuso horário
const cloudinary = require('cloudinary').v2;
const { promisify } = require('util');
const multer = require('multer');

// Configuração do Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuração do Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Configuração do Multer para upload em memória (Cloudinary fará o upload final)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Função auxiliar para gerar token JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// Função auxiliar para verificar e atualizar recompensas diárias (rodada à 0h GMT+2)
const checkAndUpdateDailyRewards = async (userId) => {
    try {
        const user = await User.findById(userId).populate('currentPlan');
        if (!user || !user.currentPlan) {
            return; // Usuário ou plano não encontrados
        }

        const nowMaputo = moment().tz("Africa/Maputo");
        const lastRewardDateMaputo = user.lastVideoWatchDate ? moment(user.lastVideoWatchDate).tz("Africa/Maputo") : null;

        // Se a última data de recompensa for anterior ao dia atual de Maputo
        if (!lastRewardDateMaputo || lastRewardDateMaputo.isBefore(nowMaputo, 'day')) {
            // Resetar vídeos assistidos para o novo dia
            user.videosWatchedToday = 0;
            // Atualizar lastVideoWatchDate para a data atual (isso será atualizado novamente quando um vídeo for assistido)
            user.lastVideoWatchDate = nowMaputo.toDate();
            await user.save();
        }
    } catch (error) {
        console.error('Erro ao verificar e atualizar recompensas diárias:', error);
    }
};


// --- USER CONTROLLERS ---

// @desc    Registrar um novo usuário
// @route   POST /register
// @access  Public
exports.registerUser = async (req, res) => {
    const { username, email, password, referralCode } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Por favor, preencha todos os campos obrigatórios.' });
    }

    try {
        // Verificar se o usuário já existe
        let userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'Este email já está registrado.' });
        }
        userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ message: 'Este nome de usuário já está em uso.' });
        }

        // Hash da senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let referredBy = null;
        if (referralCode) {
            const referrer = await User.findOne({ referralCode });
            if (referrer) {
                referredBy = referrer._id;
            } else {
                return res.status(400).json({ message: 'Código de referência inválido.' });
            }
        }

        // Gerar código de referência único
        let uniqueReferralCode;
        let isCodeUnique = false;
        while (!isCodeUnique) {
            uniqueReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const existingUserWithCode = await User.findOne({ referralCode: uniqueReferralCode });
            if (!existingUserWithCode) {
                isCodeUnique = true;
            }
        }

        // Criar usuário
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            referredBy,
            referralCode: uniqueReferralCode
        });

        if (user) {
            // Enviar email de verificação
            const verificationToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
            const verificationUrl = `${req.protocol}://${req.get('host')}/verify-email?token=${verificationToken}`;

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: user.email,
                subject: 'Verifique seu email para o VEED',
                html: `
                    <h1>Bem-vindo ao VEED!</h1>
                    <p>Por favor, clique no link abaixo para verificar seu endereço de email:</p>
                    <a href="${verificationUrl}">Verificar Email</a>
                    <p>Se você não se registrou no VEED, por favor ignore este email.</p>
                `
            };

            await transporter.sendMail(mailOptions);

            // Email de boas-vindas
            const welcomeMailOptions = {
                from: process.env.EMAIL_USER,
                to: user.email,
                subject: 'Bem-vindo ao VEED!',
                html: `
                    <h1>Olá, ${user.username}!</h1>
                    <p>Seja muito bem-vindo à plataforma VEED.</p>
                    <p>Aproveite seus vídeos e comece a ganhar!</p>
                    <p>Sua plataforma de investimento através do consumo de vídeos.</p>
                `
            };
            await transporter.sendMail(welcomeMailOptions);


            res.status(201).json({
                message: 'Usuário registrado com sucesso. Por favor, verifique seu email para ativar sua conta.',
                userId: user._id
            });
        } else {
            res.status(400).json({ message: 'Dados do usuário inválidos.' });
        }
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Verificar email
// @route   GET /verify-email
// @access  Public
exports.verifyEmail = async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ message: 'Token de verificação não fornecido.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        if (user.isVerified) {
            return res.status(200).json({ message: 'Email já verificado.' });
        }

        user.isVerified = true;
        await user.save();

        res.status(200).send('Email verificado com sucesso! Você pode fechar esta página e fazer login.');
    } catch (error) {
        console.error('Erro ao verificar email:', error);
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ message: 'Token de verificação expirado.' });
        }
        res.status(500).json({ message: 'Erro na verificação do email.' });
    }
};


// @desc    Autenticar usuário & obter token
// @route   POST /login
// @access  Public
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Por favor, insira email e senha.' });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        if (!user.isVerified) {
            return res.status(401).json({ message: 'Por favor, verifique seu email antes de fazer login.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        // Se o login for bem-sucedido, verificar e atualizar recompensas diárias
        await checkAndUpdateDailyRewards(user._id);

        res.status(200).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            balance: user.balance,
            isAdmin: user.isAdmin,
            avatar: user.avatar,
            token: generateToken(user._id),
        });
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Obter dados do perfil do usuário logado
// @route   GET /me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password').populate('currentPlan');
        if (user) {
            // Garante que os dados de vídeos assistidos hoje estão atualizados com base no fuso horário
            await checkAndUpdateDailyRewards(user._id);
            const updatedUser = await User.findById(req.user.id).select('-password').populate('currentPlan');
            res.status(200).json(updatedUser);
        } else {
            res.status(404).json({ message: 'Usuário não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao obter dados do perfil:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Atualizar perfil do usuário (avatar e nome de usuário)
// @route   PUT /profile
// @access  Private
exports.updateProfile = async (req, res) => {
    const { username } = req.body; // Apenas username pode ser atualizado via corpo da requisição
    let avatarUrl = req.user.avatar; // Manter o avatar existente por padrão

    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        // Atualizar username se fornecido e diferente
        if (username && username !== user.username) {
            const usernameExists = await User.findOne({ username });
            if (usernameExists && usernameExists._id.toString() !== user._id.toString()) {
                return res.status(400).json({ message: 'Este nome de usuário já está em uso.' });
            }
            user.username = username;
        }

        // Lidar com upload de avatar via Multer e Cloudinary
        upload.single('avatar')(req, res, async (err) => {
            if (err) {
                console.error('Erro no upload do Multer:', err);
                return res.status(500).json({ message: 'Erro ao fazer upload do arquivo.' });
            }

            if (req.file) {
                // Fazer upload da imagem para o Cloudinary
                const b64 = Buffer.from(req.file.buffer).toString("base64");
                let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

                const result = await cloudinary.uploader.upload(dataURI, {
                    folder: 'veed_avatars',
                    transformation: [{ width: 150, height: 150, crop: 'fill', gravity: 'face' }]
                });
                avatarUrl = result.secure_url;
            }

            user.avatar = avatarUrl;
            await user.save();

            res.status(200).json({
                message: 'Perfil atualizado com sucesso.',
                username: user.username,
                avatar: user.avatar
            });
        });

    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Alterar senha do usuário
// @route   PUT /change-password
// @access  Private
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Por favor, preencha a senha atual e a nova senha.' });
    }

    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Senha atual incorreta.' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.status(200).json({ message: 'Senha alterada com sucesso.' });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Obter informações da carteira do usuário
// @route   GET /wallet
// @access  Private
exports.getWallet = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('balance');
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.status(200).json({ balance: user.balance });
    } catch (error) {
        console.error('Erro ao obter carteira:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Obter histórico de transações do usuário
// @route   GET /transactions
// @access  Private
exports.getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(transactions);
    } catch (error) {
        console.error('Erro ao obter transações:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};


// --- PLAN CONTROLLERS ---

// @desc    Obter todos os planos disponíveis
// @route   GET /plans
// @access  Private (usuários logados)
exports.getAvailablePlans = async (req, res) => {
    try {
        const plans = await Plan.find({});
        res.status(200).json(plans);
    } catch (error) {
        console.error('Erro ao obter planos disponíveis:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Comprar um plano
// @route   POST /purchase-plan
// @access  Private
exports.purchasePlan = async (req, res) => {
    const { planId } = req.body;

    if (!planId) {
        return res.status(400).json({ message: 'ID do plano é obrigatório.' });
    }

    try {
        const user = await User.findById(req.user.id);
        const plan = await Plan.findById(planId);

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        if (!plan) {
            return res.status(404).json({ message: 'Plano não encontrado.' });
        }
        if (user.currentPlan && user.currentPlan.toString() === planId) {
            return res.status(400).json({ message: 'Você já possui este plano ativo.' });
        }
        if (user.balance < plan.cost) {
            return res.status(400).json({ message: 'Saldo insuficiente para comprar este plano. Por favor, faça um depósito.' });
        }

        // Debitar o custo do plano do saldo do usuário
        user.balance -= plan.cost;
        user.currentPlan = plan._id;
        user.planActivationDate = new Date();
        user.videosWatchedToday = 0; // Resetar contagem para o novo plano
        user.lastVideoWatchDate = null; // Resetar para que a recompensa comece no dia seguinte se não assistir

        await user.save();

        // Registrar transação
        await Transaction.create({
            userId: user._id,
            type: 'plan_purchase',
            amount: -plan.cost, // Valor negativo pois é um débito
            description: `Compra do plano: ${plan.name}`,
            relatedId: plan._id,
            status: 'completed'
        });

        // Bônus de referência para quem indicou (10% do valor do plano)
        if (user.referredBy) {
            const referrer = await User.findById(user.referredBy);
            if (referrer) {
                const bonusAmount = plan.cost * 0.10;
                referrer.balance += bonusAmount;
                await referrer.save();

                await Transaction.create({
                    userId: referrer._id,
                    type: 'referral_plan_bonus',
                    amount: bonusAmount,
                    description: `Bônus de 10% pela compra do plano "${plan.name}" pelo usuário ${user.username}`,
                    relatedId: user._id, // Referência ao usuário que comprou o plano
                    status: 'completed'
                });
            }
        }

        res.status(200).json({ message: `Plano "${plan.name}" ativado com sucesso!`, newBalance: user.balance });

    } catch (error) {
        console.error('Erro ao comprar plano:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// --- VIDEO CONTROLLERS ---

// @desc    Assistir a um vídeo e receber recompensa
// @route   POST /watch-video/:videoId
// @access  Private
exports.watchVideo = async (req, res) => {
    const { videoId } = req.params;
    const { watchedDuration } = req.body; // Duração assistida em segundos, vinda do frontend

    if (!videoId) {
        return res.status(400).json({ message: 'ID do vídeo é obrigatório.' });
    }

    try {
        const user = await User.findById(req.user.id).populate('currentPlan');
        const video = await Video.findById(videoId);

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        if (!video) {
            return res.status(404).json({ message: 'Vídeo não encontrado.' });
        }
        if (!user.currentPlan) {
            return res.status(400).json({ message: 'Você precisa ter um plano ativo para assistir vídeos e ganhar recompensas.' });
        }
        if (user.currentPlan.videosPerDay <= user.videosWatchedToday) {
            return res.status(400).json({ message: `Você atingiu o limite de ${user.currentPlan.videosPerDay} vídeos diários para o seu plano.` });
        }
        // Verificar se o vídeo foi assistido completamente
        // Tolerância de 1 segundo para flutuações de rede/player
        if (!watchedDuration || watchedDuration < (video.duration - 1)) {
            // Se o usuário sair antes, o frontend deve reenviar a requisição para reiniciar o vídeo
            // Ou o backend pode apenas não conceder a recompensa e manter a contagem de vídeos assistidos
            return res.status(400).json({ message: 'Vídeo não assistido até o fim. Recompensa não concedida. Por favor, assista novamente.' });
        }

        // Verificar se o usuário já assistiu a este vídeo hoje
        const nowMaputo = moment().tz("Africa/Maputo");
        const videoAlreadyWatchedToday = await VideoHistory.findOne({
            userId: user._id,
            videoId: video._id,
            watchedAt: {
                $gte: nowMaputo.startOf('day').toDate(),
                $lt: nowMaputo.endOf('day').toDate()
            }
        });

        if (videoAlreadyWatchedToday) {
            return res.status(400).json({ message: 'Você já assistiu a este vídeo hoje.' });
        }

        // Conceder recompensa
        const reward = user.currentPlan.dailyReward / user.currentPlan.videosPerDay; // Recompensa por vídeo
        user.balance += reward;
        user.videosWatchedToday += 1;
        user.lastVideoWatchDate = nowMaputo.toDate(); // Atualiza a última data de visualização

        await user.save();

        // Registrar na história de vídeos assistidos
        await VideoHistory.create({
            userId: user._id,
            videoId: video._id,
            rewardEarned: reward
        });

        // Registrar transação de recompensa
        await Transaction.create({
            userId: user._id,
            type: 'video_reward',
            amount: reward,
            description: `Recompensa por assistir ao vídeo "${video.title}"`,
            relatedId: video._id,
            status: 'completed'
        });

        // Bônus de referência (5% da renda diária do indicado)
        if (user.referredBy) {
            const referrer = await User.findById(user.referredBy);
            if (referrer) {
                const dailyReferralBonus = (user.currentPlan.dailyReward * 0.05) / user.currentPlan.videosPerDay; // 5% da renda diária dividida pelos vídeos por dia
                referrer.balance += dailyReferralBonus;
                await referrer.save();

                await Transaction.create({
                    userId: referrer._id,
                    type: 'referral_daily_bonus',
                    amount: dailyReferralBonus,
                    description: `Bônus de 5% da renda diária do indicado ${user.username} por assistir vídeo`,
                    relatedId: user._id,
                    status: 'completed'
                });
            }
        }

        res.status(200).json({
            message: `Recompensa de ${reward} MT adicionada. Vídeo assistido com sucesso!`,
            newBalance: user.balance,
            videosWatchedToday: user.videosWatchedToday
        });

    } catch (error) {
        console.error('Erro ao assistir vídeo:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Obter links de referência do usuário
// @route   GET /referrals
// @access  Private
exports.getReferrals = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('referralCode');
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const referredUsers = await User.find({ referredBy: user._id }).select('username balance currentPlan');

        // Calcular ganhos totais de referência (pode ser mais complexo para incluir históricos)
        const totalReferralEarnings = await Transaction.aggregate([
            { $match: { userId: user._id, type: { $in: ['referral_plan_bonus', 'referral_daily_bonus'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        res.status(200).json({
            referralCode: user.referralCode,
            referralLink: `${req.protocol}://${req.get('host')}/register?ref=${user.referralCode}`,
            referredUsers: referredUsers,
            totalEarnings: totalReferralEarnings.length > 0 ? totalReferralEarnings[0].total : 0
        });
    } catch (error) {
        console.error('Erro ao obter referências:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};


// --- DEPOSIT CONTROLLERS ---

// @desc    Solicitar um depósito
// @route   POST /deposit-request
// @access  Private
exports.requestDeposit = async (req, res) => {
    const { amount, paymentMethod, transactionId, proofText } = req.body;

    if (!amount || !paymentMethod) {
        return res.status(400).json({ message: 'Por favor, preencha o valor e o método de pagamento.' });
    }
    if (amount <= 0) {
        return res.status(400).json({ message: 'O valor do depósito deve ser positivo.' });
    }
    if (paymentMethod !== 'M-Pesa' && paymentMethod !== 'e-Mola') {
        return res.status(400).json({ message: 'Método de pagamento inválido. Use "M-Pesa" ou "e-Mola".' });
    }

    try {
        let proof = proofText || ''; // Se não houver arquivo, use o texto
        // Lidar com upload de comprovante via Multer e Cloudinary, se existir
        upload.single('proofImage')(req, res, async (err) => {
            if (err) {
                console.error('Erro no upload do Multer para comprovante:', err);
                return res.status(500).json({ message: 'Erro ao fazer upload do comprovante.' });
            }

            if (req.file) {
                const b64 = Buffer.from(req.file.buffer).toString("base64");
                let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
                const result = await cloudinary.uploader.upload(dataURI, { folder: 'veed_deposit_proofs' });
                proof = result.secure_url;
            } else if (!proofText) {
                return res.status(400).json({ message: 'É necessário um comprovante (imagem ou texto).' });
            }

            const deposit = await Deposit.create({
                userId: req.user.id,
                amount,
                paymentMethod,
                proof,
                transactionId: transactionId || null
            });

            await Transaction.create({
                userId: req.user.id,
                type: 'deposit',
                amount: amount,
                description: `Solicitação de depósito via ${paymentMethod}`,
                relatedId: deposit._id,
                status: 'pending' // Status inicial é pendente
            });

            res.status(201).json({ message: 'Solicitação de depósito enviada com sucesso! Aguardando aprovação do administrador.' });
        });

    } catch (error) {
        console.error('Erro ao solicitar depósito:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// --- WITHDRAWAL CONTROLLERS ---

// @desc    Solicitar um levantamento
// @route   POST /withdrawal-request
// @access  Private
exports.requestWithdrawal = async (req, res) => {
    const { amount, paymentMethod, phoneNumber } = req.body;

    if (!amount || !paymentMethod || !phoneNumber) {
        return res.status(400).json({ message: 'Por favor, preencha o valor, método de pagamento e número de telefone.' });
    }
    if (amount <= 0) {
        return res.status(400).json({ message: 'O valor do levantamento deve ser positivo.' });
    }
    if (paymentMethod !== 'M-Pesa' && paymentMethod !== 'e-Mola') {
        return res.status(400).json({ message: 'Método de pagamento inválido. Use "M-Pesa" ou "e-Mola".' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        if (user.balance < amount) {
            return res.status(400).json({ message: 'Saldo insuficiente para este levantamento.' });
        }

        // Criar a solicitação de levantamento
        const withdrawal = await Withdrawal.create({
            userId: req.user.id,
            amount,
            paymentMethod,
            phoneNumber,
            status: 'pending'
        });

        // Debitar o valor do saldo do usuário imediatamente (ou após aprovação do admin, dependendo da regra de negócio)
        // Optamos por debitar após aprovação do admin para evitar saldo negativo em caso de rejeição
        // Por enquanto, apenas registramos a solicitação. A dedução do saldo ocorrerá na aprovação do admin.

        await Transaction.create({
            userId: req.user.id,
            type: 'withdrawal',
            amount: -amount, // Valor negativo pois é um débito futuro
            description: `Solicitação de levantamento via ${paymentMethod} para ${phoneNumber}`,
            relatedId: withdrawal._id,
            status: 'pending' // Status inicial é pendente
        });

        res.status(201).json({ message: 'Solicitação de levantamento enviada com sucesso! Aguardando aprovação do administrador.' });
    } catch (error) {
        console.error('Erro ao solicitar levantamento:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};


// --- ADMIN CONTROLLERS ---

// Middleware para upload de vídeo (Cloudinary)
const uploadVideoMiddleware = upload.single('videoFile'); // Assumindo que o campo do formulário é 'videoFile'

// @desc    Criar um novo plano
// @route   POST /admin/plans
// @access  Private/Admin
exports.createPlan = async (req, res) => {
    const { name, cost, dailyReward, videosPerDay, durationDays } = req.body;

    if (!name || !cost || !dailyReward || !videosPerDay || !durationDays) {
        return res.status(400).json({ message: 'Por favor, preencha todos os campos do plano.' });
    }
    if (cost <= 0 || dailyReward <= 0 || videosPerDay <= 0 || durationDays <= 0) {
        return res.status(400).json({ message: 'Todos os valores devem ser positivos.' });
    }

    try {
        const totalReward = dailyReward * durationDays;
        const plan = await Plan.create({
            name,
            cost,
            dailyReward,
            videosPerDay,
            durationDays,
            totalReward
        });
        res.status(201).json({ message: 'Plano criado com sucesso!', plan });
    } catch (error) {
        console.error('Erro ao criar plano:', error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Já existe um plano com este nome.' });
        }
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Atualizar um plano existente
// @route   PUT /admin/plans/:id
// @access  Private/Admin
exports.updatePlan = async (req, res) => {
    const { id } = req.params;
    const { name, cost, dailyReward, videosPerDay, durationDays } = req.body;

    try {
        const plan = await Plan.findById(id);
        if (!plan) {
            return res.status(404).json({ message: 'Plano não encontrado.' });
        }

        if (name) plan.name = name;
        if (cost) plan.cost = cost;
        if (dailyReward) plan.dailyReward = dailyReward;
        if (videosPerDay) plan.videosPerDay = videosPerDay;
        if (durationDays) plan.durationDays = durationDays;

        plan.totalReward = plan.dailyReward * plan.durationDays; // Recalcular

        await plan.save();
        res.status(200).json({ message: 'Plano atualizado com sucesso!', plan });
    } catch (error) {
        console.error('Erro ao atualizar plano:', error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Já existe um plano com este nome.' });
        }
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Excluir um plano
// @route   DELETE /admin/plans/:id
// @access  Private/Admin
exports.deletePlan = async (req, res) => {
    const { id } = req.params;

    try {
        const plan = await Plan.findByIdAndDelete(id);
        if (!plan) {
            return res.status(404).json({ message: 'Plano não encontrado.' });
        }
        res.status(200).json({ message: 'Plano excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir plano:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Adicionar um novo vídeo (via URL ou upload)
// @route   POST /admin/videos
// @access  Private/Admin
exports.addVideo = async (req, res) => {
    const { title, duration, rewardAmount, videoUrl } = req.body; // videoUrl é para links externos

    if (!title || !duration || !rewardAmount) {
        return res.status(400).json({ message: 'Título, duração e recompensa são obrigatórios.' });
    }
    if (duration <= 0 || rewardAmount <= 0) {
        return res.status(400).json({ message: 'Duração e recompensa devem ser valores positivos.' });
    }

    try {
        // Usar o middleware de upload do multer
        uploadVideoMiddleware(req, res, async (err) => {
            if (err) {
                console.error('Erro no upload do Multer para vídeo:', err);
                return res.status(500).json({ message: 'Erro ao fazer upload do vídeo.' });
            }

            let finalVideoUrl = videoUrl; // Prioriza URL externa se fornecida

            if (req.file) {
                // Se um arquivo foi enviado, fazer upload para o Cloudinary
                const b64 = Buffer.from(req.file.buffer).toString("base64");
                let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
                const result = await cloudinary.uploader.upload(dataURI, {
                    folder: 'veed_videos',
                    resource_type: 'video'
                });
                finalVideoUrl = result.secure_url;
            } else if (!videoUrl) {
                return res.status(400).json({ message: 'É necessário fornecer uma URL de vídeo ou fazer upload de um arquivo.' });
            }

            const video = await Video.create({
                title,
                videoUrl: finalVideoUrl,
                duration,
                rewardAmount
            });

            res.status(201).json({ message: 'Vídeo adicionado com sucesso!', video });
        });

    } catch (error) {
        console.error('Erro ao adicionar vídeo:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Atualizar um vídeo existente
// @route   PUT /admin/videos/:id
// @access  Private/Admin
exports.updateVideo = async (req, res) => {
    const { id } = req.params;
    const { title, duration, rewardAmount, videoUrl, isActive } = req.body;

    try {
        const video = await Video.findById(id);
        if (!video) {
            return res.status(404).json({ message: 'Vídeo não encontrado.' });
        }

        if (title) video.title = title;
        if (duration) video.duration = duration;
        if (rewardAmount) video.rewardAmount = rewardAmount;
        if (videoUrl) video.videoUrl = videoUrl;
        if (typeof isActive === 'boolean') video.isActive = isActive;

        await video.save();
        res.status(200).json({ message: 'Vídeo atualizado com sucesso!', video });
    } catch (error) {
        console.error('Erro ao atualizar vídeo:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Excluir um vídeo
// @route   DELETE /admin/videos/:id
// @access  Private/Admin
exports.deleteVideo = async (req, res) => {
    const { id } = req.params;

    try {
        const video = await Video.findByIdAndDelete(id);
        if (!video) {
            return res.status(404).json({ message: 'Vídeo não encontrado.' });
        }
        // Opcional: remover o vídeo do Cloudinary se for o caso
        res.status(200).json({ message: 'Vídeo excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir vídeo:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Obter todos os usuários (apenas para admin)
// @route   GET /admin/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-password'); // Não enviar senhas
        res.status(200).json(users);
    } catch (error) {
        console.error('Erro ao obter usuários:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Bloquear um usuário
// @route   PUT /admin/users/:id/block
// @access  Private/Admin
exports.blockUser = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        user.isActive = false; // Adicione um campo isActive no modelo User se ainda não o tiver
        await user.save();
        res.status(200).json({ message: `Usuário ${user.username} bloqueado com sucesso.` });
    } catch (error) {
        console.error('Erro ao bloquear usuário:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Desbloquear um usuário
// @route   PUT /admin/users/:id/unblock
// @access  Private/Admin
exports.unblockUser = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        user.isActive = true; // Adicione um campo isActive no modelo User se ainda não o tiver
        await user.save();
        res.status(200).json({ message: `Usuário ${user.username} desbloqueado com sucesso.` });
    } catch (error) {
        console.error('Erro ao desbloquear usuário:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};


// @desc    Obter depósitos pendentes
// @route   GET /admin/deposits/pending
// @access  Private/Admin
exports.getPendingDeposits = async (req, res) => {
    try {
        const deposits = await Deposit.find({ status: 'pending' }).populate('userId', 'username email');
        res.status(200).json(deposits);
    } catch (error) {
        console.error('Erro ao obter depósitos pendentes:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Aprovar um depósito
// @route   PUT /admin/deposits/:id/approve
// @access  Private/Admin
exports.approveDeposit = async (req, res) => {
    const { id } = req.params;

    try {
        const deposit = await Deposit.findById(id);

        if (!deposit) {
            return res.status(404).json({ message: 'Depósito não encontrado.' });
        }
        if (deposit.status !== 'pending') {
            return res.status(400).json({ message: `Depósito já está ${deposit.status}.` });
        }

        deposit.status = 'approved';
        await deposit.save();

        const user = await User.findById(deposit.userId);
        if (user) {
            user.balance += deposit.amount;
            await user.save();

            // Atualizar transação para status 'completed'
            await Transaction.findOneAndUpdate(
                { relatedId: deposit._id, type: 'deposit' },
                { status: 'completed' }
            );

            res.status(200).json({ message: `Depósito de ${deposit.amount} MT aprovado para ${user.username}.` });
        } else {
            res.status(404).json({ message: 'Usuário do depósito não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao aprovar depósito:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Rejeitar um depósito
// @route   PUT /admin/deposits/:id/reject
// @access  Private/Admin
exports.rejectDeposit = async (req, res) => {
    const { id } = req.params;

    try {
        const deposit = await Deposit.findById(id);

        if (!deposit) {
            return res.status(404).json({ message: 'Depósito não encontrado.' });
        }
        if (deposit.status !== 'pending') {
            return res.status(400).json({ message: `Depósito já está ${deposit.status}.` });
        }

        deposit.status = 'rejected';
        await deposit.save();

        // Atualizar transação para status 'failed'
        await Transaction.findOneAndUpdate(
            { relatedId: deposit._id, type: 'deposit' },
            { status: 'failed' }
        );

        res.status(200).json({ message: `Depósito de ${deposit.amount} MT rejeitado.` });
    } catch (error) {
        console.error('Erro ao rejeitar depósito:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Obter levantamentos pendentes
// @route   GET /admin/withdrawals/pending
// @access  Private/Admin
exports.getPendingWithdrawals = async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({ status: 'pending' }).populate('userId', 'username email');
        res.status(200).json(withdrawals);
    } catch (error) {
        console.error('Erro ao obter levantamentos pendentes:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Aprovar um levantamento
// @route   PUT /admin/withdrawals/:id/approve
// @access  Private/Admin
exports.approveWithdrawal = async (req, res) => {
    const { id } = req.params;

    try {
        const withdrawal = await Withdrawal.findById(id);

        if (!withdrawal) {
            return res.status(404).json({ message: 'Levantamento não encontrado.' });
        }
        if (withdrawal.status !== 'pending') {
            return res.status(400).json({ message: `Levantamento já está ${withdrawal.status}.` });
        }

        const user = await User.findById(withdrawal.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário do levantamento não encontrado.' });
        }
        if (user.balance < withdrawal.amount) {
            // Isso não deveria acontecer se a validação do frontend for boa, mas é um fallback
            withdrawal.status = 'rejected';
            await withdrawal.save();
            await Transaction.findOneAndUpdate(
                { relatedId: withdrawal._id, type: 'withdrawal' },
                { status: 'failed', description: 'Levantamento falhou: saldo insuficiente no momento da aprovação do admin.' }
            );
            return res.status(400).json({ message: 'Saldo insuficiente do usuário para aprovar este levantamento.' });
        }

        // Debitar o saldo do usuário
        user.balance -= withdrawal.amount;
        await user.save();

        withdrawal.status = 'approved';
        await withdrawal.save();

        // Atualizar transação para status 'completed'
        await Transaction.findOneAndUpdate(
            { relatedId: withdrawal._id, type: 'withdrawal' },
            { status: 'completed' }
        );

        res.status(200).json({ message: `Levantamento de ${withdrawal.amount} MT aprovado para ${user.username}. O dinheiro deve ser enviado manualmente para ${withdrawal.phoneNumber}.` });
    } catch (error) {
        console.error('Erro ao aprovar levantamento:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Rejeitar um levantamento
// @route   PUT /admin/withdrawals/:id/reject
// @access  Private/Admin
exports.rejectWithdrawal = async (req, res) => {
    const { id } = req.params;

    try {
        const withdrawal = await Withdrawal.findById(id);

        if (!withdrawal) {
            return res.status(404).json({ message: 'Levantamento não encontrado.' });
        }
        if (withdrawal.status !== 'pending') {
            return res.status(400).json({ message: `Levantamento já está ${withdrawal.status}.` });
        }

        withdrawal.status = 'rejected';
        await withdrawal.save();

        // Atualizar transação para status 'failed'
        await Transaction.findOneAndUpdate(
            { relatedId: withdrawal._id, type: 'withdrawal' },
            { status: 'failed' }
        );

        res.status(200).json({ message: `Levantamento de ${withdrawal.amount} MT rejeitado.` });
    } catch (error) {
        console.error('Erro ao rejeitar levantamento:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Adicionar saldo manualmente a um usuário
// @route   POST /admin/add-balance/:userId
// @access  Private/Admin
exports.addBalanceManually = async (req, res) => {
    const { userId } = req.params;
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Valor inválido. O valor deve ser positivo.' });
    }
    if (!description) {
        return res.status(400).json({ message: 'A descrição é obrigatória.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        user.balance += amount;
        await user.save();

        await Transaction.create({
            userId: user._id,
            type: 'manual_credit', // Novo tipo de transação
            amount: amount,
            description: `Crédito manual: ${description}`,
            status: 'completed'
        });

        res.status(200).json({ message: `Saldo de ${amount} MT adicionado a ${user.username}. Novo saldo: ${user.balance}.` });
    } catch (error) {
        console.error('Erro ao adicionar saldo manualmente:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// @desc    Remover saldo manualmente de um usuário
// @route   POST /admin/remove-balance/:userId
// @access  Private/Admin
exports.removeBalanceManually = async (req, res) => {
    const { userId } = req.params;
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Valor inválido. O valor deve ser positivo.' });
    }
    if (!description) {
        return res.status(400).json({ message: 'A descrição é obrigatória.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        if (user.balance < amount) {
            return res.status(400).json({ message: `Saldo insuficiente para remover ${amount} MT. Saldo atual: ${user.balance}.` });
        }

        user.balance -= amount;
        await user.save();

        await Transaction.create({
            userId: user._id,
            type: 'manual_debit', // Novo tipo de transação
            amount: -amount, // Negativo para débito
            description: `Débito manual: ${description}`,
            status: 'completed'
        });

        res.status(200).json({ message: `Saldo de ${amount} MT removido de ${user.username}. Novo saldo: ${user.balance}.` });
    } catch (error) {
        console.error('Erro ao remover saldo manualmente:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};