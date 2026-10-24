/**
 * Struked LLC — Express Backend Server
 * Works with: express, cors, dotenv (already in node_modules)
 * Quote requests: Saved to quotes.json (local file-based storage)
 * File uploads: Saved to uploads/ directory using built-in fs
 * Email: Configured via .env (requires nodemailer if installed)
 *
 * To enable full features (SQLite, file upload, email), run:
 *   npm install better-sqlite3 multer nodemailer express-validator
 */

'use strict';

const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const path    = require('path');
const fs      = require('fs');
const http    = require('http');

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// Storage Setup (JSON file-based)
// ==========================================
const DB_FILE     = path.join(__dirname, 'quotes.json');
const UPLOAD_DIR  = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ quotes: [] }, null, 2));
}

function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
        return { quotes: [] };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function saveQuote(quoteData) {
    const db = readDB();
    const newQuote = {
        id:         db.quotes.length + 1,
        ...quoteData,
        submittedAt: new Date().toISOString()
    };
    db.quotes.push(newQuote);
    writeDB(db);
    return newQuote;
}

// ==========================================
// Optional: Nodemailer (if installed)
// ==========================================
let sendMail = null;

try {
    const nodemailer = require('nodemailer');
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = nodemailer.createTransport({
            host:   process.env.SMTP_HOST,
            port:   parseInt(process.env.SMTP_PORT, 10) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });

        sendMail = async (quoteData) => {
            const to = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
            await transporter.sendMail({
                from:    `"Struked LLC Website" <${process.env.SMTP_USER}>`,
                to,
                subject: `New Quote Request from ${quoteData.fullName}`,
                text: [
                    'NEW QUOTE REQUEST — STRUKED LLC',
                    '================================',
                    `Name:    ${quoteData.fullName}`,
                    `Email:   ${quoteData.email}`,
                    `Phone:   ${quoteData.phone}`,
                    `Company: ${quoteData.company || 'Not provided'}`,
                    `Service: ${quoteData.service}`,
                    '',
                    'Project Details:',
                    quoteData.projectDetails
                ].join('\n')
            });
            console.log(`📧 Notification email sent to: ${to}`);
        };

        console.log('✅ Email transporter ready');
    }
} catch {
    // nodemailer not installed — email disabled
}

// ==========================================
// Middleware
// ==========================================
app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    methods: ['GET', 'POST']
}));

// Parse JSON and URL-encoded bodies
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Parse multipart/form-data manually (no multer needed for text fields)
// File upload handled separately below
app.use((req, res, next) => {
    const ct = req.headers['content-type'] || '';
    if (ct.includes('multipart/form-data') && (req.method === 'POST')) {
        // Parse multipart manually using built-in stream
        // We only need the text fields — files are optional
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString();

            // Extract boundary
            const boundaryMatch = ct.match(/boundary=([^\s;]+)/);
            if (!boundaryMatch) { return next(); }
            const boundary = boundaryMatch[1];

            const parts = raw.split('--' + boundary);
            req.body = req.body || {};
            req.uploadedFiles = [];

            parts.forEach(part => {
                if (!part || part.trim() === '--') return;

                const headerEnd = part.indexOf('\r\n\r\n');
                if (headerEnd < 0) return;

                const headers = part.slice(0, headerEnd);
                const content = part.slice(headerEnd + 4).replace(/\r\n$/, '');

                const nameMatch = headers.match(/name="([^"]+)"/);
                const filenameMatch = headers.match(/filename="([^"]+)"/);

                if (!nameMatch) return;
                const fieldName = nameMatch[1];

                if (filenameMatch) {
                    // It's a file — save to uploads/
                    const originalName = filenameMatch[1];
                    if (originalName && content) {
                        const ext = path.extname(originalName).toLowerCase();
                        const saveName = `quote-${Date.now()}-${Math.round(Math.random() * 1e5)}${ext}`;
                        const savePath = path.join(UPLOAD_DIR, saveName);
                        try {
                            fs.writeFileSync(savePath, content);
                            req.uploadedFiles.push({ originalname: originalName, filename: saveName });
                        } catch (e) {
                            console.error('File save error:', e.message);
                        }
                    }
                } else {
                    // Text field
                    req.body[fieldName] = content;
                }
            });

            next();
        });
        req.on('error', next);
    } else {
        next();
    }
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// ==========================================
// Validation Helpers
// ==========================================
function sanitize(str) {
    return (str || '').toString().trim().replace(/<[^>]*>/g, '');
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ==========================================
// API Routes
// ==========================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'success', message: 'Struked LLC API is running', timestamp: new Date().toISOString() });
});

// Quote submission
app.post('/api/quote', async (req, res) => {
    const fullName      = sanitize(req.body.fullName);
    const email         = sanitize(req.body.email);
    const phone         = sanitize(req.body.phone);
    const company       = sanitize(req.body.company);
    const service       = sanitize(req.body.service);
    const projectDetails = sanitize(req.body.projectDetails);
    const files         = req.uploadedFiles || [];

    // Server-side validation
    const errors = [];
    if (!fullName || fullName.length < 2) errors.push('Full name is required (at least 2 characters).');
    if (!email || !isValidEmail(email))   errors.push('A valid email address is required.');
    if (!phone || phone.length < 7)       errors.push('A valid phone number is required.');
    if (!service)                          errors.push('Please specify the service required.');
    if (!projectDetails || projectDetails.length < 20) errors.push('Project details must be at least 20 characters.');

    if (errors.length > 0) {
        return res.status(400).json({ status: 'error', message: errors.join(' ') });
    }

    // Save quote
    const saved = saveQuote({ fullName, email, phone, company, service, projectDetails, files });
    console.log(`📋 Quote saved (ID: ${saved.id}) from: ${email}`);

    // Send email notification
    if (sendMail) {
        sendMail(saved).catch(e => console.error('Email error:', e.message));
    }

    res.status(200).json({
        status: 'success',
        message: 'Your quote request has been submitted successfully! We will review your project and get back to you shortly.',
        id: saved.id
    });
});

// Catch-all: serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ==========================================
// Start Server
// ==========================================
app.listen(PORT, () => {
    console.log('');
    console.log('🏗️  Struked LLC Server Started');
    console.log(`📡 Local:   http://localhost:${PORT}`);
    console.log(`📁 Quotes saved to: quotes.json`);
    console.log('');
});
