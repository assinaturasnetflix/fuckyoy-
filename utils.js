// utils.js
const { jwt, nodemailer, JWT_SECRET, transporter } = require('./server'); // Importa o JWT_SECRET e transporter do server.js
const crypto = require('crypto'); // Módulo nativo do Node.js para criptografia

// Função para gerar um token JWT (reutilizado para autenticação e reset de senha)
function generateToken(id) {
    return jwt.sign({ id }, JWT_SECRET, {
        expiresIn: '1h', // Token expira em 1 hora para login e reset de senha
    });
}

// Função para gerar um código de referência alfanumérico
function generateReferralCode(length = 8) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length).toUpperCase();
}

// Função para enviar e-mail de boas-vindas
async function sendWelcomeEmail(email, username) {
    const mailOptions = {
        from: `VEED <${process.env.EMAIL_USER}>`, // Remetente
        to: email, // Destinatário
        subject: 'Bem-vindo(a) à VEED!', // Assunto do e-mail
        html: `
            <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 20px auto; background-color: #f8f8f8; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-top: 5px solid #FF0000;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <img src="https://res.cloudinary.com/dje6f5k5u/image/upload/v1718873000/veed-logo.png" alt="VEED Logo" style="width: 120px; margin-bottom: 15px;">
                    <h1 style="color: #0000FF; font-size: 28px; margin: 0;">Bem-vindo(a) à VEED, ${username}!</h1>
                </div>
                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                    Estamos muito felizes em ter você conosco! Na VEED, você pode transformar seu tempo em renda assistindo a vídeos e explorando uma nova forma de investimento.
                </p>
                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                    Para começar a ganhar, explore nossos planos de investimento e comece a assistir seus vídeos diários.
                </p>
                <div style="text-align: center; margin-top: 40px; margin-bottom: 30px;">
                    <a href="https://veed.com/dashboard" style="display: inline-block; padding: 12px 25px; background-color: #0000FF; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Acessar sua Dashboard
                    </a>
                </div>
                <p style="font-size: 14px; color: #777; text-align: center;">
                    Se tiver alguma dúvida, não hesite em nos contatar.
                </p>
                <p style="font-size: 14px; color: #777; text-align: center; margin-top: 20px;">
                    Obrigado(a) por fazer parte da nossa comunidade!
                </p>
                <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center; font-size: 12px; color: #999;">
                    <p>&copy; ${new Date().getFullYear()} VEED. Todos os direitos reservados.</p>
                </div>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`E-mail de boas-vindas enviado para ${email}`);
    } catch (error) {
        console.error(`Erro ao enviar e-mail de boas-vindas para ${email}:`, error);
        throw new Error('Não foi possível enviar o e-mail de boas-vindas.');
    }
}


// Função para enviar e-mail de recuperação de senha
async function sendPasswordResetEmail(email, resetURL) {
    const mailOptions = {
        from: `VEED <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Redefinição de Senha para sua conta VEED',
        html: `
            <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 20px auto; background-color: #f8f8f8; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-top: 5px solid #0000FF;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <img src="https://res.cloudinary.com/dje6f5k5u/image/upload/v1718873000/veed-logo.png" alt="VEED Logo" style="width: 120px; margin-bottom: 15px;">
                    <h1 style="color: #FF0000; font-size: 28px; margin: 0;">Redefinição de Senha</h1>
                </div>
                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                    Recebemos uma solicitação para redefinir a senha da sua conta VEED.
                    Se você não solicitou isso, pode ignorar este e-mail.
                </p>
                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                    Para redefinir sua senha, clique no botão abaixo:
                </p>
                <div style="text-align: center; margin-top: 40px; margin-bottom: 30px;">
                    <a href="${resetURL}" style="display: inline-block; padding: 12px 25px; background-color: #FF0000; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Redefinir Senha
                    </a>
                </div>
                <p style="font-size: 14px; color: #777; text-align: center;">
                    Este link de redefinição de senha é válido por 1 hora.
                </p>
                <p style="font-size: 14px; color: #777; text-align: center;">
                    Se o botão não funcionar, você pode copiar e colar o seguinte link no seu navegador: <br>
                    <a href="${resetURL}" style="color: #0000FF; text-decoration: underline;">${resetURL}</a>
                </p>
                <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center; font-size: 12px; color: #999;">
                    <p>&copy; ${new Date().getFullYear()} VEED. Todos os direitos reservados.</p>
                </div>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`E-mail de recuperação de senha enviado para ${email}`);
    } catch (error) {
        console.error(`Erro ao enviar e-mail de recuperação de senha para ${email}:`, error);
        throw new Error('Não foi possível enviar o e-mail de recuperação de senha.');
    }
}

// Funções para gerar senha aleatória (se necessário para algum admin) - opcional, mas útil
function generateRandomPassword(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

module.exports = {
    generateToken,
    generateReferralCode,
    sendWelcomeEmail,
    sendPasswordResetEmail,
    generateRandomPassword
};