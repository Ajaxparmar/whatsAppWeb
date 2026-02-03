// const express = require('express');
// const http = require('http');
// const socketIo = require('socket.io');
// const { Client, LocalAuth } = require('whatsapp-web.js');
// const qrcode = require('qrcode');

// const app = express();
// const server = http.createServer(app);
// const io = socketIo(server);

// app.use(express.json());
// app.use(express.static('public'));

// let client;
// let isReady = false;
// let qrCodeData = null;

// // Initialize WhatsApp Client
// function initializeWhatsApp() {
//     client = new Client({
//         authStrategy: new LocalAuth(),
//         puppeteer: {
//             headless: "new",
//             args: [
//               "--no-sandbox",
//               "--disable-setuid-sandbox",
//               "--disable-dev-shm-usage",
//               "--disable-gpu"
//             ]
//           }
          
//     });

//     client.on('qr', async (qr) => {
//         console.log('QR Code received');
//         try {
//             qrCodeData = await qrcode.toDataURL(qr);
//             io.emit('qr', qrCodeData);
//         } catch (err) {
//             console.error('Error generating QR code:', err);
//         }
//     });

//     client.on('authenticated', () => {
//         console.log('Authenticated successfully!');
//         io.emit('status', { status: 'authenticated', message: 'Authentication successful!' });
//     });

//     client.on('ready', () => {
//         console.log('Client is ready! ✅');
//         isReady = true;
//         qrCodeData = null;
//         io.emit('status', { status: 'ready', message: 'WhatsApp is ready to send messages!' });
//     });

//     client.on('auth_failure', msg => {
//         console.error('Authentication failure:', msg);
//         io.emit('status', { status: 'auth_failure', message: 'Authentication failed. Please try again.' });
//     });

//     client.on('disconnected', (reason) => {
//         console.log('Client disconnected:', reason);
//         isReady = false;
//         io.emit('status', { status: 'disconnected', message: 'WhatsApp disconnected. Reinitializing...' });
//         setTimeout(() => initializeWhatsApp(), 5000);
//     });

//     client.initialize();
// }

// // Socket.IO connection
// io.on('connection', (socket) => {
//     console.log('Client connected');
    
//     // Send current status to newly connected client
//     if (isReady) {
//         socket.emit('status', { status: 'ready', message: 'WhatsApp is ready!' });
//     } else if (qrCodeData) {
//         socket.emit('qr', qrCodeData);
//     }

//     socket.on('disconnect', () => {
//         console.log('Client disconnected');
//     });
// });

// // API endpoint to send messages
// app.post('/api/send-message', async (req, res) => {
//     try {
//         const { number, message } = req.body;

//         if (!number || !message) {
//             return res.status(400).json({ 
//                 success: false, 
//                 error: 'Number and message are required' 
//             });
//         }

//         if (!isReady) {
//             return res.status(503).json({ 
//                 success: false, 
//                 error: 'WhatsApp client is not ready. Please scan QR code first.' 
//             });
//         }

//         // Format the number to WhatsApp format
//         const formattedNumber = number.replace(/[^\d]/g, '');
//         const chatId = formattedNumber + '@c.us';

//         await client.sendMessage(chatId, message);
        
//         console.log(`Message sent to ${number}`);
        
//         res.json({ 
//             success: true, 
//             message: 'Message sent successfully',
//             to: number
//         });

//     } catch (error) {
//         console.error('Error sending message:', error);
//         res.status(500).json({ 
//             success: false, 
//             error: error.message 
//         });
//     }
// });

// // API endpoint to check status
// app.get('/api/status', (req, res) => {
//     res.json({
//         ready: isReady,
//         hasQR: !!qrCodeData
//     });
// });

// // Start server
// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//     console.log(`Server running on http://localhost:${PORT}`);
//     initializeWhatsApp();
// });


const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// ── CORS ──────────────────────────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({ origin: FRONTEND_URL }));

const io = socketIo(server, {
    cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'] }
});

app.use(express.json());
app.use(express.static('public'));

// ── Find Chrome executable ────────────────────────────────
// Render installs Chrome via puppeteer into a cache path.
// This scans known locations to find the actual binary.
function getChromePath() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

    const possiblePaths = [
        '/opt/render/.cache/puppeteer/chrome/linux/chrome-linux64/chrome',
        '/opt/render/.cache/puppeteer/chrome/linux/chrome-linux/chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            console.log('Chrome found at:', p);
            return p;
        }
    }

    console.log('Chrome not found in known paths — letting Puppeteer auto-detect.');
    return undefined;
}

// ── State ─────────────────────────────────────────────────
let client;
let isReady = false;
let qrCodeData = null;

// ── Initialize WhatsApp ───────────────────────────────────
function initializeWhatsApp() {
    const chromePath = getChromePath();

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './wam-session'
        }),
        puppeteer: {
            headless: true,
            executablePath: chromePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-extensions',
            ]
        }
    });

    client.on('qr', async (qr) => {
        console.log('QR Code received');
        try {
            qrCodeData = await qrcode.toDataURL(qr);
            io.emit('qr', qrCodeData);
        } catch (err) {
            console.error('Error generating QR code:', err);
        }
    });

    client.on('authenticated', () => {
        console.log('Authenticated successfully!');
        io.emit('status', { status: 'authenticated', message: 'Authentication successful!' });
    });

    client.on('ready', () => {
        console.log('Client is ready!');
        isReady = true;
        qrCodeData = null;
        io.emit('status', { status: 'ready', message: 'WhatsApp is ready to send messages!' });
    });

    client.on('auth_failure', (msg) => {
        console.error('Authentication failure:', msg);
        io.emit('status', { status: 'auth_failure', message: 'Authentication failed. Please try again.' });
    });

    client.on('disconnected', (reason) => {
        console.log('Client disconnected:', reason);
        isReady = false;
        io.emit('status', { status: 'disconnected', message: 'WhatsApp disconnected. Reinitializing...' });
        setTimeout(() => initializeWhatsApp(), 5000);
    });

    client.initialize();
}

// ── Socket.IO ─────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log('Client connected');

    if (isReady) {
        socket.emit('status', { status: 'ready', message: 'WhatsApp is ready!' });
    } else if (qrCodeData) {
        socket.emit('qr', qrCodeData);
    }

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// ── POST /api/send-message ────────────────────────────────
app.post('/api/send-message', async (req, res) => {
    try {
        const { number, message } = req.body;

        if (!number || !message) {
            return res.status(400).json({ success: false, error: 'Number and message are required' });
        }

        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp client is not ready. Please scan QR code first.' });
        }

        const formattedNumber = number.replace(/[^\d]/g, '');
        const chatId = formattedNumber + '@c.us';

        await client.sendMessage(chatId, message);
        console.log(`Message sent to ${number}`);

        res.json({ success: true, message: 'Message sent successfully', to: number });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── GET /api/status ───────────────────────────────────────
app.get('/api/status', (req, res) => {
    res.json({ ready: isReady, hasQR: !!qrCodeData });
});

// ── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    initializeWhatsApp();
});