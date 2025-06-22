// controllers.js
const { User, Plan, Video, Deposit, Transaction } = require('./models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const moment = require('moment-timezone'); // Usaremos moment-timezone para lidar com o fuso horário de Maputo
const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid'); // Para gerar tokens de verificação únicos
const path = require('path'); // Para resolver caminhos de arquivo, se necessário, mas minimamente usado para urls de redirecionamento


// Carregar variáveis de ambiente
dotenv.config();

// Configuração do Nodemailer para Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Função auxiliar para gerar token JWT
const generateToken = (id, isAdmin) => {
    return jwt.sign({ id, isAdmin }, process.env.JWT_SECRET, {
        expiresIn: '30d', // Token expira em 30 dias
    });
};

// --- Funções de Autenticação e Usuário ---

// @desc    Registrar novo usuário
// @route   POST /api/register
// @access  Public
exports.registerUser = async (req, res) => {
    const { nome, email, senha, referidoPorCode } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ message: 'Por favor, preencha todos os campos obrigatórios.' });
    }

    try {
        let userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'Usuário com este email já existe.' });
        }

        // Hash da senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(senha, salt);

        // Gerar código de referência único para o novo usuário
        const referralCode = uuidv4().slice(0, 8); // Um código de 8 caracteres

        let referidoPorId = null;
        if (referidoPorCode) {
            const referer = await User.findOne({ referralCode: referidoPorCode });
            if (referer) {
                referidoPorId = referer._id;
            } else {
                return res.status(400).json({ message: 'Código de referência inválido.' });
            }
        }

        // Gerar token de verificação de email
        const verificationToken = uuidv4();

        const user = await User.create({
            nome,
            email,
            senha: hashedPassword,
            referralCode,
            referidoPor: referidoPorId,
            verificationToken
        });

        if (user) {
            // Enviar email de verificação
            const verificationUrl = `${req.protocol}://${req.get('host')}/api/verify-email/${verificationToken}`;
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: user.email,
                subject: 'Verifique seu Email - Bem-vindo ao VEED!',
                html: `
                    <p style="font-family: 'Poppins', sans-serif;">Olá ${user.nome},</p>
                    <p style="font-family: 'Poppins', sans-serif;">Bem-vindo à plataforma VEED! Para ativar sua conta e começar a ganhar, por favor, clique no link abaixo para verificar seu endereço de email:</p>
                    <p style="font-family: 'Poppins', sans-serif;"><a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verificar Email Agora</a></p>
                    <p style="font-family: 'Poppins', sans-serif;">Se você não solicitou isso, pode ignorar este email.</p>
                    <p style="font-family: 'Poppins', sans-serif;">Atenciosamente,<br>Equipe VEED</p>
                `,
            };

            await transporter.sendMail(mailOptions);

            res.status(201).json({
                message: 'Usuário registrado com sucesso! Por favor, verifique seu email para ativar a conta.',
                userId: user._id,
                email: user.email
            });
        } else {
            res.status(400).json({ message: 'Dados do usuário inválidos.' });
        }
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({ message: 'Erro no servidor ao registrar usuário.' });
    }
};

// @desc    Verificar email do usuário
// @route   GET /api/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
    const { token } = req.params;

    try {
        const user = await User.findOne({ verificationToken: token });

        if (!user) {
            return res.status(400).send('Link de verificação inválido ou expirado.');
        }

        user.emailVerificado = true;
        user.verificationToken = undefined; // Remover o token após a verificação
        await user.save();

        // Redirecionar para uma página de sucesso (ex: login ou dashboard)
        // Como os arquivos são embutidos, você pode redirecionar para uma URL amigável
        res.status(200).send(`
            <!DOCTYPE html>
            <html lang="pt">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Email Verificado - VEED</title>
                <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
                <style>
                    body {
                        font-family: 'Poppins', sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        background-color: #f0f2f5;
                        margin: 0;
                        color: #333;
                        text-align: center;
                    }
                    .container {
                        background-color: #ffffff;
                        padding: 40px;
                        border-radius: 10px;
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                        max-width: 500px;
                        width: 90%;
                    }
                    h1 {
                        color: #28a745;
                        margin-bottom: 20px;
                    }
                    p {
                        font-size: 1.1em;
                        line-height: 1.6;
                        margin-bottom: 30px;
                    }
                    a {
                        background-color: #007bff;
                        color: white;
                        padding: 12px 25px;
                        text-decoration: none;
                        border-radius: 5px;
                        font-weight: 600;
                        transition: background-color 0.3s ease;
                    }
                    a:hover {
                        background-color: #0056b3;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Email Verificado com Sucesso!</h1>
                    <p>Sua conta VEED foi ativada. Você já pode fazer login e começar a explorar a plataforma.</p>
                    <a href="/login">Ir para a página de Login</a>
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Erro ao verificar email:', error);
        res.status(500).send('Erro no servidor ao verificar email.');
    }
};


// @desc    Autenticar usuário e obter token
// @route   POST /api/login
// @access  Public
exports.loginUser = async (req, res) => {
    const { email, senha } = req.body;

    // Verificar se o usuário existe
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(senha, user.senha))) {
        if (!user.emailVerificado) {
            return res.status(401).json({ message: 'Por favor, verifique seu email antes de fazer login.' });
        }

        res.json({
            _id: user._id,
            nome: user.nome,
            email: user.email,
            isAdmin: user.isAdmin,
            saldo: user.saldo,
            planoAtual: user.planoAtual,
            avatar: user.avatar,
            token: generateToken(user._id, user.isAdmin),
        });
    } else {
        res.status(401).json({ message: 'Email ou senha inválidos.' });
    }
};

// @desc    Obter perfil do usuário
// @route   GET /api/me
// @access  Private
exports.getProfile = async (req, res) => {
    const user = await User.findById(req.user.id).select('-senha'); // Excluir a senha

    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ message: 'Usuário não encontrado.' });
    }
};

// @desc    Atualizar perfil do usuário
// @route   PUT /api/me
// @access  Private
exports.updateProfile = async (req, res) => {
    const user = await User.findById(req.user.id);

    if (user) {
        user.nome = req.body.nome || user.nome;
        // Lidar com upload de avatar via Cloudinary
        if (req.body.avatar) { // Assumindo que o avatar vem como uma string base64 ou URL pré-carregada
            try {
                const result = await cloudinary.uploader.upload(req.body.avatar, {
                    folder: 'veed_avatars',
                    transformation: [{ width: 150, height: 150, crop: 'fill', gravity: 'face' }]
                });
                user.avatar = result.secure_url;
            } catch (error) {
                console.error('Erro ao fazer upload do avatar para o Cloudinary:', error);
                return res.status(500).json({ message: 'Erro ao fazer upload do avatar.' });
            }
        }

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            nome: updatedUser.nome,
            email: updatedUser.email,
            avatar: updatedUser.avatar,
            saldo: updatedUser.saldo,
            message: 'Perfil atualizado com sucesso!'
        });
    } else {
        res.status(404).json({ message: 'Usuário não encontrado.' });
    }
};

// @desc    Alterar senha do usuário
// @route   PUT /api/change-password
// @access  Private
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);

    if (user && (await bcrypt.compare(currentPassword, user.senha))) {
        const salt = await bcrypt.genSalt(10);
        user.senha = await bcrypt.hash(newPassword, salt);
        await user.save();
        res.json({ message: 'Senha alterada com sucesso!' });
    } else {
        res.status(401).json({ message: 'Senha atual incorreta.' });
    }
};

// @desc    Alterar email do usuário (requer nova verificação)
// @route   PUT /api/change-email
// @access  Private
exports.changeEmail = async (req, res) => {
    const { newEmail } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    if (user.email === newEmail) {
        return res.status(400).json({ message: 'O novo email é o mesmo que o atual.' });
    }

    const emailExists = await User.findOne({ email: newEmail });
    if (emailExists && String(emailExists._id) !== String(user._id)) {
        return res.status(400).json({ message: 'Este email já está em uso por outra conta.' });
    }

    // Gerar novo token de verificação e desativar o email atual
    const newVerificationToken = uuidv4();
    user.email = newEmail; // Atualiza o email para o novo
    user.emailVerificado = false; // Define como não verificado
    user.verificationToken = newVerificationToken; // Define o novo token
    await user.save();

    // Enviar email de verificação para o novo email
    const verificationUrl = `${req.protocol}://${req.get('host')}/api/verify-email/${newVerificationToken}`;
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Verifique seu Novo Email - VEED!',
        html: `
            <p style="font-family: 'Poppins', sans-serif;">Olá ${user.nome},</p>
            <p style="font-family: 'Poppins', sans-serif;">Você solicitou a alteração do seu email na plataforma VEED. Por favor, clique no link abaixo para verificar seu novo endereço de email:</p>
            <p style="font-family: 'Poppins', sans-serif;"><a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verificar Novo Email Agora</a></p>
            <p style="font-family: 'Poppins', sans-serif;">Sua conta estará inativa até que o novo email seja verificado. Se você não solicitou esta alteração, por favor, entre em contato conosco imediatamente.</p>
            <p style="font-family: 'Poppins', sans-serif;">Atenciosamente,<br>Equipe VEED</p>
        `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Email alterado com sucesso! Um link de verificação foi enviado para o novo endereço.' });
};


// --- Funções de Planos ---

// @desc    Obter todos os planos disponíveis
// @route   GET /api/plans
// @access  Public
exports.getPlans = async (req, res) => {
    try {
        const plans = await Plan.find({});
        res.json(plans);
    } catch (error) {
        console.error('Erro ao buscar planos:', error);
        res.status(500).json({ message: 'Erro no servidor ao buscar planos.' });
    }
};

// @desc    Comprar um plano
// @route   POST /api/plans/:planId/buy
// @access  Private
exports.buyPlan = async (req, res) => {
    const { planId } = req.params;
    const userId = req.user.id;

    try {
        const user = await User.findById(userId);
        const plan = await Plan.findById(planId);

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        if (!plan) {
            return res.status(404).json({ message: 'Plano não encontrado.' });
        }
        if (!user.emailVerificado) {
            return res.status(400).json({ message: 'Seu email precisa ser verificado para comprar um plano.' });
        }

        if (user.planoAtual && user.planoAtual.toString() === planId.toString()) {
            return res.status(400).json({ message: 'Você já possui este plano ativo.' });
        }

        if (user.saldo < plan.valor) {
            return res.status(400).json({ message: 'Saldo insuficiente para comprar este plano. Por favor, faça um depósito.' });
        }

        // Debitar valor do plano do saldo do usuário
        user.saldo -= plan.valor;
        user.planoAtual = plan._id;
        user.dataAtivacaoPlano = new Date();
        user.ganhoDiario = plan.recompensaDiaria; // Define o ganho diário base do plano
        user.videosAssistidosHoje = 0; // Reseta a contagem de vídeos para o novo plano
        user.ultimoResetVideos = moment().tz('Africa/Maputo').startOf('day').toDate(); // Define a data do último reset

        await user.save();

        // Registrar transação de compra de plano
        await Transaction.create({
            userId: user._id,
            tipo: 'compra_plano',
            valor: -plan.valor, // Valor negativo pois é um débito
            referencia: plan._id,
            descricao: `Compra do plano: ${plan.nome}`
        });

        // Lógica para bônus de referência (10% do valor do plano)
        if (user.referidoPor) {
            const referer = await User.findById(user.referidoPor);
            if (referer) {
                const bonus = plan.valor * 0.10;
                referer.saldo += bonus;
                await referer.save();

                await Transaction.create({
                    userId: referer._id,
                    tipo: 'bonus_referencia_plano',
                    valor: bonus,
                    referencia: user._id, // Referência ao usuário que ativou o plano
                    descricao: `Bônus de 10% pela ativação do plano ${plan.nome} pelo seu indicado ${user.nome}`
                });
            }
        }

        res.status(200).json({ message: 'Plano comprado e ativado com sucesso!', user: user.toObject({ getters: true }) });

    } catch (error) {
        console.error('Erro ao comprar plano:', error);
        res.status(500).json({ message: 'Erro no servidor ao comprar plano.' });
    }
};

// --- Funções de Vídeos ---

// @desc    Obter vídeos diários do usuário
// @route   GET /api/videos
// @access  Private
exports.getDailyVideos = async (req, res) => {
    const userId = req.user.id;

    try {
        const user = await User.findById(userId).populate('planoAtual');

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        if (!user.planoAtual) {
            return res.status(400).json({ message: 'Você precisa ter um plano ativo para assistir vídeos.' });
        }
        if (!user.emailVerificado) {
            return res.status(400).json({ message: 'Seu email precisa ser verificado para assistir vídeos.' });
        }

        // Verificar e resetar a contagem de vídeos diários se for um novo dia em Maputo
        const nowMaputo = moment().tz('Africa/Maputo');
        const lastResetMaputo = moment(user.ultimoResetVideos).tz('Africa/Maputo');

        if (nowMaputo.isAfter(lastResetMaputo, 'day')) {
            // É um novo dia, resetar contagem
            user.videosAssistidosHoje = 0;
            user.ultimoResetVideos = nowMaputo.startOf('day').toDate();
            await user.save();
        }

        if (user.videosAssistidosHoje >= user.planoAtual.videosPorDia) {
            return res.status(400).json({ message: 'Você já assistiu o número máximo de vídeos permitidos para o seu plano hoje.' });
        }

        // Buscar vídeos que o usuário ainda não assistiu hoje
        const videosAssistidosIdsHoje = user.historicoVideos
            .filter(hv => moment(hv.dataAssistido).tz('Africa/Maputo').isSame(nowMaputo, 'day'))
            .map(hv => hv.videoId);

        const availableVideos = await Video.find({
            _id: { $nin: videosAssistidosIdsHoje },
            ativo: true // Apenas vídeos ativos
        }).limit(user.planoAtual.videosPorDia - user.videosAssistidosHoje); // Buscar apenas o número restante de vídeos

        if (availableVideos.length === 0 && user.videosAssistidosHoje < user.planoAtual.videosPorDia) {
            return res.status(404).json({ message: 'Nenhum vídeo novo disponível para hoje no momento. Tente novamente mais tarde.' });
        }


        res.status(200).json({
            videosDisponiveis: availableVideos.slice(0, user.planoAtual.videosPorDia - user.videosAssistidosHoje),
            videosAssistidosHoje: user.videosAssistidosHoje,
            limiteDiario: user.planoAtual.videosPorDia,
            saldoAtual: user.saldo
        });

    } catch (error) {
        console.error('Erro ao obter vídeos diários:', error);
        res.status(500).json({ message: 'Erro no servidor ao obter vídeos diários.' });
    }
};

// @desc    Marcar vídeo como assistido e creditar recompensa
// @route   POST /api/videos/:videoId/watch
// @access  Private
exports.watchVideo = async (req, res) => {
    const { videoId } = req.params;
    const userId = req.user.id;

    try {
        const user = await User.findById(userId).populate('planoAtual');
        const video = await Video.findById(videoId);

        if (!user || !video) {
            return res.status(404).json({ message: 'Usuário ou vídeo não encontrado.' });
        }
        if (!user.planoAtual) {
            return res.status(400).json({ message: 'Você precisa ter um plano ativo para assistir vídeos.' });
        }
        if (!user.emailVerificado) {
            return res.status(400).json({ message: 'Seu email precisa ser verificado para assistir vídeos.' });
        }

        const nowMaputo = moment().tz('Africa/Maputo');
        const lastResetMaputo = moment(user.ultimoResetVideos).tz('Africa/Maputo');

        // Verificar e resetar a contagem de vídeos diários se for um novo dia
        if (nowMaputo.isAfter(lastResetMaputo, 'day')) {
            user.videosAssistidosHoje = 0;
            user.ultimoResetVideos = nowMaputo.startOf('day').toDate();
            await user.save();
        }

        if (user.videosAssistidosHoje >= user.planoAtual.videosPorDia) {
            return res.status(400).json({ message: 'Você já assistiu o número máximo de vídeos permitidos para o seu plano hoje.' });
        }

        // Verificar se o usuário já assistiu a este vídeo especificamente hoje
        const alreadyWatchedToday = user.historicoVideos.some(hv =>
            String(hv.videoId) === String(videoId) &&
            moment(hv.dataAssistido).tz('Africa/Maputo').isSame(nowMaputo, 'day')
        );

        if (alreadyWatchedToday) {
            return res.status(400).json({ message: 'Você já assistiu a este vídeo hoje.' });
        }

        // Calcular recompensa por vídeo
        // Se 3 vídeos por dia dão 30MT, então 1 vídeo dá 10MT
        const recompensaPorVideo = user.planoAtual.recompensaDiaria / user.planoAtual.videosPorDia;

        user.saldo += recompensaPorVideo;
        user.videosAssistidosHoje += 1;
        user.historicoVideos.push({ videoId: video._id, dataAssistido: new Date(), recompensaGanhou: recompensaPorVideo });

        await user.save();

        // Registrar transação de recompensa
        await Transaction.create({
            userId: user._id,
            tipo: 'recompensa_video',
            valor: recompensaPorVideo,
            referencia: video._id,
            descricao: `Recompensa por assistir ao vídeo: ${video.titulo}`
        });

        // Lógica para bônus de referência diário (5% da renda diária do indicado)
        if (user.referidoPor) {
            const referer = await User.findById(user.referidoPor);
            if (referer) {
                const bonusReferenciaDiario = (recompensaPorVideo * 0.05); // 5% do que o referido ganha por video
                referer.saldo += bonusReferenciaDiario;
                await referer.save();

                await Transaction.create({
                    userId: referer._id,
                    tipo: 'bonus_referencia_diario',
                    valor: bonusReferenciaDiario,
                    referencia: user._id, // Referência ao usuário que gerou o bônus
                    descricao: `Bônus de 5% da recompensa de vídeo do seu indicado ${user.nome}`
                });
            }
        }


        res.status(200).json({
            message: 'Vídeo assistido com sucesso! Recompensa creditada.',
            saldoAtual: user.saldo,
            videosAssistidosHoje: user.videosAssistidosHoje,
            recompensaGanhou: recompensaPorVideo
        });

    } catch (error) {
        console.error('Erro ao assistir vídeo:', error);
        res.status(500).json({ message: 'Erro no servidor ao assistir vídeo.' });
    }
};

// --- Funções de Carteira e Depósito ---

// @desc    Obter informações da carteira do usuário (saldo, histórico de transações)
// @route   GET /api/wallet
// @access  Private
exports.getWalletInfo = async (req, res) => {
    const userId = req.user.id;
    try {
        const user = await User.findById(userId).select('saldo');
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        const transactions = await Transaction.find({ userId }).sort({ createdAt: -1 });

        res.status(200).json({
            saldo: user.saldo,
            transacoes: transactions
        });
    } catch (error) {
        console.error('Erro ao obter informações da carteira:', error);
        res.status(500).json({ message: 'Erro no servidor ao obter informações da carteira.' });
    }
};

// @desc    Solicitar um depósito
// @route   POST /api/deposit
// @access  Private
exports.requestDeposit = async (req, res) => {
    const { valor, comprovante } = req.body; // Comprovante pode ser URL ou texto

    if (!valor || !comprovante) {
        return res.status(400).json({ message: 'Valor e comprovante são obrigatórios.' });
    }
    if (valor <= 0) {
        return res.status(400).json({ message: 'O valor do depósito deve ser positivo.' });
    }
    if (!req.user.emailVerificado) {
        return res.status(400).json({ message: 'Seu email precisa ser verificado para solicitar depósitos.' });
    }

    try {
        let comprovanteUrl = comprovante;
        // Se o comprovante for uma imagem base64 ou link temporário, fazer upload para Cloudinary
        // Assumindo que 'comprovante' é uma string base64 da imagem
        if (comprovante.startsWith('data:image')) {
            try {
                const result = await cloudinary.uploader.upload(comprovante, {
                    folder: 'veed_deposits'
                });
                comprovanteUrl = result.secure_url;
            } catch (error) {
                console.error('Erro ao fazer upload do comprovante para o Cloudinary:', error);
                return res.status(500).json({ message: 'Erro ao fazer upload do comprovante.' });
            }
        }

        const deposit = await Deposit.create({
            userId: req.user.id,
            valor,
            comprovante: comprovanteUrl,
            status: 'pendente'
        });

        // Registrar transação como pendente
        await Transaction.create({
            userId: req.user.id,
            tipo: 'deposito',
            valor: valor, // Valor positivo pois é um crédito potencial
            status: 'pendente',
            referencia: deposit._id,
            descricao: `Solicitação de depósito de ${valor}MT`
        });

        res.status(201).json({ message: 'Solicitação de depósito enviada com sucesso! Aguardando aprovação do administrador.', deposit });
    } catch (error) {
        console.error('Erro ao solicitar depósito:', error);
        res.status(500).json({ message: 'Erro no servidor ao solicitar depósito.' });
    }
};

// @desc    Obter histórico de transações do usuário
// @route   GET /api/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(transactions);
    } catch (error) {
        console.error('Erro ao obter transações:', error);
        res.status(500).json({ message: 'Erro no servidor ao obter transações.' });
    }
};


// --- Funções de Referência ---

// @desc    Obter informações de referência do usuário
// @route   GET /api/referrals
// @access  Private
exports.getReferralInfo = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('referralCode nome');
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const referredUsers = await User.find({ referidoPor: user._id }).select('nome email saldo planoAtual');
        const referralLink = `${req.protocol}://${req.get('host')}/register?ref=${user.referralCode}`;

        // Calcular ganhos totais de referência
        const referralBonusTransactions = await Transaction.find({
            userId: user._id,
            $or: [{ tipo: 'bonus_referencia_plano' }, { tipo: 'bonus_referencia_diario' }]
        });

        const totalReferralEarnings = referralBonusTransactions.reduce((acc, transaction) => acc + transaction.valor, 0);


        res.status(200).json({
            referralCode: user.referralCode,
            referralLink,
            indicados: referredUsers,
            totalGanhosReferencia: totalReferralEarnings
        });

    } catch (error) {
        console.error('Erro ao obter informações de referência:', error);
        res.status(500).json({ message: 'Erro no servidor ao obter informações de referência.' });
    }
};


// --- Funções do Painel Administrativo ---

// @desc    Obter todos os usuários (Admin)
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-senha').populate('planoAtual'); // Não enviar senhas
        res.status(200).json(users);
    } catch (error) {
        console.error('Erro ao obter todos os usuários:', error);
        res.status(500).json({ message: 'Erro no servidor ao obter usuários.' });
    }
};

// @desc    Obter usuário por ID (Admin)
// @route   GET /api/admin/users/:userId
// @access  Private/Admin
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('-senha').populate('planoAtual');
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.status(200).json(user);
    } catch (error) {
        console.error('Erro ao obter usuário por ID:', error);
        res.status(500).json({ message: 'Erro no servidor ao obter usuário.' });
    }
};

// @desc    Bloquear usuário (Admin)
// @route   PUT /api/admin/users/:userId/block
// @access  Private/Admin
exports.blockUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        if (user.isAdmin) {
            return res.status(400).json({ message: 'Não é possível bloquear um administrador.' });
        }
        user.isActive = false; // Adicione um campo 'isActive' no modelo de usuário se ainda não tiver
        await user.save();
        res.status(200).json({ message: `Usuário ${user.email} bloqueado com sucesso.` });
    } catch (error) {
        console.error('Erro ao bloquear usuário:', error);
        res.status(500).json({ message: 'Erro no servidor ao bloquear usuário.' });
    }
};

// @desc    Desbloquear usuário (Admin)
// @route   PUT /api/admin/users/:userId/unblock
// @access  Private/Admin
exports.unblockUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        user.isActive = true; // Adicione um campo 'isActive' no modelo de usuário
        await user.save();
        res.status(200).json({ message: `Usuário ${user.email} desbloqueado com sucesso.` });
    } catch (error) {
        console.error('Erro ao desbloquear usuário:', error);
        res.status(500).json({ message: 'Erro no servidor ao desbloquear usuário.' });
    }
};

// @desc    Adicionar saldo manualmente a um usuário (Admin)
// @route   POST /api/admin/users/:userId/add-balance
// @access  Private/Admin
exports.addBalanceToUser = async (req, res) => {
    const { valor, descricao } = req.body;
    if (!valor || valor <= 0) {
        return res.status(400).json({ message: 'Valor inválido.' });
    }
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        user.saldo += valor;
        await user.save();

        await Transaction.create({
            userId: user._id,
            tipo: 'credito_admin',
            valor: valor,
            descricao: descricao || 'Crédito manual por administrador'
        });

        res.status(200).json({ message: `Saldo adicionado ao usuário ${user.email}. Novo saldo: ${user.saldo}` });
    } catch (error) {
        console.error('Erro ao adicionar saldo:', error);
        res.status(500).json({ message: 'Erro no servidor ao adicionar saldo.' });
    }
};

// @desc    Remover saldo manualmente de um usuário (Admin)
// @route   POST /api/admin/users/:userId/remove-balance
// @access  Private/Admin
exports.removeBalanceFromUser = async (req, res) => {
    const { valor, descricao } = req.body;
    if (!valor || valor <= 0) {
        return res.status(400).json({ message: 'Valor inválido.' });
    }
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        if (user.saldo < valor) {
            return res.status(400).json({ message: 'Saldo insuficiente para remover este valor.' });
        }
        user.saldo -= valor;
        await user.save();

        await Transaction.create({
            userId: user._id,
            tipo: 'debito_admin',
            valor: -valor, // Valor negativo para débito
            descricao: descricao || 'Débito manual por administrador'
        });

        res.status(200).json({ message: `Saldo removido do usuário ${user.email}. Novo saldo: ${user.saldo}` });
    } catch (error) {
        console.error('Erro ao remover saldo:', error);
        res.status(500).json({ message: 'Erro no servidor ao remover saldo.' });
    }
};


// @desc    Criar novo plano (Admin)
// @route   POST /api/admin/plans
// @access  Private/Admin
exports.createPlan = async (req, res) => {
    const { nome, valor, videosPorDia, duracaoDias, recompensaDiaria } = req.body;

    if (!nome || !valor || !videosPorDia || !duracaoDias || !recompensaDiaria) {
        return res.status(400).json({ message: 'Todos os campos do plano são obrigatórios.' });
    }

    try {
        const planExists = await Plan.findOne({ nome });
        if (planExists) {
            return res.status(400).json({ message: 'Já existe um plano com este nome.' });
        }

        const recompensaTotalEstimada = recompensaDiaria * duracaoDias;

        const plan = await Plan.create({
            nome,
            valor,
            videosPorDia,
            duracaoDias,
            recompensaDiaria,
            recompensaTotalEstimada
        });

        res.status(201).json({ message: 'Plano criado com sucesso!', plan });
    } catch (error) {
        console.error('Erro ao criar plano:', error);
        res.status(500).json({ message: 'Erro no servidor ao criar plano.' });
    }
};

// @desc    Atualizar plano (Admin)
// @route   PUT /api/admin/plans/:planId
// @access  Private/Admin
exports.updatePlan = async (req, res) => {
    const { nome, valor, videosPorDia, duracaoDias, recompensaDiaria } = req.body;
    try {
        const plan = await Plan.findById(req.params.planId);
        if (!plan) {
            return res.status(404).json({ message: 'Plano não encontrado.' });
        }

        plan.nome = nome || plan.nome;
        plan.valor = valor || plan.valor;
        plan.videosPorDia = videosPorDia || plan.videosPorDia;
        plan.duracaoDias = duracaoDias || plan.duracaoDias;
        plan.recompensaDiaria = recompensaDiaria || plan.recompensaDiaria;
        plan.recompensaTotalEstimada = (recompensaDiaria || plan.recompensaDiaria) * (duracaoDias || plan.duracaoDias);


        const updatedPlan = await plan.save();
        res.status(200).json({ message: 'Plano atualizado com sucesso!', plan: updatedPlan });
    } catch (error) {
        console.error('Erro ao atualizar plano:', error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar plano.' });
    }
};

// @desc    Excluir plano (Admin)
// @route   DELETE /api/admin/plans/:planId
// @access  Private/Admin
exports.deletePlan = async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.planId);
        if (!plan) {
            return res.status(404).json({ message: 'Plano não encontrado.' });
        }
        await plan.deleteOne(); // Use deleteOne() para remover o documento
        res.status(200).json({ message: 'Plano excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir plano:', error);
        res.status(500).json({ message: 'Erro no servidor ao excluir plano.' });
    }
};

// @desc    Fazer upload de vídeo (Admin)
// @route   POST /api/admin/videos
// @access  Private/Admin
exports.uploadVideo = async (req, res) => {
    const { titulo, url, duracao } = req.body;

    if (!titulo || !url || !duracao) {
        return res.status(400).json({ message: 'Título, URL e duração do vídeo são obrigatórios.' });
    }

    try {
        let videoUrl = url;
        // Se a URL for um arquivo local ou base64, fazer upload para Cloudinary
        // Assumindo que 'url' pode ser um link direto ou um path de arquivo/base64 para upload
        // Para uploads de arquivos reais, você precisaria de um middleware como 'multer'
        // e um formulário 'multipart/form-data'. Para simplificar, assumimos que 'url' é
        // diretamente o que o Cloudinary precisa ou um link já hospedado.
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
             try {
                // Aqui você precisaria integrar Multer para lidar com o upload do arquivo
                // e então enviar o buffer/path do arquivo para o Cloudinary.
                // Para este exemplo, vou simular o upload se for um "arquivo local"
                // Na prática, você enviaria o buffer do arquivo lido pelo Multer.
                // Por agora, vou assumir que 'url' é um link direto ou algo que o Cloudinary pode processar
                // como um arquivo se fosse um stream ou buffer.
                // Para uploads reais de arquivos do dispositivo, o Multer seria crucial aqui.

                // Exemplo simulado de upload de uma URL pré-existente ou um placeholder
                const result = await cloudinary.uploader.upload(url, {
                    resource_type: "video",
                    folder: "veed_videos"
                });
                videoUrl = result.secure_url;
            } catch (error) {
                console.error('Erro ao fazer upload do vídeo para o Cloudinary:', error);
                return res.status(500).json({ message: 'Erro ao fazer upload do vídeo. Certifique-se de que a URL é válida ou o arquivo é processável.' });
            }
        }


        const video = await Video.create({
            titulo,
            url: videoUrl,
            duracao,
            ativo: true
        });

        res.status(201).json({ message: 'Vídeo adicionado com sucesso!', video });
    } catch (error) {
        console.error('Erro ao fazer upload de vídeo:', error);
        res.status(500).json({ message: 'Erro no servidor ao adicionar vídeo.' });
    }
};


// @desc    Atualizar vídeo (Admin)
// @route   PUT /api/admin/videos/:videoId
// @access  Private/Admin
exports.updateVideo = async (req, res) => {
    const { titulo, url, duracao, ativo } = req.body;
    try {
        const video = await Video.findById(req.params.videoId);
        if (!video) {
            return res.status(404).json({ message: 'Vídeo não encontrado.' });
        }

        video.titulo = titulo || video.titulo;
        video.duracao = duracao || video.duracao;
        video.ativo = (ativo !== undefined) ? ativo : video.ativo;

        if (url && url !== video.url) { // Se a URL mudou
            let videoUrl = url;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                try {
                    const result = await cloudinary.uploader.upload(url, {
                        resource_type: "video",
                        folder: "veed_videos"
                    });
                    videoUrl = result.secure_url;
                } catch (error) {
                    console.error('Erro ao fazer upload do novo vídeo para o Cloudinary:', error);
                    return res.status(500).json({ message: 'Erro ao fazer upload do novo vídeo.' });
                }
            }
            video.url = videoUrl;
        }

        const updatedVideo = await video.save();
        res.status(200).json({ message: 'Vídeo atualizado com sucesso!', video: updatedVideo });
    } catch (error) {
        console.error('Erro ao atualizar vídeo:', error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar vídeo.' });
    }
};

// @desc    Excluir vídeo (Admin)
// @route   DELETE /api/admin/videos/:videoId
// @access  Private/Admin
exports.deleteVideo = async (req, res) => {
    try {
        const video = await Video.findById(req.params.videoId);
        if (!video) {
            return res.status(404).json({ message: 'Vídeo não encontrado.' });
        }
        // Opcional: Remover o vídeo do Cloudinary também
        // const publicId = video.url.split('/').pop().split('.')[0];
        // await cloudinary.uploader.destroy(publicId, { resource_type: "video" });

        await video.deleteOne();
        res.status(200).json({ message: 'Vídeo excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir vídeo:', error);
        res.status(500).json({ message: 'Erro no servidor ao excluir vídeo.' });
    }
};


// @desc    Ver depósitos pendentes (Admin)
// @route   GET /api/admin/deposits/pending
// @access  Private/Admin
exports.getPendingDeposits = async (req, res) => {
    try {
        const pendingDeposits = await Deposit.find({ status: 'pendente' }).populate('userId', 'nome email');
        res.status(200).json(pendingDeposits);
    } catch (error) {
        console.error('Erro ao obter depósitos pendentes:', error);
        res.status(500).json({ message: 'Erro no servidor ao obter depósitos pendentes.' });
    }
};

// @desc    Aprovar depósito (Admin)
// @route   PUT /api/admin/deposits/:depositId/approve
// @access  Private/Admin
exports.approveDeposit = async (req, res) => {
    const { depositId } = req.params;
    try {
        const deposit = await Deposit.findById(depositId);
        if (!deposit) {
            return res.status(404).json({ message: 'Depósito não encontrado.' });
        }
        if (deposit.status !== 'pendente') {
            return res.status(400).json({ message: 'Este depósito já foi processado.' });
        }

        const user = await User.findById(deposit.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário do depósito não encontrado.' });
        }

        user.saldo += deposit.valor;
        deposit.status = 'aprovado';
        deposit.aprovadoPor = req.user.id; // ID do admin logado
        deposit.dataAprovacao = new Date();

        await user.save();
        await deposit.save();

        // Atualizar status da transação de depósito
        await Transaction.findOneAndUpdate(
            { referencia: deposit._id, tipo: 'deposito', status: 'pendente' },
            { status: 'concluido', descricao: `Depósito de ${deposit.valor}MT aprovado` }
        );


        res.status(200).json({ message: 'Depósito aprovado e saldo creditado ao usuário.', deposit });
    } catch (error) {
        console.error('Erro ao aprovar depósito:', error);
        res.status(500).json({ message: 'Erro no servidor ao aprovar depósito.' });
    }
};

// @desc    Rejeitar depósito (Admin)
// @route   PUT /api/admin/deposits/:depositId/reject
// @access  Private/Admin
exports.rejectDeposit = async (req, res) => {
    const { depositId } = req.params;
    try {
        const deposit = await Deposit.findById(depositId);
        if (!deposit) {
            return res.status(404).json({ message: 'Depósito não encontrado.' });
        }
        if (deposit.status !== 'pendente') {
            return res.status(400).json({ message: 'Este depósito já foi processado.' });
        }

        deposit.status = 'rejeitado';
        deposit.aprovadoPor = req.user.id; // ID do admin logado
        deposit.dataAprovacao = new Date();
        await deposit.save();

        // Atualizar status da transação de depósito
        await Transaction.findOneAndUpdate(
            { referencia: deposit._id, tipo: 'deposito', status: 'pendente' },
            { status: 'cancelado', descricao: `Depósito de ${deposit.valor}MT rejeitado` }
        );

        res.status(200).json({ message: 'Depósito rejeitado.', deposit });
    } catch (error) {
        console.error('Erro ao rejeitar depósito:', error);
        res.status(500).json({ message: 'Erro no servidor ao rejeitar depósito.' });
    }
};

// @desc    Obter estatísticas do painel administrativo
// @route   GET /api/admin/dashboard-stats
// @access  Private/Admin
exports.getAdminDashboardStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({});
        const activePlans = await User.countDocuments({ planoAtual: { $ne: null } });
        const totalVideos = await Video.countDocuments({});
        const pendingDepositsCount = await Deposit.countDocuments({ status: 'pendente' });
        // Você pode adicionar mais estatísticas conforme a necessidade, como:
        // - Saldo total em caixa na plataforma (se houver um modelo para isso)
        // - Ganhos totais de referência pagos
        // - Total de vídeos assistidos (se você agregar isso em algum lugar)

        res.status(200).json({
            totalUsers,
            activePlans,
            totalVideos,
            pendingDepositsCount
        });

    } catch (error) {
        console.error('Erro ao obter estatísticas do painel administrativo:', error);
        res.status(500).json({ message: 'Erro no servidor ao obter estatísticas.' });
    }
};