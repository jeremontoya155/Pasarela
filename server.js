require('dotenv').config(); // Carga las variables de entorno
const express = require('express');
const bodyParser = require('body-parser');
const mercadopago = require('mercadopago');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configura el motor de plantillas EJS
app.set('view engine', 'ejs');

// Configura Mercado Pago con el token del archivo .env y habilita logs
mercadopago.configure({
    access_token: process.env.MERCADOPAGO_ACCESS_TOKEN,
    log: true // Habilitar logs para ver más detalles en caso de errores
});

// Ruta principal (home)
app.get('/', (req, res) => {
    res.render('index');
});

// Ruta para generar el link de pago
app.post('/crear-pago', async (req, res) => {
    const { email, monto } = req.body;

    let preference = {
        items: [
            {
                title: 'Pago por servicio',
                unit_price: parseFloat(monto),
                quantity: 1,
            }
        ],
        back_urls: {
            success: 'http://localhost:' + process.env.PORT + '/success',
            failure: 'http://localhost:' + process.env.PORT + '/failure',
            pending: 'http://localhost:' + process.env.PORT + '/pending'
        },
        auto_return: 'approved',
        payer: {
            email: email
        }
    };

    try {
        const response = await mercadopago.preferences.create(preference);
        res.redirect(response.body.init_point); // Redirige al link de pago
    } catch (error) {
        console.error('Error al crear el link de pago:', error);
        res.status(500).send('Error al crear el link de pago');
    }
});

// Rutas de éxito, fallo, y pendiente
app.get('/success', (req, res) => {
    const payment_id = req.query.payment_id;
    res.render('success', { payment_id });
});

app.get('/failure', (req, res) => {
    res.render('failure');
});

app.get('/pending', (req, res) => {
    res.render('pending');
});

// Webhook para confirmar el pago y enviar correo
app.post('/webhook', async (req, res) => {
    console.log('Datos recibidos en el webhook:', req.body); // Verifica qué datos está enviando Mercado Pago

    const payment = req.body.data?.id; // Ajusta la obtención del payment_id si está en el body
    if (!payment) {
        return res.status(400).send('No se encontró el payment_id');
    }

    try {
        const paymentInfo = await mercadopago.payment.findById(payment);
        if (paymentInfo.body.status === 'approved') {
            const email = paymentInfo.body.payer.email;
            enviarEmail(email);
            res.status(200).send('Pago confirmado y correo enviado');
        } else {
            res.status(400).send('El pago no fue aprobado');
        }
    } catch (error) {
        console.error('Error al verificar el pago:', error);
        res.status(500).send('Error al verificar el pago');
    }
});

// Función para enviar email
const enviarEmail = (destinatario) => {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'TU_EMAIL@gmail.com',
            pass: 'TU_CONTRASEÑA'
        }
    });

    let mailOptions = {
        from: 'TU_EMAIL@gmail.com',
        to: destinatario,
        subject: 'Confirmación de pago',
        text: 'Gracias por tu pago. Hemos recibido tu pago exitosamente.'
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error al enviar correo:', error);
        } else {
            console.log('Correo enviado:', info.response);
        }
    });
};

// Iniciar el servidor en el puerto del archivo .env
const PORT = process.env.PORT || 5224; // Usa el puerto desde el .env o 5224 por defecto
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
