// controllers.js
const { User, Plan, Video, Deposit, Withdrawal, Transaction, WatchedVideo } = require('./models');
const { jwt, bcrypt, nodemailer, cloudinary, transporter, upload, JWT_SECRET } = require('./server'); // Remover moment daqui
const moment = require('moment-timezone'); // Importar moment-timezone diretamente aqui
const { generateReferralCode, sendVerificationEmail, sendPasswordResetEmail, generateRandomPassword, generateToken } = require('./utils'); // Funções auxiliares

// Configurar timezone para Maputo
moment.tz.setDefault("Africa/Maputo");
// --- Funções Auxiliares (podem ser movidas para utils.js depois de prontas) ---

// Função para verificar se um usuário está autenticado
const protect = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'Não autorizado, nenhum token fornecido.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded.id; // ID do usuário do token
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token inválido ou expirado.' });
    }
};

// Função para verificar se o usuário é um admin
const authorizeAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user);
        if (user && user.isAdmin) { // Assumindo que você terá um campo isAdmin no seu modelo User
            next();
        } else {
            res.status(403).json({ message: 'Acesso negado: Você não tem permissão de administrador.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor ao verificar permissões.' });
    }
};

// --- Funções de Autenticação e Usuário ---

exports.registerUser = async (req, res) => {
    const { username, email, password, referredByCode } = req.body;

    // Validação básica
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Por favor, preencha todos os campos obrigatórios.' });
    }

    try {
        // Verificar se o usuário ou e-mail já existe
        const userExists = await User.findOne({ $or: [{ username }, { email }] });
        if (userExists) {
            return res.status(400).json({ message: 'Nome de usuário ou e-mail já registrado.' });
        }

        // Hash da senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Gerar código de referência único
        let referralCode = generateReferralCode();
        let codeExists = await User.findOne({ referralCode });
        while (codeExists) {
            referralCode = generateReferralCode();
            codeExists = await User.findOne({ referralCode });
        }

        let referredBy = null;
        if (referredByCode) {
            const referrer = await User.findOne({ referralCode: referredByCode });
            if (referrer) {
                referredBy = referrer._id;
            } else {
                return res.status(400).json({ message: 'Código de referência inválido.' });
            }
        }

        // Criar novo usuário
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            referralCode,
            referredBy
        });

        if (user) {
            // Enviar e-mail de boas-vindas
            await sendVerificationEmail(user.email, user.username); // Adaptar esta função para ser de boas-vindas

            res.status(201).json({
                message: 'Usuário registrado com sucesso!',
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    balance: user.balance,
                    referralCode: user.referralCode,
                    token: generateToken(user._id)
                }
            });
        } else {
            res.status(400).json({ message: 'Dados do usuário inválidos.' });
        }
    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao registrar usuário.' });
    }
};

exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Por favor, insira e-mail e senha.' });
    }

    try {
        const user = await User.findOne({ email });

        if (user && (await bcrypt.compare(password, user.password))) {
            if (!user.isActive) {
                return res.status(403).json({ message: 'Sua conta está inativa. Por favor, contate o suporte.' });
            }
            res.json({
                message: 'Login bem-sucedido!',
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    avatar: user.avatar,
                    balance: user.balance,
                    plan: user.plan,
                    planExpiresAt: user.planExpiresAt,
                    referralCode: user.referralCode,
                    isAdmin: user.isAdmin || false // Adicionar isAdmin ao payload se existir
                },
                token: generateToken(user._id)
            });
        } else {
            res.status(401).json({ message: 'Credenciais inválidas.' });
        }
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao fazer login.' });
    }
};

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Nenhum usuário encontrado com este e-mail.' });
        }

        const resetToken = generateToken(user._id); // Reutilizar a função de gerar token JWT
        user.passwordResetToken = resetToken;
        user.passwordResetExpires = Date.now() + 3600000; // 1 hora
        await user.save();

        const resetURL = `${req.protocol}://veed.com/reset-password/${resetToken}`; // URL do frontend

        await sendPasswordResetEmail(user.email, resetURL);

        res.status(200).json({ message: 'E-mail de recuperação de senha enviado.' });

    } catch (error) {
        console.error('Erro ao solicitar recuperação de senha:', error);
        res.status(500).json({ message: 'Erro ao enviar e-mail de recuperação de senha.' });
    }
};

exports.resetPassword = async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
        return res.status(400).json({ message: 'Por favor, insira a nova senha.' });
    }

    try {
        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Token inválido ou expirado.' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Senha redefinida com sucesso!' });

    } catch (error) {
        console.error('Erro ao redefinir senha:', error);
        res.status(500).json({ message: 'Erro ao redefinir sua senha.' });
    }
};

exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user).select('-password'); // Excluir a senha
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'Usuário não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao obter perfil do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar perfil.' });
    }
};

exports.updateUserProfile = async (req, res) => {
    const { username, email, newPassword } = req.body;

    try {
        const user = await User.findById(req.user);

        if (user) {
            user.username = username || user.username;
            user.email = email || user.email;

            if (newPassword) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(newPassword, salt);
            }

            const updatedUser = await user.save();
            res.json({
                message: 'Perfil atualizado com sucesso!',
                user: {
                    _id: updatedUser._id,
                    username: updatedUser.username,
                    email: updatedUser.email,
                    avatar: updatedUser.avatar,
                    balance: updatedUser.balance
                }
            });
        } else {
            res.status(404).json({ message: 'Usuário não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao atualizar perfil do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao atualizar perfil.' });
    }
};

exports.updateUserAvatar = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo de imagem fornecido.' });
    }

    try {
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'veed_avatars',
            width: 150,
            height: 150,
            crop: 'fill'
        });

        const user = await User.findById(req.user);
        if (user) {
            user.avatar = result.secure_url;
            await user.save();
            res.json({ message: 'Avatar atualizado com sucesso!', avatarUrl: user.avatar });
        } else {
            res.status(404).json({ message: 'Usuário não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao fazer upload do avatar:', error);
        res.status(500).json({ message: 'Erro ao fazer upload da imagem do avatar.' });
    }
};

// --- Funções de Planos ---

exports.createPlan = async (req, res) => {
    const { name, value, videosPerDay, durationDays, dailyReward } = req.body;

    if (!name || !value || !videosPerDay || !durationDays || !dailyReward) {
        return res.status(400).json({ message: 'Por favor, preencha todos os campos do plano.' });
    }

    try {
        const totalReward = dailyReward * videosPerDay * durationDays; // Calcular recompensa total
        const plan = await Plan.create({
            name,
            value,
            videosPerDay,
            durationDays,
            dailyReward,
            totalReward
        });
        res.status(201).json({ message: 'Plano criado com sucesso!', plan });
    } catch (error) {
        console.error('Erro ao criar plano:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao criar plano.' });
    }
};

exports.getAllPlans = async (req, res) => {
    try {
        const plans = await Plan.find({});
        res.json(plans);
    } catch (error) {
        console.error('Erro ao obter planos:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar planos.' });
    }
};

exports.getPlanById = async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (plan) {
            res.json(plan);
        } else {
            res.status(404).json({ message: 'Plano não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao obter plano por ID:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar plano.' });
    }
};

// --- Funções de Depósito ---

exports.createDeposit = async (req, res) => {
    const { amount, method, proof } = req.body; // 'proof' será uma URL ou texto

    if (!amount || !method || !proof) {
        return res.status(400).json({ message: 'Por favor, preencha todos os campos do depósito e envie o comprovante.' });
    }
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'O valor do depósito deve ser um número positivo.' });
    }

    try {
        const deposit = await Deposit.create({
            user: req.user, // ID do usuário do token
            amount,
            method,
            proof
        });

        // Registrar transação
        await Transaction.create({
            user: req.user,
            type: 'deposit',
            amount,
            description: `Depósito pendente via ${method} no valor de ${amount}MT`,
            reference: deposit._id
        });

        res.status(201).json({ message: 'Depósito enviado com sucesso e aguardando aprovação!', deposit });
    } catch (error) {
        console.error('Erro ao criar depósito:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao criar depósito.' });
    }
};

exports.getPendingDeposits = async (req, res) => {
    try {
        const deposits = await Deposit.find({ status: 'pending' }).populate('user', 'username email');
        res.json(deposits);
    } catch (error) {
        console.error('Erro ao obter depósitos pendentes:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar depósitos pendentes.' });
    }
};

exports.approveDeposit = async (req, res) => {
    const { depositId } = req.params;

    try {
        const deposit = await Deposit.findById(depositId);

        if (!deposit) {
            return res.status(404).json({ message: 'Depósito não encontrado.' });
        }
        if (deposit.status !== 'pending') {
            return res.status(400).json({ message: 'Este depósito já foi processado.' });
        }

        deposit.status = 'approved';
        deposit.processedBy = req.user; // ID do admin que aprovou
        deposit.processedAt = Date.now();
        await deposit.save();

        // Atualizar saldo do usuário
        const user = await User.findById(deposit.user);
        if (user) {
            user.balance += deposit.amount;
            await user.save();
        }

        // Atualizar transação
        await Transaction.findOneAndUpdate(
            { reference: deposit._id, type: 'deposit' },
            { $set: { description: `Depósito aprovado via ${deposit.method} no valor de ${deposit.amount}MT` } },
            { new: true }
        );


        res.status(200).json({ message: 'Depósito aprovado com sucesso!', deposit });

    } catch (error) {
        console.error('Erro ao aprovar depósito:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao aprovar depósito.' });
    }
};

exports.rejectDeposit = async (req, res) => {
    const { depositId } = req.params;
    const { reason } = req.body; // Opcional: motivo da rejeição

    try {
        const deposit = await Deposit.findById(depositId);

        if (!deposit) {
            return res.status(404).json({ message: 'Depósito não encontrado.' });
        }
        if (deposit.status !== 'pending') {
            return res.status(400).json({ message: 'Este depósito já foi processado.' });
        }

        deposit.status = 'rejected';
        deposit.processedBy = req.user; // ID do admin que rejeitou
        deposit.processedAt = Date.now();
        await deposit.save();

        // Atualizar transação
        await Transaction.findOneAndUpdate(
            { reference: deposit._id, type: 'deposit' },
            { $set: { description: `Depósito rejeitado: ${reason || 'Motivo não especificado'}` } },
            { new: true }
        );

        res.status(200).json({ message: 'Depósito rejeitado com sucesso!', deposit });

    } catch (error) {
        console.error('Erro ao rejeitar depósito:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao rejeitar depósito.' });
    }
};

// --- Funções de Compra de Plano ---

exports.purchasePlan = async (req, res) => {
    const { planId } = req.body;

    try {
        const user = await User.findById(req.user);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(404).json({ message: 'Plano não encontrado.' });
        }

        if (user.balance < plan.value) {
            return res.status(400).json({ message: 'Saldo insuficiente para comprar este plano.' });
        }

        if (user.plan && user.planExpiresAt && user.planExpiresAt > Date.now()) {
             return res.status(400).json({ message: 'Você já possui um plano ativo. Aguarde a expiração ou cancele o plano atual.' });
        }

        user.balance -= plan.value;
        user.plan = plan._id;
        user.planExpiresAt = moment().add(plan.durationDays, 'days').toDate(); // Define a data de expiração
        user.videosWatchedToday = 0; // Reseta a contagem de vídeos do dia ao ativar um novo plano
        user.lastVideoWatchDate = null; // Reseta a data para garantir que a recompensa diária seja avaliada corretamente no próximo dia

        await user.save();

        // Registrar transação
        await Transaction.create({
            user: req.user,
            type: 'plan_purchase',
            amount: -plan.value, // Negativo para indicar débito
            description: `Compra do plano: ${plan.name} (${plan.value}MT)`,
            reference: plan._id
        });

        // Bônus de referência (10% do valor do plano)
        if (user.referredBy) {
            const referrer = await User.findById(user.referredBy);
            if (referrer) {
                const bonus = plan.value * 0.10;
                referrer.balance += bonus;
                await referrer.save();

                await Transaction.create({
                    user: referrer._id,
                    type: 'referral_plan_bonus',
                    amount: bonus,
                    description: `Bônus de 10% da compra do plano '${plan.name}' pelo indicado ${user.username}`,
                    reference: user._id // Referência ao usuário que comprou o plano
                });
            }
        }

        res.status(200).json({
            message: 'Plano comprado e ativado com sucesso!',
            user: {
                balance: user.balance,
                plan: user.plan,
                planExpiresAt: user.planExpiresAt
            }
        });

    } catch (error) {
        console.error('Erro ao comprar plano:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao comprar plano.' });
    }
};

// --- Funções de Vídeos ---

exports.addVideo = async (req, res) => {
    const { title, url, duration } = req.body; // 'url' pode ser de Cloudinary ou de outro host

    if (!title || !url || !duration) {
        return res.status(400).json({ message: 'Por favor, preencha todos os campos do vídeo.' });
    }
    if (isNaN(duration) || duration <= 0) {
        return res.status(400).json({ message: 'A duração do vídeo deve ser um número positivo em segundos.' });
    }

    try {
        const video = await Video.create({
            title,
            url,
            duration
        });
        res.status(201).json({ message: 'Vídeo adicionado com sucesso!', video });
    } catch (error) {
        console.error('Erro ao adicionar vídeo:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao adicionar vídeo.' });
    }
};

exports.getDailyVideos = async (req, res) => {
    try {
        const user = await User.findById(req.user).populate('plan');
        if (!user || !user.plan || user.planExpiresAt < Date.now()) {
            return res.status(400).json({ message: 'Você não tem um plano ativo para assistir vídeos.' });
        }

        // Resetar a contagem diária de vídeos e recompensa se for um novo dia em Maputo
        const now = moment().tz("Africa/Maputo");
        const lastWatchDate = user.lastVideoWatchDate ? moment(user.lastVideoWatchDate).tz("Africa/Maputo") : null;

        if (!lastWatchDate || lastWatchDate.format('YYYY-MM-DD') !== now.format('YYYY-MM-DD')) {
            user.videosWatchedToday = 0;
            user.dailyRewardClaimed = false;
            await user.save();
        }

        if (user.videosWatchedToday >= user.plan.videosPerDay) {
            return res.status(400).json({ message: 'Você já assistiu todos os vídeos disponíveis para hoje.' });
        }

        // Buscar vídeos que o usuário ainda não assistiu hoje
        const watchedVideosToday = await WatchedVideo.find({
            user: req.user,
            watchedAt: {
                $gte: moment().tz("Africa/Maputo").startOf('day').toDate(),
                $lt: moment().tz("Africa/Maputo").endOf('day').toDate()
            }
        }).select('video');

        const watchedVideoIds = watchedVideosToday.map(wv => wv.video);

        // Buscar vídeos ativos que não foram assistidos hoje e limitar pela quantidade necessária
        const availableVideos = await Video.find({
            _id: { $nin: watchedVideoIds },
            isActive: true
        }).limit(user.plan.videosPerDay - user.videosWatchedToday); // Pegar apenas a quantidade que falta

        if (availableVideos.length === 0) {
            return res.status(404).json({ message: 'Nenhum vídeo novo disponível para hoje ou todos já foram assistidos.' });
        }

        res.json(availableVideos);

    } catch (error) {
        console.error('Erro ao obter vídeos diários:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar vídeos diários.' });
    }
};


exports.markVideoAsWatched = async (req, res) => {
    const { videoId } = req.params;

    try {
        const user = await User.findById(req.user).populate('plan');
        if (!user || !user.plan || user.planExpiresAt < Date.now()) {
            return res.status(400).json({ message: 'Você não tem um plano ativo ou ele expirou.' });
        }

        const video = await Video.findById(videoId);
        if (!video || !video.isActive) {
            return res.status(404).json({ message: 'Vídeo não encontrado ou inativo.' });
        }

        // Resetar a contagem diária de vídeos se for um novo dia em Maputo
        const now = moment().tz("Africa/Maputo");
        const lastWatchDate = user.lastVideoWatchDate ? moment(user.lastVideoWatchDate).tz("Africa/Maputo") : null;

        if (!lastWatchDate || lastWatchDate.format('YYYY-MM-DD') !== now.format('YYYY-MM-DD')) {
            user.videosWatchedToday = 0;
            user.dailyRewardClaimed = false; // Resetar o status de recompensa diária
        }


        // Verificar se o vídeo já foi assistido hoje
        const alreadyWatchedToday = await WatchedVideo.findOne({
            user: req.user,
            video: videoId,
            watchedAt: {
                $gte: moment().tz("Africa/Maputo").startOf('day').toDate(),
                $lt: moment().tz("Africa/Maputo").endOf('day').toDate()
            }
        });

        if (alreadyWatchedToday) {
            return res.status(400).json({ message: 'Você já assistiu este vídeo hoje.' });
        }

        if (user.videosWatchedToday >= user.plan.videosPerDay) {
            return res.status(400).json({ message: 'Você atingiu o limite diário de vídeos para o seu plano.' });
        }

        // Adicionar recompensa ao saldo
        const reward = user.plan.dailyReward;
        user.balance += reward;
        user.videosWatchedToday += 1;
        user.lastVideoWatchDate = now.toDate(); // Atualiza a data da última visualização

        await user.save();

        // Registrar vídeo assistido
        await WatchedVideo.create({
            user: req.user,
            video: videoId,
            rewardEarned: reward
        });

        // Registrar transação da recompensa do vídeo
        await Transaction.create({
            user: req.user,
            type: 'video_reward',
            amount: reward,
            description: `Recompensa por assistir vídeo: ${video.title}`,
            reference: videoId
        });

        // Se todos os vídeos do dia foram assistidos, pagar o bônus de referência (5% da renda diária do indicado)
        if (user.videosWatchedToday === user.plan.videosPerDay) {
            // Marcar que a recompensa diária foi reivindicada
            user.dailyRewardClaimed = true;
            await user.save();

            if (user.referredBy) {
                const referrer = await User.findById(user.referredBy);
                if (referrer) {
                    const dailyBonus = user.plan.dailyReward * user.plan.videosPerDay * 0.05; // 5% da renda diária total do referido
                    referrer.balance += dailyBonus;
                    await referrer.save();

                    await Transaction.create({
                        user: referrer._id,
                        type: 'referral_daily_bonus',
                        amount: dailyBonus,
                        description: `Bônus diário de 5% da renda diária de ${user.username}`,
                        reference: user._id // Referência ao usuário que gerou o bônus
                    });
                }
            }
        }

        res.status(200).json({
            message: 'Vídeo assistido com sucesso! Recompensa creditada.',
            newBalance: user.balance,
            videosLeftToday: user.plan.videosPerDay - user.videosWatchedToday
        });

    } catch (error) {
        console.error('Erro ao marcar vídeo como assistido:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao processar visualização do vídeo.' });
    }
};

exports.getVideoHistory = async (req, res) => {
    try {
        const history = await WatchedVideo.find({ user: req.user })
            .populate('video', 'title url duration') // Popula com informações do vídeo
            .sort({ watchedAt: -1 }); // Ordena do mais recente para o mais antigo

        res.json(history);
    } catch (error) {
        console.error('Erro ao obter histórico de vídeos:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar histórico de vídeos.' });
    }
};

// --- Funções de Levantamento ---

exports.requestWithdrawal = async (req, res) => {
    const { amount, method, accountNumber } = req.body;

    if (!amount || !method || !accountNumber) {
        return res.status(400).json({ message: 'Por favor, preencha todos os campos para o levantamento.' });
    }
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'O valor do levantamento deve ser um número positivo.' });
    }

    try {
        const user = await User.findById(req.user);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        if (user.balance < amount) {
            return res.status(400).json({ message: 'Saldo insuficiente para este levantamento.' });
        }

        // Cria o pedido de levantamento com status pendente
        const withdrawal = await Withdrawal.create({
            user: req.user,
            amount,
            method,
            accountNumber,
            status: 'pending'
        });

        // Debitar o valor do saldo do usuário imediatamente
        user.balance -= amount;
        await user.save();

        // Registrar transação
        await Transaction.create({
            user: req.user,
            type: 'withdrawal',
            amount: -amount, // Negativo para indicar débito
            description: `Solicitação de levantamento pendente via ${method} para ${accountNumber} no valor de ${amount}MT`,
            reference: withdrawal._id
        });

        res.status(201).json({ message: 'Solicitação de levantamento enviada com sucesso e aguardando aprovação!', withdrawal });

    } catch (error) {
        console.error('Erro ao solicitar levantamento:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao solicitar levantamento.' });
    }
};

exports.getPendingWithdrawals = async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({ status: 'pending' }).populate('user', 'username email');
        res.json(withdrawals);
    } catch (error) {
        console.error('Erro ao obter levantamentos pendentes:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar levantamentos pendentes.' });
    }
};

exports.approveWithdrawal = async (req, res) => {
    const { withdrawalId } = req.params;

    try {
        const withdrawal = await Withdrawal.findById(withdrawalId);

        if (!withdrawal) {
            return res.status(404).json({ message: 'Levantamento não encontrado.' });
        }
        if (withdrawal.status !== 'pending') {
            return res.status(400).json({ message: 'Este levantamento já foi processado.' });
        }

        withdrawal.status = 'approved';
        withdrawal.processedBy = req.user; // ID do admin que aprovou
        withdrawal.processedAt = Date.now();
        await withdrawal.save();

        // Atualizar transação para status aprovado
        await Transaction.findOneAndUpdate(
            { reference: withdrawal._id, type: 'withdrawal' },
            { $set: { description: `Levantamento aprovado via ${withdrawal.method} para ${withdrawal.accountNumber} no valor de ${withdrawal.amount}MT` } },
            { new: true }
        );

        res.status(200).json({ message: 'Levantamento aprovado com sucesso!', withdrawal });

    } catch (error) {
        console.error('Erro ao aprovar levantamento:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao aprovar levantamento.' });
    }
};

exports.rejectWithdrawal = async (req, res) => {
    const { withdrawalId } = req.params;
    const { reason } = req.body;

    try {
        const withdrawal = await Withdrawal.findById(withdrawalId);

        if (!withdrawal) {
            return res.status(404).json({ message: 'Levantamento não encontrado.' });
        }
        if (withdrawal.status !== 'pending') {
            return res.status(400).json({ message: 'Este levantamento já foi processado.' });
        }

        withdrawal.status = 'rejected';
        withdrawal.processedBy = req.user; // ID do admin que rejeitou
        withdrawal.processedAt = Date.now();
        await withdrawal.save();

        // Estornar o valor para o saldo do usuário, já que foi rejeitado
        const user = await User.findById(withdrawal.user);
        if (user) {
            user.balance += withdrawal.amount;
            await user.save();
        }

        // Atualizar transação para status rejeitado
        await Transaction.findOneAndUpdate(
            { reference: withdrawal._id, type: 'withdrawal' },
            { $set: { description: `Levantamento rejeitado: ${reason || 'Motivo não especificado'}. Valor estornado para o saldo.` } },
            { new: true }
        );

        res.status(200).json({ message: 'Levantamento rejeitado com sucesso! Valor estornado para o usuário.', withdrawal });

    } catch (error) {
        console.error('Erro ao rejeitar levantamento:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao rejeitar levantamento.' });
    }
};

// --- Funções de Transações ---

exports.getUserTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find({ user: req.user }).sort({ createdAt: -1 });
        res.json(transactions);
    } catch (error) {
        console.error('Erro ao obter transações do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar transações.' });
    }
};


// --- Funções de Admin Dashboard e Gerenciamento ---

exports.getAdminDashboardStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activePlansCount = await User.countDocuments({ plan: { $ne: null }, planExpiresAt: { $gt: Date.now() } });
        const pendingDepositsCount = await Deposit.countDocuments({ status: 'pending' });
        const pendingWithdrawalsCount = await Withdrawal.countDocuments({ status: 'pending' });

        const totalBalanceOnPlatform = await User.aggregate([
            { $group: { _id: null, total: { $sum: '$balance' } } }
        ]);

        res.json({
            totalUsers,
            activePlansCount,
            pendingDepositsCount,
            pendingWithdrawalsCount,
            totalBalanceOnPlatform: totalBalanceOnPlatform.length > 0 ? totalBalanceOnPlatform[0].total : 0
        });
    } catch (error) {
        console.error('Erro ao obter estatísticas do admin dashboard:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar estatísticas.' });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-password').populate('plan', 'name'); // Excluir senhas e popular plano
        res.json(users);
    } catch (error) {
        console.error('Erro ao obter todos os usuários:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar usuários.' });
    }
};

exports.toggleUserActiveStatus = async (req, res) => {
    const { userId } = req.params;
    const { isActive } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        user.isActive = isActive;
        await user.save();
        res.json({ message: `Usuário ${user.username} agora está ${isActive ? 'ativo' : 'inativo'}.`, user });
    } catch (error) {
        console.error('Erro ao alternar status do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao alternar status do usuário.' });
    }
};

exports.addRemoveUserBalance = async (req, res) => {
    const { userId } = req.params;
    const { amount, type, description } = req.body; // type: 'add' ou 'remove'

    if (!amount || isNaN(amount) || amount <= 0 || !type || !['add', 'remove'].includes(type) || !description) {
        return res.status(400).json({ message: 'Dados inválidos para ajuste de saldo.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        let finalAmount = amount;
        if (type === 'add') {
            user.balance += amount;
        } else { // type === 'remove'
            if (user.balance < amount) {
                return res.status(400).json({ message: 'Saldo do usuário insuficiente para remover este valor.' });
            }
            user.balance -= amount;
            finalAmount = -amount; // Para registrar como débito na transação
        }

        await user.save();

        // Registrar transação de ajuste manual
        await Transaction.create({
            user: userId,
            type: 'admin_adjustment',
            amount: finalAmount,
            description: `Ajuste de saldo por admin: ${description}`
        });

        res.json({ message: `Saldo do usuário ${user.username} ajustado com sucesso. Novo saldo: ${user.balance}MT`, user });

    } catch (error) {
        console.error('Erro ao ajustar saldo do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao ajustar saldo do usuário.' });
    }
};

// Funções para upload de vídeo diretamente via Multer/Cloudinary (para vídeos locais)
exports.uploadVideoLocal = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo de vídeo fornecido.' });
    }
    const { title, duration } = req.body;

    if (!title || !duration || isNaN(duration) || duration <= 0) {
        return res.status(400).json({ message: 'Por favor, forneça o título e a duração do vídeo.' });
    }

    try {
        // req.file.path é o caminho temporário do arquivo em disco (se você usar diskStorage)
        // Se usar memoryStorage, precisará de um Buffer, então use req.file.buffer
        const result = await cloudinary.uploader.upload(req.file.path || `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`, {
            resource_type: "video",
            folder: 'veed_videos'
        });

        const video = await Video.create({
            title,
            url: result.secure_url,
            duration
        });

        res.status(201).json({ message: 'Vídeo carregado e adicionado com sucesso via upload local!', video });
    } catch (error) {
        console.error('Erro ao fazer upload de vídeo localmente:', error);
        res.status(500).json({ message: 'Erro ao fazer upload do vídeo.' });
    }
};

// Proteção de middleware exportada para uso em routes.js
exports.protect = protect;
exports.authorizeAdmin = authorizeAdmin;