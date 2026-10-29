const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 8080;

// Database connection (set these in Hostinger environment variables)
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || ''
};

let db = null;
let useDB = false;

async function initDB() {
    if (!DB_CONFIG.user || !DB_CONFIG.database) {
        console.log('No database config - using file storage');
        return;
    }
    try {
        db = await mysql.createConnection(DB_CONFIG);
        await db.execute(`CREATE TABLE IF NOT EXISTS data_store (
            id VARCHAR(50) PRIMARY KEY,
            data JSON
        )`);
        useDB = true;
        console.log('Database connected');
    } catch (e) {
        console.log('Database error, using file storage:', e.message);
        useDB = false;
    }
}
initDB();

// Data helpers - uses database if available, otherwise files
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

async function load(file) {
    const key = file.replace('.json', '');
    if (useDB && db) {
        try {
            const [rows] = await db.execute('SELECT data FROM data_store WHERE id = ?', [key]);
            if (rows.length) return typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
            return [];
        } catch { return []; }
    }
    const p = path.join(DATA_DIR, file);
    if (!fs.existsSync(p)) return [];
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

async function save(file, data) {
    const key = file.replace('.json', '');
    if (useDB && db) {
        try {
            await db.execute('INSERT INTO data_store (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?', [key, JSON.stringify(data), JSON.stringify(data)]);
            return;
        } catch (e) { console.log('DB save error:', e.message); }
    }
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

async function loadSettings() {
    const data = await load('settings.json');
    if (!data || (Array.isArray(data) && !data.length)) return { admin_pass: 'admin123' };
    return data;
}

async function saveSettings(s) {
    await save('settings.json', s);
}

// Init default offers
(async () => {
    let offers = await load('offers.json');
    if (!offers.length) {
        offers = [
            { id: 1, name: 'Dating App Premium', vertical: 'Dating', payout: 12.50, geo: 'US, UK, CA, AU', type: 'CPA', active: false },
            { id: 2, name: 'Weight Loss Supplement', vertical: 'Nutra', payout: 45.00, geo: 'US, DE, FR', type: 'CPL', active: false },
            { id: 7, name: 'Livecammate', vertical: 'Cam', payout: 20.00, geo: 'US, UK, CA, AU, EU', type: 'PPS', active: true, about: '' }
        ];
        await save('offers.json', offers);
    }
})();

// Hash password
function hashPass(pass) {
    return crypto.createHash('sha256').update(pass).digest('hex');
}

// Countries list
const countries = ['Albania','Australia','Austria','Belgium','Brazil','Bulgaria','Canada','Croatia','Cyprus','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','India','Indonesia','Ireland','Israel','Italy','Japan','Kenya','Latvia','Lithuania','Malaysia','Mexico','Netherlands','New Zealand','Nigeria','Norway','Pakistan','Philippines','Poland','Portugal','Romania','Russia','Saudi Arabia','Serbia','Singapore','Slovakia','Slovenia','South Africa','South Korea','Spain','Sweden','Switzerland','Thailand','Turkey','Ukraine','United Arab Emirates','United Kingdom','United States','Vietnam','Other'];

// Base CSS
const css = `
:root { --bg:#ffffff; --surface:#f8f9fa; --surface2:#e9ecef; --border:#dee2e6; --text:#212529; --text-dim:#6c757d; --accent:#22c55e; --accent-hover:#16a34a; --success:#22c55e; --danger:#dc3545; }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Inter',system-ui,sans-serif; background:var(--bg); color:var(--text); min-height:100vh; }
.card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:24px; margin-bottom:16px; }
.btn { background:var(--accent); color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; font-weight:600; text-decoration:none; display:inline-block; }
.btn:hover { background:var(--accent-hover); }
.btn-sm { padding:8px 14px; font-size:13px; }
.btn-danger { background:var(--danger); }
input, select, textarea { background:var(--surface2); border:1px solid var(--border); color:var(--text); padding:12px 14px; border-radius:8px; width:100%; }
input:focus, select:focus { outline:none; border-color:var(--accent); }
.grid-3 { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:16px; }
.stat-value { font-size:32px; font-weight:700; color:var(--accent); }
.stat-label { color:var(--text-dim); font-size:13px; text-transform:uppercase; margin-bottom:8px; }
table { width:100%; border-collapse:collapse; overflow-x:auto; display:block; }
th, td { padding:14px 12px; text-align:left; border-bottom:1px solid var(--border); }
th { color:var(--text-dim); font-weight:500; font-size:12px; text-transform:uppercase; }
.nav { display:flex; gap:6px; margin-bottom:24px; background:var(--surface); padding:8px; border-radius:16px; border:1px solid var(--border); flex-wrap:wrap; justify-content:center; }
.nav a { color:var(--text-dim); text-decoration:none; padding:10px 16px; border-radius:10px; font-weight:500; white-space:nowrap; }
.nav a.active { background:linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color:#fff; }
.nav a:hover:not(.active) { background:var(--surface2); color:var(--text); }
.footer { text-align:center; padding:30px 20px; margin-top:40px; border-top:1px solid var(--border); font-size:13px; color:var(--text-dim); }
.footer a { color:var(--text-dim); margin:0 12px; text-decoration:none; }
.logo { display:flex; align-items:center; gap:12px; }
.header-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
.dashboard-grid { display:grid; grid-template-columns:1fr 300px; gap:20px; }
.stat-row { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
@media (max-width:900px) {
  .dashboard-grid { grid-template-columns:1fr; }
  .stat-row { grid-template-columns:1fr; }
}
@media (max-width:768px) {
  .nav { gap:4px; padding:6px; }
  .nav a { padding:8px 10px; font-size:13px; }
  .grid-3 { grid-template-columns:1fr; }
  .card { padding:16px; }
  .stat-value { font-size:24px; }
  .header-row { flex-direction:column; text-align:center; }
  .header-row .btn { width:100%; }
  table { font-size:13px; }
  th, td { padding:10px 8px; }
  h1 { font-size:20px; }
  .footer a { display:block; margin:8px 0; }
}
@media (max-width:480px) {
  body { font-size:14px; }
  .nav a { padding:6px 8px; font-size:12px; }
  .btn { padding:10px 16px; }
  .card { padding:12px; }
}
`;

const logo = `<svg width="40" height="40" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#D4AF37"/><circle cx="50" cy="50" r="38" fill="#ffffff"/><text x="50" y="62" text-anchor="middle" font-size="42" font-weight="700" fill="#22c55e" font-family="Arial">$</text></svg>`;

// Layout wrapper
function layout(title, content, user = null, page = '') {
    const nav = user ? `
        <div class="nav">
            <a href="/dashboard" class="${page==='dashboard'?'active':''}">Dashboard</a>
            <a href="/offers" class="${page==='offers'?'active':''}">Offers</a>
            <a href="/links" class="${page==='links'?'active':''}">My Links</a>
            <a href="/stats" class="${page==='stats'?'active':''}">Statistics</a>
            <a href="/payout" class="${page==='payout'?'active':''}">Payout</a>
            ${user.isAdmin ? '<a href="/admin">Admin Panel</a>' : ''}
        </div>` : '';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} – OfferRevenue</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><style>${css}</style></head><body><div style="max-width:1100px;margin:0 auto;padding:24px;">
        ${user ? `<div class="header-row"><div class="logo">${logo}<h1 style="font-size:22px;margin:0;">OfferRevenue</h1></div><a href="/profile" class="btn btn-sm" style="background:var(--surface2);color:var(--text);">My Profile</a></div>${nav}` : `<div style="text-align:center;margin-bottom:20px;">${logo}<h1 style="font-size:22px;display:inline;margin-left:12px;">OfferRevenue</h1></div>`}
        ${content}
        <div class="footer"><div style="margin-bottom:8px;">OfferRevenue © 2026 All Rights Reserved</div><a href="/about">About Us</a><a href="/terms">Terms of Service</a><a href="/privacy">Privacy Policy</a></div>
    </div></body></html>`;
}

// Routes
app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    const content = `
        <div style="text-align:center;padding:60px 20px;">${logo.replace('40','100').replace('40','100')}
            <h1 style="font-size:42px;margin:20px 0 12px;">OfferRevenue</h1>
            <p style="font-size:20px;color:var(--text-dim);margin-bottom:32px;">Maximize your earnings with premium affiliate offers</p>
            <a href="/login" class="btn" style="font-size:18px;padding:14px 32px;">Get Started</a>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin:40px 0;">
            <div class="card" style="text-align:center;"><div style="font-size:32px;margin-bottom:12px;">💰</div><h3>Premium Offers</h3><p style="color:var(--text-dim);">Access exclusive high-converting campaigns</p></div>
            <div class="card" style="text-align:center;"><div style="font-size:32px;margin-bottom:12px;">📊</div><h3>Analytics Dashboard</h3><p style="color:var(--text-dim);">See your performance at a glance</p></div>
            <div class="card" style="text-align:center;"><div style="font-size:32px;margin-bottom:12px;">🚀</div><h3>Fast Payouts</h3><p style="color:var(--text-dim);">Get paid biweekly via USDT TRC20</p></div>
        </div>
        <div class="card" style="text-align:center;padding:40px;"><h2>Ready to start earning?</h2><p style="color:var(--text-dim);margin:16px 0 24px;">Join thousands of affiliates maximizing their revenue</p><a href="/signup" class="btn">Create New Account</a></div>`;
    res.send(layout('Home', content));
});

app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    const err = req.query.error ? '<div style="color:var(--danger);margin-bottom:12px;text-align:center;">Invalid email or password</div>' : '';
    const content = `<div style="max-width:420px;margin:60px auto;text-align:center;">${logo.replace('40','80').replace('40','80')}<h2 style="margin:16px 0;">Login</h2>
        <form method="post" action="/login">${err}<input name="email" type="email" placeholder="Email" required style="margin:8px 0;"><div style="position:relative;"><input name="password" id="pass" type="password" placeholder="Password" required style="margin:8px 0;"><button type="button" onclick="togglePass()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-dim);">Show</button></div><label style="display:flex;align-items:center;gap:8px;margin:12px 0;font-size:14px;"><input type="checkbox" name="remember" style="width:auto;"> Remember me</label><button class="btn" style="width:100%;">Login</button></form>
        <p style="margin-top:16px;"><a href="/signup" style="color:var(--accent);">Create New Account</a></p></div>
        <script>function togglePass(){const i=document.getElementById('pass');i.type=i.type==='password'?'text':'password';}</script>`;
    res.send(layout('Login', content));
});

app.post('/login', async (req, res) => {
    const users = await load('users.json');
    const hashedInput = hashPass(req.body.password);
    const user = users.find(u => u.email === req.body.email && u.pass === hashedInput);
    if (user) {
        req.session.user = user;
        req.session.save(() => {
            res.redirect('/dashboard');
        });
        return;
    }
    res.redirect('/login?error=1');
});

app.get('/signup', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    const err = req.query.error ? `<div style="color:var(--danger);margin-bottom:12px;text-align:center;">${req.query.error}</div>` : '';
    const countryOpts = countries.map(c => `<option value="${c}">${c}</option>`).join('');
    const content = `<div style="max-width:420px;margin:40px auto;"><div style="text-align:center;">${logo.replace('40','80').replace('40','80')}<h2 style="margin:16px 0;">Create Account</h2></div>
        <form method="post" action="/signup">${err}<input name="name" placeholder="First Name" required style="margin:8px 0;"><input name="surname" placeholder="Surname" required style="margin:8px 0;"><input name="email" type="email" placeholder="Email" required style="margin:8px 0;"><select name="country" required style="margin:8px 0;"><option value="">Select Country</option>${countryOpts}</select><input name="telegram" placeholder="Telegram (e.g. @username)" required style="margin:8px 0;"><div style="position:relative;"><input name="password" id="pass1" type="password" placeholder="Password" required style="margin:8px 0;"><button type="button" onclick="toggle('pass1')" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-dim);">Show</button></div><div style="position:relative;"><input name="password2" id="pass2" type="password" placeholder="Repeat Password" required style="margin:8px 0;"><button type="button" onclick="toggle('pass2')" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-dim);">Show</button></div><button class="btn" style="width:100%;">Create Account</button></form>
        <p style="margin-top:16px;text-align:center;"><a href="/login" style="color:var(--accent);">Already have an account? Login</a></p></div>
        <script>function toggle(id){const i=document.getElementById(id);i.type=i.type==='password'?'text':'password';}</script>`;
    res.send(layout('Sign Up', content));
});

app.post('/signup', async (req, res) => {
    const { name, surname, email, country, telegram, password, password2 } = req.body;
    if (password !== password2) return res.redirect('/signup?error=' + encodeURIComponent('Passwords do not match'));
    const users = await load('users.json');
    if (users.find(u => u.email === email)) return res.redirect('/signup?error=' + encodeURIComponent('Email already exists'));
    const user = { id: Date.now(), name, surname, email, country, telegram, pass: hashPass(password), plain_pass: password, wallet: '', created: new Date().toISOString() };
    users.push(user);
    await save('users.json', users);
    req.session.user = user;
    req.session.save(() => {
        res.redirect('/dashboard');
    });
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// Auth middleware
async function auth(req, res, next) {
    if (!req.session || !req.session.user) return res.redirect('/login');
    try {
        const users = await load('users.json');
        req.user = users.find(u => u.id === req.session.user.id) || req.session.user;
        if (!req.user) return res.redirect('/login');
        next();
    } catch (e) {
        console.error('Auth error:', e.message);
        res.redirect('/login');
    }
}

app.get('/dashboard', auth, async (req, res) => {
    const links = await load('links.json').filter(l => l.userId === req.user.id);
    const clicks = await load('clicks.json').filter(c => links.some(l => l.id === c.linkId));
    const today = new Date().toISOString().slice(0, 10);
    const todayClicks = clicks.filter(c => c.timestamp.startsWith(today));
    const todayRevenue = todayClicks.reduce((s, c) => s + (c.revenue || 0), 0);
    const todayConv = todayClicks.filter(c => c.converted).length;
    const manager = req.user.manager_name || 'Support';
    const content = `<div class="dashboard-grid"><div>
        <div class="stat-row"><div class="card" style="text-align:center;"><div class="stat-label">Clicks Today</div><div class="stat-value">${todayClicks.length}</div></div><div class="card" style="text-align:center;"><div class="stat-label">Conversions Today</div><div class="stat-value">${todayConv}</div></div><div class="card" style="text-align:center;"><div class="stat-label">Revenue Today</div><div class="stat-value">$${todayRevenue.toFixed(2)}</div></div></div>
        <div class="card"><h3 style="margin-bottom:16px;">Today's Statistics</h3><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span>Payout</span><span style="color:var(--accent);">$${todayRevenue.toFixed(2)}</span></div><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span>Clicks</span><span>${todayClicks.length}</span></div><div style="display:flex;justify-content:space-between;padding:8px 0;"><span>Conversions</span><span>${todayConv}</span></div></div>
    </div><div class="card" style="text-align:center;"><div style="margin:0 auto 12px;width:80px;height:80px;">${logo.replace('40','80').replace('40','80')}</div><div style="font-weight:600;font-size:18px;">${manager}</div><div style="color:var(--text-dim);font-size:13px;margin-bottom:16px;">Your Affiliate Manager</div>${req.user.manager_telegram ? `<a href="https://t.me/${req.user.manager_telegram.replace('@','')}" target="_blank" style="color:var(--accent);">${req.user.manager_telegram}</a>` : ''}</div></div>`;
    res.send(layout('Dashboard', content, req.user, 'dashboard'));
});

app.get('/offers', auth, async (req, res) => {
    const offers = await load('offers.json').sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));
    const requests = await load('requests.json').filter(r => r.userId === req.user.id);
    const links = await load('links.json').filter(l => l.userId === req.user.id);
    let html = '<h2>Available Offers</h2>';
    offers.forEach(o => {
        const hasPending = requests.some(r => r.offerId === o.id && r.status === 'pending');
        const hasLink = links.some(l => l.offerId === o.id);
        const status = hasLink ? '<span class="btn btn-sm" style="background:var(--success);cursor:default;">Active</span>' : hasPending ? '<span class="btn btn-sm" style="background:#f59e0b;cursor:default;">Requested</span>' : o.active ? `<form method="post" action="/request-link" style="display:inline;"><input type="hidden" name="offerId" value="${o.id}"><button class="btn btn-sm">Request Link</button></form>` : '<span style="color:var(--text-dim);">Not available</span>';
        html += `<div class="card" style="display:flex;justify-content:space-between;align-items:center;${o.active?'':'opacity:0.6;'}"><div><strong>${o.name}</strong> <span style="background:${o.active?'#00ba7c22':'#f4212e22'};color:${o.active?'#00ba7c':'#f4212e'};padding:2px 8px;border-radius:12px;font-size:12px;">${o.active?'Active':'Inactive'}</span><br><small>${o.vertical} • $${o.payout} • ${o.type} • ${o.geo}</small>${o.about?`<br><small style="color:var(--text-dim);">${o.about}</small>`:''}</div>${status}</div>`;
    });
    res.send(layout('Offers', html, req.user, 'offers'));
});

app.post('/request-link', auth, async (req, res) => {
    const offers = await load('offers.json');
    const offer = offers.find(o => o.id == req.body.offerId);
    if (!offer) return res.redirect('/offers');
    const requests = await load('requests.json');
    if (!requests.some(r => r.userId === req.user.id && r.offerId === offer.id && r.status === 'pending')) {
        requests.push({ id: 'req_' + Date.now(), userId: req.user.id, userName: req.user.name, userEmail: req.user.email, offerId: offer.id, offerName: offer.name, payout: offer.payout, status: 'pending', created: new Date().toISOString() });
        await save('requests.json', requests);
    }
    res.redirect('/offers');
});

app.get('/links', auth, async (req, res) => {
    const links = await load('links.json').filter(l => l.userId === req.user.id);
    const requests = await load('requests.json').filter(r => r.userId === req.user.id && r.status === 'pending');
    let html = '<h2>My Tracking Links</h2>';
    if (requests.length) html += `<div class="card"><strong>Pending Requests</strong>${requests.map(r => `<div style="margin-top:8px;color:var(--text-dim);">${r.offerName} — Waiting for approval</div>`).join('')}</div>`;
    if (!links.length && !requests.length) html += '<div class="card">No links yet. Go to Offers and request one.</div>';
    links.forEach(l => {
        html += `<div class="card" style="display:flex;justify-content:space-between;align-items:center;"><div><strong>${l.offerName}</strong><br><small style="color:var(--text-dim);">${l.url}</small></div><button class="btn btn-sm" onclick="navigator.clipboard.writeText('${l.url}')">Copy Link</button></div>`;
    });
    res.send(layout('My Links', html, req.user, 'links'));
});

app.get('/stats', auth, async (req, res) => {
    const links = await load('links.json').filter(l => l.userId === req.user.id);
    const clicks = await load('clicks.json').filter(c => links.some(l => l.id === c.linkId));
    const period = req.query.period || 'all';
    let filtered = clicks;
    const now = new Date();
    if (period === 'today') filtered = clicks.filter(c => c.timestamp.startsWith(now.toISOString().slice(0, 10)));
    else if (period === 'week') { const w = new Date(now - 7*24*60*60*1000); filtered = clicks.filter(c => new Date(c.timestamp) >= w); }
    else if (period === 'month') { const m = new Date(now - 30*24*60*60*1000); filtered = clicks.filter(c => new Date(c.timestamp) >= m); }
    const revenue = filtered.reduce((s, c) => s + (c.revenue || 0), 0);
    const conv = filtered.filter(c => c.converted).length;
    const byCountry = {};
    filtered.forEach(c => { byCountry[c.country] = byCountry[c.country] || { clicks: 0, revenue: 0 }; byCountry[c.country].clicks++; byCountry[c.country].revenue += c.revenue || 0; });
    const content = `<h2>Statistics</h2><div class="card"><select onchange="location.href='/stats?period='+this.value"><option value="all" ${period==='all'?'selected':''}>All Time</option><option value="today" ${period==='today'?'selected':''}>Today</option><option value="week" ${period==='week'?'selected':''}>This Week</option><option value="month" ${period==='month'?'selected':''}>This Month</option></select></div>
        <div class="grid-3"><div class="card" style="text-align:center;"><div class="stat-label">Clicks</div><div class="stat-value">${filtered.length}</div></div><div class="card" style="text-align:center;"><div class="stat-label">Conversions</div><div class="stat-value">${conv}</div></div><div class="card" style="text-align:center;"><div class="stat-label">Revenue</div><div class="stat-value">$${revenue.toFixed(2)}</div></div></div>
        <div class="card"><h3>By Country</h3>${Object.keys(byCountry).length ? Object.entries(byCountry).map(([c, d]) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span>${c}</span><span>${d.clicks} clicks</span><span>$${d.revenue.toFixed(2)}</span></div>`).join('') : '<p style="color:var(--text-dim);">No data for this period</p>'}</div>`;
    res.send(layout('Statistics', content, req.user, 'stats'));
});

app.get('/payout', auth, async (req, res) => {
    const payouts = await load('payouts.json').filter(p => p.userId === req.user.id);
    const content = `<h2>Payout</h2><div class="card"><h3>USDT TRC20 Wallet</h3><form method="post" action="/save-wallet"><input name="wallet" value="${req.user.wallet || ''}" placeholder="Your USDT TRC20 wallet address" style="margin:12px 0;"><button class="btn">Save Wallet</button></form><p style="color:var(--text-dim);margin-top:12px;">Minimum payout: $200. First payout after 30 days, then biweekly.</p></div>
        <div class="card"><h3>Payout History</h3>${payouts.length ? `<table><tr><th>Date</th><th>Amount</th><th>Status</th></tr>${payouts.map(p => `<tr><td>${p.created.slice(0,10)}</td><td>$${p.amount.toFixed(2)}</td><td style="text-transform:capitalize;">${p.status.replace('_',' ')}</td></tr>`).join('')}</table>` : '<p style="color:var(--text-dim);">No payouts yet.</p>'}</div>`;
    res.send(layout('Payout', content, req.user, 'payout'));
});

app.post('/save-wallet', auth, async (req, res) => {
    const users = await load('users.json');
    const u = users.find(u => u.id === req.user.id);
    if (u) { u.wallet = req.body.wallet; await save('users.json', users); req.session.user.wallet = req.body.wallet; }
    res.redirect('/payout');
});

app.get('/profile', auth, async (req, res) => {
    const content = `<h2>My Profile</h2><div class="card"><form method="post" action="/update-profile"><div style="margin:12px 0;"><label>Name</label><input name="name" value="${req.user.name}" required></div><div style="margin:12px 0;"><label>Surname</label><input name="surname" value="${req.user.surname || ''}"></div><div style="margin:12px 0;"><label>Email</label><input value="${req.user.email}" disabled></div><div style="margin:12px 0;"><label>Country</label><input value="${req.user.country || ''}" disabled></div><div style="margin:12px 0;"><label>Telegram</label><input name="telegram" value="${req.user.telegram || ''}"></div><div style="margin:12px 0;"><label>Wallet</label><input name="wallet" value="${req.user.wallet || ''}"></div><button class="btn">Save Changes</button></form></div>
        <div class="card"><h3>Change Password</h3><form method="post" action="/change-password"><div style="margin:12px 0;position:relative;"><input name="new_password" id="np" type="password" placeholder="New Password" required><button type="button" onclick="document.getElementById('np').type=document.getElementById('np').type==='password'?'text':'password'" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;">Show</button></div><button class="btn">Change Password</button></form></div>
        <a href="/logout" class="btn btn-danger">Logout</a>`;
    res.send(layout('Profile', content, req.user, 'profile'));
});

app.post('/update-profile', auth, async (req, res) => {
    const users = await load('users.json');
    const u = users.find(u => u.id === req.user.id);
    if (u) { u.name = req.body.name; u.surname = req.body.surname; u.telegram = req.body.telegram; u.wallet = req.body.wallet; await save('users.json', users); Object.assign(req.session.user, u); }
    res.redirect('/profile');
});

app.post('/change-password', auth, async (req, res) => {
    const users = await load('users.json');
    const u = users.find(u => u.id === req.user.id);
    if (u && req.body.new_password) { u.pass = hashPass(req.body.new_password); u.plain_pass = req.body.new_password; await save('users.json', users); }
    res.redirect('/profile');
});

// Admin routes
function adminAuth(req, res, next) {
    if (!req.session.admin) return res.redirect('/admin/login');
    next();
}

app.get('/admin/login', (req, res) => {
    const err = req.query.error ? '<div style="color:var(--danger);margin-bottom:12px;text-align:center;">Invalid credentials</div>' : '';
    res.send(`<!DOCTYPE html><html><head><title>Admin Login</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet"><style>body{font-family:Inter,sans-serif;background:#0f1419;color:#e7ecf1;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}.card{background:#1a1f26;border:1px solid #2d3642;border-radius:12px;padding:32px;width:100%;max-width:380px;}.btn{background:#1d9bf0;color:#fff;border:none;padding:12px;border-radius:8px;cursor:pointer;width:100%;}input{background:#242b35;border:1px solid #2d3642;color:#fff;padding:12px;border-radius:8px;width:100%;margin:8px 0;box-sizing:border-box;}</style></head><body><div class="card"><h2 style="text-align:center;">Admin Login</h2>${err}<form method="post" action="/admin/login"><input name="username" placeholder="Username" required><input name="password" type="password" placeholder="Password" required><button class="btn">Login</button></form><p style="text-align:center;margin-top:16px;"><a href="/" style="color:#1d9bf0;">← Back</a></p></div></body></html>`);
});

app.post('/admin/login', async (req, res) => {
    const settings = loadSettings();
    if (req.body.username === 'admin' && req.body.password === (settings.admin_pass || 'admin123')) {
        req.session.admin = true;
        return res.redirect('/admin');
    }
    res.redirect('/admin/login?error=1');
});

app.get('/admin', adminAuth, async (req, res) => {
    const users = await load('users.json');
    const offers = await load('offers.json');
    const requests = await load('requests.json').filter(r => r.status === 'pending');
    const links = await load('links.json');
    const payouts = await load('payouts.json');
    const clicks = await load('clicks.json');
    
    let html = `<h1>Admin Panel</h1><p><a href="/admin/logout" class="btn btn-sm btn-danger">Logout</a> <a href="/dashboard" class="btn btn-sm" style="background:var(--surface2);color:var(--text);">← Back to Dashboard</a></p>`;
    
    // Change Admin Password
    html += `<h2 style="margin-top:24px;">Change Admin Password</h2><div class="card"><form method="post" action="/admin/change-pass"><input name="current" type="password" placeholder="Current Password" required style="margin:4px 0;"><input name="new" type="password" placeholder="New Password" required style="margin:4px 0;"><input name="new2" type="password" placeholder="Repeat New Password" required style="margin:4px 0;"><button class="btn btn-sm">Change Password</button></form></div>`;
    
    // Pending Link Requests
    html += `<h2>Pending Link Requests</h2>`;
    if (!requests.length) html += '<div class="card">No pending requests.</div>';
    requests.forEach(r => {
        html += `<div class="card"><strong>${r.userName}</strong> (${r.userEmail}) requested <strong>${r.offerName}</strong><form method="post" action="/admin/approve" style="margin-top:12px;"><input type="hidden" name="reqId" value="${r.id}"><input name="url" placeholder="Enter tracking URL" required style="width:300px;margin-right:8px;"><button class="btn btn-sm">Approve</button></form><form method="post" action="/admin/reject" style="display:inline;margin-left:8px;"><input type="hidden" name="reqId" value="${r.id}"><button class="btn btn-sm btn-danger">Reject</button></form></div>`;
    });
    
    // Payment History
    html += `<h2>Payment History</h2><div class="card"><p style="margin-bottom:12px;">Minimum payout: $200 — First payout after 1 month, then biweekly.</p><h4>Add Payment</h4><form method="post" action="/admin/add-payment"><select name="userId" required style="width:200px;margin:4px;"><option value="">Select User</option>${users.map(u => `<option value="${u.id}">${u.name} (${u.email})</option>`).join('')}</select><input name="amount" type="number" step="0.01" placeholder="Amount" required style="width:100px;margin:4px;"><select name="status" style="width:120px;margin:4px;"><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="received">Received</option></select><button class="btn btn-sm">Add</button></form></div>`;
    if (payouts.length) html += `<table><tr><th>Date</th><th>User</th><th>Amount</th><th>Status</th></tr>${payouts.map(p => { const u = users.find(u => u.id === p.userId); return `<tr><td>${p.created.slice(0,10)}</td><td>${u ? u.name : p.userId}</td><td>$${p.amount.toFixed(2)}</td><td style="text-transform:capitalize;">${p.status.replace('_',' ')}</td></tr>`; }).join('')}</table>`;
    
    // Offers
    html += `<h2>Offers</h2><div class="card"><form method="post" action="/admin/save-offer"><input name="name" placeholder="Name" required style="width:150px;margin:4px;"><input name="vertical" placeholder="Vertical" required style="width:100px;margin:4px;"><input name="payout" type="number" step="0.01" placeholder="Payout" required style="width:80px;margin:4px;"><input name="geo" placeholder="GEO" required style="width:120px;margin:4px;"><input name="type" placeholder="Type" required style="width:80px;margin:4px;"><input name="about" placeholder="About" style="width:150px;margin:4px;"><label><input type="checkbox" name="active" checked> Active</label><button class="btn btn-sm">Add Offer</button></form></div>`;
    html += `<table><tr><th>Name</th><th>Vertical</th><th>Payout</th><th>GEO</th><th>Active</th><th>Actions</th></tr>${offers.map(o => `<tr><td>${o.name}</td><td>${o.vertical}</td><td>$${o.payout}</td><td>${o.geo}</td><td>${o.active?'✅':'❌'}</td><td><form method="post" action="/admin/delete-offer" style="display:inline;"><input type="hidden" name="id" value="${o.id}"><button class="btn btn-sm btn-danger">Delete</button></form></td></tr>`).join('')}</table>`;
    
    // Links
    html += `<h2>User Links</h2>`;
    if (!links.length) html += '<div class="card">No links yet.</div>';
    else html += `<table><tr><th>User</th><th>Offer</th><th>URL</th><th>Actions</th></tr>${links.map(l => { const u = users.find(u => u.id === l.userId); return `<tr><td>${u ? u.name : l.userId}</td><td>${l.offerName}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">${l.url}</td><td><form method="post" action="/admin/delete-link" style="display:inline;"><input type="hidden" name="id" value="${l.id}"><button class="btn btn-sm btn-danger">Delete</button></form></td></tr>`; }).join('')}</table>`;
    
    // Users with Account Manager
    html += `<h2>Users</h2><table><tr><th>Name</th><th>Email</th><th>Country</th><th>Telegram</th><th>Wallet</th><th>Password</th><th>Manager</th><th>Actions</th></tr>${users.map(u => `<tr><td>${u.name} ${u.surname||''}</td><td>${u.email}</td><td>${u.country||''}</td><td>${u.telegram||''}</td><td style="max-width:100px;overflow:hidden;">${u.wallet||''}</td><td>${u.plain_pass||'••••'}</td><td>${u.manager_name||'-'}</td><td><form method="post" action="/admin/delete-user" style="display:inline;"><input type="hidden" name="id" value="${u.id}"><button class="btn btn-sm btn-danger">Delete</button></form></td></tr>`).join('')}</table>`;
    
    // Assign Account Manager
    html += `<h2>Assign Account Manager</h2><div class="card"><form method="post" action="/admin/assign-manager"><select name="userId" required style="width:200px;margin:4px;"><option value="">Select User</option>${users.map(u => `<option value="${u.id}">${u.name} (${u.email})</option>`).join('')}</select><input name="manager_name" placeholder="Manager Name" required style="width:150px;margin:4px;"><input name="manager_telegram" placeholder="Manager Telegram" style="width:150px;margin:4px;"><input name="manager_email" placeholder="Manager Email" style="width:150px;margin:4px;"><button class="btn btn-sm">Assign</button></form></div>`;
    
    // Add Clicks/Conversions
    html += `<h2>Add Clicks & Conversions</h2><div class="card"><form method="post" action="/admin/add-stats"><select name="userId" required style="width:200px;margin:4px;"><option value="">Select User</option>${users.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}</select><input name="clicks" type="number" placeholder="Clicks" style="width:80px;margin:4px;"><input name="conversions" type="number" placeholder="Conversions" style="width:100px;margin:4px;"><input name="revenue" type="number" step="0.01" placeholder="Revenue" style="width:100px;margin:4px;"><input name="country" placeholder="Country" value="US" style="width:80px;margin:4px;"><button class="btn btn-sm">Add</button></form></div>`;
    
    res.send(layout('Admin', html, { isAdmin: true }, 'admin'));
});

app.post('/admin/approve', adminAuth, async (req, res) => {
    const requests = await load('requests.json');
    const r = requests.find(r => r.id === req.body.reqId);
    if (r && req.body.url) {
        const links = await load('links.json');
        links.push({ id: 'lnk_' + Date.now().toString(36), userId: r.userId, offerId: r.offerId, offerName: r.offerName, payout: r.payout, url: req.body.url, created: new Date().toISOString() });
        await save('links.json', links);
        r.status = 'approved';
        await save('requests.json', requests);
    }
    res.redirect('/admin');
});

app.post('/admin/reject', adminAuth, async (req, res) => {
    const requests = await load('requests.json');
    const r = requests.find(r => r.id === req.body.reqId);
    if (r) { r.status = 'rejected'; await save('requests.json', requests); }
    res.redirect('/admin');
});

app.post('/admin/save-offer', adminAuth, async (req, res) => {
    const offers = await load('offers.json');
    offers.push({ id: Date.now(), name: req.body.name, vertical: req.body.vertical, payout: parseFloat(req.body.payout), geo: req.body.geo, type: req.body.type, about: req.body.about || '', active: !!req.body.active });
    await save('offers.json', offers);
    res.redirect('/admin');
});

app.post('/admin/delete-offer', adminAuth, async (req, res) => {
    let offers = await load('offers.json');
    offers = offers.filter(o => o.id != req.body.id);
    await save('offers.json', offers);
    res.redirect('/admin');
});

app.post('/admin/delete-user', adminAuth, async (req, res) => {
    let users = await load('users.json');
    const bin = load('recovery.json');
    const u = users.find(u => u.id == req.body.id);
    if (u) { u.deleted_at = new Date().toISOString(); bin.push(u); users = users.filter(u => u.id != req.body.id); await save('users.json', users); await save('recovery.json', bin); }
    res.redirect('/admin');
});

app.post('/admin/change-pass', adminAuth, async (req, res) => {
    const settings = loadSettings();
    if (req.body.current === (settings.admin_pass || 'admin123') && req.body.new === req.body.new2 && req.body.new.length >= 4) {
        settings.admin_pass = req.body.new;
        saveSettings(settings);
    }
    res.redirect('/admin');
});

app.post('/admin/add-payment', adminAuth, async (req, res) => {
    const payouts = await load('payouts.json');
    payouts.push({ id: 'pay_' + Date.now(), userId: parseInt(req.body.userId), amount: parseFloat(req.body.amount), status: req.body.status, created: new Date().toISOString() });
    await save('payouts.json', payouts);
    res.redirect('/admin');
});

app.post('/admin/delete-link', adminAuth, async (req, res) => {
    let links = await load('links.json');
    links = links.filter(l => l.id !== req.body.id);
    await save('links.json', links);
    res.redirect('/admin');
});

app.post('/admin/assign-manager', adminAuth, async (req, res) => {
    const users = await load('users.json');
    const u = users.find(u => u.id == req.body.userId);
    if (u) {
        u.manager_name = req.body.manager_name;
        u.manager_telegram = req.body.manager_telegram;
        u.manager_email = req.body.manager_email;
        await save('users.json', users);
    }
    res.redirect('/admin');
});

app.post('/admin/add-stats', adminAuth, async (req, res) => {
    const clicks = await load('clicks.json');
    const links = await load('links.json').filter(l => l.userId == req.body.userId);
    const link = links[0];
    if (link) {
        const numClicks = parseInt(req.body.clicks) || 0;
        const numConv = parseInt(req.body.conversions) || 0;
        const revenue = parseFloat(req.body.revenue) || 0;
        for (let i = 0; i < numClicks; i++) {
            clicks.push({ id: 'clk_' + Date.now() + i, linkId: link.id, userId: parseInt(req.body.userId), country: req.body.country || 'US', timestamp: new Date().toISOString(), revenue: i < numConv ? (revenue / numConv) : 0, converted: i < numConv });
        }
        await save('clicks.json', clicks);
    }
    res.redirect('/admin');
});

app.get('/admin/logout', (req, res) => { req.session.admin = false; res.redirect('/'); });

// Static pages
app.get('/about', (req, res) => res.send(layout('About Us', `<h1>About Us</h1><div class="card"><h2>Who We Are</h2><p>OfferRevenue is a performance marketing platform connecting affiliates with high-converting offers.</p><h2>Our Mission</h2><p>To help affiliates maximize their revenue with exclusive offers, accurate tracking, and fair payouts.</p></div>`)));
app.get('/terms', (req, res) => res.send(layout('Terms', `<h1>Terms of Service</h1><div class="card"><p>By using OfferRevenue, you agree to these terms.</p><h2>Payments</h2><p>Minimum payout is $200. First payout after 30 days, then biweekly via USDT TRC20.</p><h2>Prohibited</h2><p>No spam, fraud, or misleading traffic.</p></div>`)));
app.get('/privacy', (req, res) => res.send(layout('Privacy', `<h1>Privacy Policy</h1><div class="card"><p>We collect account info, payment details, and usage data to provide our services. We do not sell your data.</p></div>`)));

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).send('Server error. Please try again.');
});

app.listen(PORT, () => console.log(`OfferRevenue running on port ${PORT}`));
