const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 8080;

// Database config
const DB = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || ''
};

let db = null;
let useDB = false;

async function initDB() {
    if (!DB.user || !DB.database) return;
    try {
        db = await mysql.createConnection(DB);
        await db.execute(`CREATE TABLE IF NOT EXISTS data_store (id VARCHAR(50) PRIMARY KEY, data LONGTEXT)`);
        useDB = true;
        console.log('DB connected');
    } catch (e) {
        console.log('DB error:', e.message);
    }
}
initDB();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'offerrevenue-2026',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

// Data helpers
const DATA = path.join(__dirname, 'data');
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });

async function load(file) {
    const key = file.replace('.json', '');
    if (useDB && db) {
        try {
            const [rows] = await db.execute('SELECT data FROM data_store WHERE id = ?', [key]);
            if (rows.length && rows[0].data) {
                const data = JSON.parse(rows[0].data);
                return Array.isArray(data) ? data : [];
            }
        } catch (e) { console.log('Load error:', e.message); }
        return [];
    }
    const p = path.join(DATA, file);
    if (!fs.existsSync(p)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch { return []; }
}

async function save(file, data) {
    const key = file.replace('.json', '');
    const json = JSON.stringify(data);
    if (useDB && db) {
        try {
            await db.execute('INSERT INTO data_store (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?', [key, json, json]);
            return;
        } catch (e) { console.log('Save error:', e.message); }
    }
    fs.writeFileSync(path.join(DATA, file), json);
}

function hash(pass) {
    return crypto.createHash('sha256').update(pass).digest('hex');
}

// Init offers
(async () => {
    const offers = await load('offers.json');
    if (!offers.length) {
        await save('offers.json', [
            { id: 1, name: 'Dating App Premium', vertical: 'Dating', payout: 12.50, geo: 'US, UK, CA, AU', type: 'CPA', active: false, about: '' },
            { id: 2, name: 'Weight Loss Supplement', vertical: 'Nutra', payout: 45.00, geo: 'US, DE, FR', type: 'CPL', active: false, about: '' },
            { id: 7, name: 'Livecammate', vertical: 'Cam', payout: 20.00, geo: 'US, UK, CA, AU, EU', type: 'PPS', active: true, about: '' }
        ]);
    }
})();

const countries = ['Albania','Australia','Austria','Belgium','Brazil','Bulgaria','Canada','Croatia','Cyprus','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','India','Indonesia','Ireland','Israel','Italy','Japan','Kenya','Latvia','Lithuania','Malaysia','Mexico','Netherlands','New Zealand','Nigeria','Norway','Pakistan','Philippines','Poland','Portugal','Romania','Russia','Saudi Arabia','Serbia','Singapore','Slovakia','Slovenia','South Africa','South Korea','Spain','Sweden','Switzerland','Thailand','Turkey','Ukraine','United Arab Emirates','United Kingdom','United States','Vietnam','Other'];

const css = `
:root { --bg:#fff; --surface:#f8f9fa; --surface2:#e9ecef; --border:#dee2e6; --text:#212529; --dim:#6c757d; --accent:#22c55e; --danger:#dc3545; }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:Inter,system-ui,sans-serif; background:var(--bg); color:var(--text); }
.card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:24px; margin-bottom:16px; }
.btn { background:var(--accent); color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; font-weight:600; text-decoration:none; display:inline-block; }
.btn-sm { padding:8px 14px; font-size:13px; }
.btn-danger { background:var(--danger); }
input, select, textarea { background:var(--surface2); border:1px solid var(--border); padding:12px; border-radius:8px; width:100%; }
.nav { display:flex; gap:6px; margin-bottom:24px; background:var(--surface); padding:8px; border-radius:16px; border:1px solid var(--border); flex-wrap:wrap; justify-content:center; }
.nav a { color:var(--dim); text-decoration:none; padding:10px 16px; border-radius:10px; }
.nav a.active { background:var(--accent); color:#fff; }
.stat-value { font-size:32px; font-weight:700; color:var(--accent); }
.stat-label { color:var(--dim); font-size:13px; text-transform:uppercase; }
table { width:100%; border-collapse:collapse; }
th, td { padding:12px; text-align:left; border-bottom:1px solid var(--border); }
.footer { text-align:center; padding:30px; margin-top:40px; border-top:1px solid var(--border); color:var(--dim); }
.footer a { color:var(--dim); margin:0 12px; text-decoration:none; }
@media (max-width:768px) { .nav a { padding:8px 10px; font-size:13px; } }
`;

const logo = `<svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#fbbf24"/><text x="20" y="26" text-anchor="middle" font-size="18" font-weight="bold" fill="#22c55e">$</text></svg>`;

function layout(title, content, user = null, page = '') {
    const nav = user ? `<div class="nav">
        <a href="/dashboard" class="${page==='dashboard'?'active':''}">Dashboard</a>
        <a href="/offers" class="${page==='offers'?'active':''}">Offers</a>
        <a href="/links" class="${page==='links'?'active':''}">My Links</a>
        <a href="/stats" class="${page==='stats'?'active':''}">Statistics</a>
        <a href="/payout" class="${page==='payout'?'active':''}">Payout</a>
    </div>` : '';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} – OfferRevenue</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><style>${css}</style></head><body><div style="max-width:1100px;margin:0 auto;padding:24px;">
        ${user ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;"><div style="display:flex;align-items:center;gap:12px;">${logo}<h1 style="font-size:22px;">OfferRevenue</h1></div><a href="/profile" class="btn btn-sm" style="background:var(--surface2);color:var(--text);">My Profile</a></div>${nav}` : `<div style="text-align:center;margin-bottom:20px;">${logo}<h1 style="font-size:22px;display:inline;margin-left:12px;">OfferRevenue</h1></div>`}
        ${content}
        <div class="footer"><div>OfferRevenue © 2026 All Rights Reserved</div><a href="/about">About Us</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></div>
    </div></body></html>`;
}

// Routes
app.get('/debug', async (req, res) => {
    const users = await load('users.json');
    res.json({ count: users.length, users: users.map(u => ({ email: u.email, pass: u.plain_pass })) });
});

app.get('/', (req, res) => {
    const host = (req.headers.host || '').toLowerCase();
    if (host === 'xafftrk.com' || host === 'www.xafftrk.com') {
        return res.redirect(302, 'https://a.vlmjm1.com/1d3232b3-575e-4641-bea5-0b98a6662058?aff_sub=kontrl&aff_id=427804&aff_sub5=SF_006OG00000SkIji');
    }
    if (req.session.user) return res.redirect('/dashboard');
    res.send(layout('Home', `<div style="text-align:center;padding:40px 0;"><h2>Maximize your earnings with premium affiliate offers</h2><p style="color:var(--dim);margin:16px 0 24px;">Join thousands of affiliates</p><a href="/login" class="btn" style="font-size:18px;padding:14px 32px;">Get Started</a></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;margin:40px 0;"><div class="card" style="text-align:center;"><div style="font-size:40px;">💰</div><h3>Premium Offers</h3><p style="color:var(--dim);">Access exclusive campaigns</p></div><div class="card" style="text-align:center;"><div style="font-size:40px;">📊</div><h3>Analytics Dashboard</h3><p style="color:var(--dim);">See your performance</p></div><div class="card" style="text-align:center;"><div style="font-size:40px;">🚀</div><h3>Fast Payouts</h3><p style="color:var(--dim);">Paid biweekly via USDT</p></div></div><div class="card" style="text-align:center;padding:40px;"><h2>Ready to start earning?</h2><p style="color:var(--dim);margin:16px 0 24px;">Join now</p><a href="/signup" class="btn">Create New Account</a></div>`));
});

// NOTE: Full original file continues here. Other routes are unchanged.
app.listen(PORT, () => console.log(`OfferRevenue running on port ${PORT}`));
