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
            const [rows] = await db.execute('SELECT data FROM store WHERE id = ?', [key]);
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
app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.send(layout('Home', `<div style="text-align:center;padding:40px 0;"><h2>Maximize your earnings with premium affiliate offers</h2><p style="color:var(--dim);margin:16px 0 24px;">Join thousands of affiliates</p><a href="/login" class="btn" style="font-size:18px;padding:14px 32px;">Get Started</a></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;margin:40px 0;"><div class="card" style="text-align:center;"><div style="font-size:40px;">💰</div><h3>Premium Offers</h3><p style="color:var(--dim);">Access exclusive campaigns</p></div><div class="card" style="text-align:center;"><div style="font-size:40px;">📊</div><h3>Analytics Dashboard</h3><p style="color:var(--dim);">See your performance</p></div><div class="card" style="text-align:center;"><div style="font-size:40px;">🚀</div><h3>Fast Payouts</h3><p style="color:var(--dim);">Paid biweekly via USDT</p></div></div><div class="card" style="text-align:center;padding:40px;"><h2>Ready to start earning?</h2><p style="color:var(--dim);margin:16px 0 24px;">Join now</p><a href="/signup" class="btn">Create New Account</a></div>`));
});

app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    const err = req.query.error ? '<div style="color:var(--danger);text-align:center;margin-bottom:12px;">Invalid email or password</div>' : '';
    res.send(layout('Login', `<div style="max-width:400px;margin:40px auto;"><div style="text-align:center;">${logo.replace('40','80').replace('40','80')}<h2 style="margin:16px 0;">Login</h2></div><form method="post" action="/login">${err}<input name="email" type="email" placeholder="Email" required style="margin:8px 0;"><input name="password" type="password" placeholder="Password" required style="margin:8px 0;"><button class="btn" style="width:100%;">Login</button></form><p style="margin-top:16px;text-align:center;"><a href="/signup" style="color:var(--accent);">Create New Account</a></p></div>`));
});

app.post('/login', async (req, res) => {
    const users = await load('users.json');
    const email = (req.body.email || '').toLowerCase().trim();
    const pass = hash(req.body.password || '');
    const user = users.find(u => u.email === email && u.pass === pass);
    if (user) {
        req.session.user = user;
        return res.redirect('/dashboard');
    }
    res.redirect('/login?error=1');
});

app.get('/signup', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    const err = req.query.error ? `<div style="color:var(--danger);text-align:center;margin-bottom:12px;">${req.query.error}</div>` : '';
    const opts = countries.map(c => `<option value="${c}">${c}</option>`).join('');
    res.send(layout('Sign Up', `<div style="max-width:400px;margin:40px auto;"><div style="text-align:center;">${logo.replace('40','80').replace('40','80')}<h2 style="margin:16px 0;">Create Account</h2></div><form method="post" action="/signup">${err}<input name="name" placeholder="First Name" required style="margin:8px 0;"><input name="surname" placeholder="Surname" required style="margin:8px 0;"><input name="email" type="email" placeholder="Email" required style="margin:8px 0;"><select name="country" required style="margin:8px 0;"><option value="">Select Country</option>${opts}</select><input name="telegram" placeholder="Telegram" required style="margin:8px 0;"><input name="password" type="password" placeholder="Password" required style="margin:8px 0;"><input name="password2" type="password" placeholder="Repeat Password" required style="margin:8px 0;"><button class="btn" style="width:100%;">Create Account</button></form><p style="margin-top:16px;text-align:center;"><a href="/login" style="color:var(--accent);">Already have an account?</a></p></div>`));
});

app.post('/signup', async (req, res) => {
    const { name, surname, email, country, telegram, password, password2 } = req.body;
    if (password !== password2) return res.redirect('/signup?error=' + encodeURIComponent('Passwords do not match'));
    const users = await load('users.json');
    const emailLower = email.toLowerCase().trim();
    if (users.find(u => u.email === emailLower)) return res.redirect('/signup?error=' + encodeURIComponent('Email already exists'));
    const user = { id: Date.now(), name, surname, email: emailLower, country, telegram, pass: hash(password), plain_pass: password, wallet: '', created: new Date().toISOString() };
    users.push(user);
    await save('users.json', users);
    req.session.user = user;
    res.redirect('/dashboard');
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

function auth(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}

app.get('/dashboard', auth, async (req, res) => {
    const user = req.session.user;
    const links = (await load('links.json')).filter(l => l.userId === user.id);
    const clicks = (await load('clicks.json')).filter(c => links.some(l => l.id === c.linkId));
    const today = new Date().toISOString().slice(0, 10);
    const todayClicks = clicks.filter(c => c.timestamp && c.timestamp.startsWith(today));
    const todayRev = todayClicks.reduce((s, c) => s + (c.revenue || 0), 0);
    const todayConv = todayClicks.filter(c => c.converted).length;
    const manager = user.manager_name || 'Support';
    res.send(layout('Dashboard', `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:20px;"><div class="card" style="text-align:center;"><div class="stat-label">Clicks Today</div><div class="stat-value">${todayClicks.length}</div></div><div class="card" style="text-align:center;"><div class="stat-label">Conversions</div><div class="stat-value">${todayConv}</div></div><div class="card" style="text-align:center;"><div class="stat-label">Revenue</div><div class="stat-value">$${todayRev.toFixed(2)}</div></div></div><div class="card"><h3>Today's Statistics</h3><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span>Payout</span><span style="color:var(--accent);">$${todayRev.toFixed(2)}</span></div><div style="display:flex;justify-content:space-between;padding:8px 0;"><span>Clicks</span><span>${todayClicks.length}</span></div></div><div class="card" style="text-align:center;"><div style="margin:0 auto 12px;">${logo.replace('40','80').replace('40','80')}</div><div style="font-weight:600;">${manager}</div><div style="color:var(--dim);font-size:13px;">Your Affiliate Manager</div></div>`, user, 'dashboard'));
});

app.get('/offers', auth, async (req, res) => {
    const user = req.session.user;
    const offers = (await load('offers.json')).sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));
    const requests = (await load('requests.json')).filter(r => r.userId === user.id);
    const links = (await load('links.json')).filter(l => l.userId === user.id);
    let html = '<h2>Available Offers</h2>';
    offers.forEach(o => {
        const hasPending = requests.some(r => r.offerId === o.id && r.status === 'pending');
        const hasLink = links.some(l => l.offerId === o.id);
        const status = hasLink ? '<span class="btn btn-sm" style="background:var(--accent);">Active</span>' : hasPending ? '<span class="btn btn-sm" style="background:#f59e0b;">Requested</span>' : o.active ? `<form method="post" action="/request-link" style="display:inline;"><input type="hidden" name="offerId" value="${o.id}"><button class="btn btn-sm">Request Link</button></form>` : '<span style="color:var(--dim);">Not available</span>';
        html += `<div class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;${o.active?'':'opacity:0.6;'}"><div><strong>${o.name}</strong> <span style="background:${o.active?'#22c55e22':'#dc354522'};color:${o.active?'#22c55e':'#dc3545'};padding:2px 8px;border-radius:12px;font-size:12px;">${o.active?'Active':'Inactive'}</span><br><small>${o.vertical} • $${o.payout} • ${o.type} • ${o.geo}</small></div>${status}</div>`;
    });
    res.send(layout('Offers', html, user, 'offers'));
});

app.post('/request-link', auth, async (req, res) => {
    const user = req.session.user;
    const offers = await load('offers.json');
    const offer = offers.find(o => o.id == req.body.offerId);
    if (!offer) return res.redirect('/offers');
    const requests = await load('requests.json');
    if (!requests.some(r => r.userId === user.id && r.offerId === offer.id && r.status === 'pending')) {
        requests.push({ id: 'req_' + Date.now(), userId: user.id, userName: user.name, userEmail: user.email, offerId: offer.id, offerName: offer.name, status: 'pending', created: new Date().toISOString() });
        await save('requests.json', requests);
    }
    res.redirect('/offers');
});

app.get('/links', auth, async (req, res) => {
    const user = req.session.user;
    const links = (await load('links.json')).filter(l => l.userId === user.id);
    const requests = (await load('requests.json')).filter(r => r.userId === user.id && r.status === 'pending');
    let html = '<h2>My Links</h2>';
    if (!links.length && !requests.length) html += '<div class="card">No links yet. Request one from Offers.</div>';
    requests.forEach(r => html += `<div class="card"><strong>${r.offerName}</strong><br><span class="btn btn-sm" style="background:#f59e0b;margin-top:8px;">Pending Approval</span></div>`);
    links.forEach(l => html += `<div class="card"><strong>${l.offerName}</strong><br><input value="${l.url}" readonly style="margin-top:8px;"><button class="btn btn-sm" style="margin-top:8px;" onclick="navigator.clipboard.writeText('${l.url}')">Copy</button></div>`);
    res.send(layout('My Links', html, user, 'links'));
});

app.get('/stats', auth, async (req, res) => {
    const user = req.session.user;
    const links = (await load('links.json')).filter(l => l.userId === user.id);
    const clicks = (await load('clicks.json')).filter(c => links.some(l => l.id === c.linkId));
    const period = req.query.period || 'today';
    const now = new Date();
    let filtered = clicks;
    if (period === 'today') filtered = clicks.filter(c => c.timestamp && c.timestamp.startsWith(now.toISOString().slice(0, 10)));
    else if (period === 'week') filtered = clicks.filter(c => c.timestamp && new Date(c.timestamp) > new Date(now - 7*24*60*60*1000));
    else if (period === 'month') filtered = clicks.filter(c => c.timestamp && new Date(c.timestamp) > new Date(now - 30*24*60*60*1000));
    const rev = filtered.reduce((s, c) => s + (c.revenue || 0), 0);
    const conv = filtered.filter(c => c.converted).length;
    const byCountry = {};
    filtered.forEach(c => { const co = c.country || 'Unknown'; byCountry[co] = byCountry[co] || { clicks: 0, revenue: 0 }; byCountry[co].clicks++; byCountry[co].revenue += c.revenue || 0; });
    res.send(layout('Statistics', `<h2>Statistics</h2><div class="card"><form method="get"><select name="period" onchange="this.form.submit()"><option value="today" ${period==='today'?'selected':''}>Today</option><option value="week" ${period==='week'?'selected':''}>This Week</option><option value="month" ${period==='month'?'selected':''}>This Month</option><option value="all" ${period==='all'?'selected':''}>All Time</option></select></form></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;"><div class="card" style="text-align:center;"><div class="stat-label">Clicks</div><div class="stat-value">${filtered.length}</div></div><div class="card" style="text-align:center;"><div class="stat-label">Conversions</div><div class="stat-value">${conv}</div></div><div class="card" style="text-align:center;"><div class="stat-label">Revenue</div><div class="stat-value">$${rev.toFixed(2)}</div></div></div><div class="card"><h3>By Country</h3>${Object.keys(byCountry).length ? Object.entries(byCountry).map(([c, d]) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span>${c}</span><span>${d.clicks} clicks</span><span>$${d.revenue.toFixed(2)}</span></div>`).join('') : '<p style="color:var(--dim);">No data</p>'}</div>`, user, 'stats'));
});

app.get('/payout', auth, async (req, res) => {
    const user = req.session.user;
    const payouts = (await load('payouts.json')).filter(p => p.userId === user.id);
    res.send(layout('Payout', `<h2>Payout</h2><div class="card"><p>Minimum payout: $200 — First payout after 1 month, then biweekly.</p><form method="post" action="/save-wallet" style="margin-top:16px;"><input name="wallet" value="${user.wallet || ''}" placeholder="USDT TRC20 Wallet"><button class="btn btn-sm" style="margin-top:8px;">Save Wallet</button></form></div><div class="card"><h3>Payment History</h3>${payouts.length ? payouts.map(p => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span>${p.created.slice(0,10)}</span><span>$${p.amount.toFixed(2)}</span><span style="text-transform:capitalize;">${p.status.replace('_',' ')}</span></div>`).join('') : '<p style="color:var(--dim);">No payments yet</p>'}</div>`, user, 'payout'));
});

app.post('/save-wallet', auth, async (req, res) => {
    const users = await load('users.json');
    const u = users.find(u => u.id === req.session.user.id);
    if (u) { u.wallet = req.body.wallet; await save('users.json', users); req.session.user.wallet = req.body.wallet; }
    res.redirect('/payout');
});

app.get('/profile', auth, (req, res) => {
    const user = req.session.user;
    res.send(layout('Profile', `<h2>My Profile</h2><div class="card"><form method="post" action="/update-profile"><div style="margin:12px 0;"><label>Name</label><input name="name" value="${user.name}" required></div><div style="margin:12px 0;"><label>Surname</label><input name="surname" value="${user.surname || ''}"></div><div style="margin:12px 0;"><label>Email</label><input value="${user.email}" disabled></div><div style="margin:12px 0;"><label>Country</label><input value="${user.country || ''}" disabled></div><div style="margin:12px 0;"><label>Telegram</label><input name="telegram" value="${user.telegram || ''}"></div><div style="margin:12px 0;"><label>Wallet</label><input name="wallet" value="${user.wallet || ''}"></div><button class="btn">Save Changes</button></form></div><div class="card"><h3>Change Password</h3><form method="post" action="/change-password"><input name="new_password" type="password" placeholder="New Password" required style="margin:8px 0;"><button class="btn btn-sm">Change Password</button></form></div><div class="card"><a href="/logout" class="btn btn-danger">Logout</a></div>`, user, 'profile'));
});

app.post('/update-profile', auth, async (req, res) => {
    const users = await load('users.json');
    const u = users.find(u => u.id === req.session.user.id);
    if (u) { u.name = req.body.name; u.surname = req.body.surname; u.telegram = req.body.telegram; u.wallet = req.body.wallet; await save('users.json', users); Object.assign(req.session.user, u); }
    res.redirect('/profile');
});

app.post('/change-password', auth, async (req, res) => {
    const users = await load('users.json');
    const u = users.find(u => u.id === req.session.user.id);
    if (u && req.body.new_password) { u.pass = hash(req.body.new_password); u.plain_pass = req.body.new_password; await save('users.json', users); }
    res.redirect('/profile');
});

// Admin
function adminAuth(req, res, next) {
    if (!req.session.admin) return res.redirect('/admin/login');
    next();
}

app.get('/admin/login', (req, res) => {
    const err = req.query.error ? '<div style="color:#f4212e;text-align:center;margin-bottom:12px;">Invalid credentials</div>' : '';
    res.send(`<!DOCTYPE html><html><head><title>Admin Login</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet"><style>body{font-family:Inter,sans-serif;background:#0f1419;color:#e7ecf1;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}.card{background:#1a1f26;border:1px solid #2d3642;border-radius:12px;padding:32px;width:100%;max-width:380px;}.btn{background:#1d9bf0;color:#fff;border:none;padding:12px;border-radius:8px;cursor:pointer;width:100%;}input{background:#242b35;border:1px solid #2d3642;color:#fff;padding:12px;border-radius:8px;width:100%;margin:8px 0;box-sizing:border-box;}</style></head><body><div class="card"><h2 style="text-align:center;">Admin Login</h2>${err}<form method="post" action="/admin/login"><input name="username" placeholder="Username" required><input name="password" type="password" placeholder="Password" required><button class="btn">Login</button></form><p style="text-align:center;margin-top:16px;"><a href="/" style="color:#1d9bf0;">← Back</a></p></div></body></html>`);
});

app.post('/admin/login', (req, res) => {
    if (req.body.username === 'admin' && req.body.password === 'admin123') {
        req.session.admin = true;
        return res.redirect('/admin');
    }
    res.redirect('/admin/login?error=1');
});

app.get('/admin', adminAuth, async (req, res) => {
    const users = await load('users.json');
    const offers = await load('offers.json');
    const requests = (await load('requests.json')).filter(r => r.status === 'pending');
    const links = await load('links.json');
    const payouts = await load('payouts.json');
    let html = `<h1>Admin Panel</h1><p><a href="/admin/logout" class="btn btn-sm btn-danger">Logout</a></p>`;
    html += `<h2>Pending Link Requests</h2>`;
    if (!requests.length) html += '<div class="card">No pending requests.</div>';
    requests.forEach(r => html += `<div class="card"><strong>${r.userName}</strong> (${r.userEmail}) requested <strong>${r.offerName}</strong><form method="post" action="/admin/approve" style="margin-top:12px;"><input type="hidden" name="reqId" value="${r.id}"><input name="url" placeholder="Enter tracking URL" required style="width:300px;margin-right:8px;"><button class="btn btn-sm">Approve</button></form><form method="post" action="/admin/reject" style="display:inline;margin-left:8px;"><input type="hidden" name="reqId" value="${r.id}"><button class="btn btn-sm btn-danger">Reject</button></form></div>`);
    html += `<h2>Payment History</h2><div class="card"><form method="post" action="/admin/add-payment"><select name="userId" required style="width:200px;margin:4px;"><option value="">Select User</option>${users.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}</select><input name="amount" type="number" step="0.01" placeholder="Amount" required style="width:100px;margin:4px;"><select name="status" style="width:120px;margin:4px;"><option value="pending">Pending</option><option value="received">Received</option></select><button class="btn btn-sm">Add</button></form></div>`;
    if (payouts.length) html += `<table><tr><th>Date</th><th>User</th><th>Amount</th><th>Status</th></tr>${payouts.map(p => { const u = users.find(u => u.id === p.userId); return `<tr><td>${p.created.slice(0,10)}</td><td>${u ? u.name : p.userId}</td><td>$${p.amount.toFixed(2)}</td><td>${p.status}</td></tr>`; }).join('')}</table>`;
    html += `<h2>Offers</h2><div class="card"><form method="post" action="/admin/save-offer"><input name="name" placeholder="Name" required style="width:150px;margin:4px;"><input name="vertical" placeholder="Vertical" required style="width:100px;margin:4px;"><input name="payout" type="number" step="0.01" placeholder="Payout" required style="width:80px;margin:4px;"><input name="geo" placeholder="GEO" required style="width:120px;margin:4px;"><input name="type" placeholder="Type" required style="width:80px;margin:4px;"><label><input type="checkbox" name="active" checked> Active</label><button class="btn btn-sm">Add</button></form></div>`;
    html += `<table><tr><th>Name</th><th>Vertical</th><th>Payout</th><th>GEO</th><th>Active</th><th>Actions</th></tr>${offers.map(o => `<tr><td>${o.name}</td><td>${o.vertical}</td><td>$${o.payout}</td><td>${o.geo}</td><td>${o.active?'✅':'❌'}</td><td><form method="post" action="/admin/delete-offer" style="display:inline;"><input type="hidden" name="id" value="${o.id}"><button class="btn btn-sm btn-danger">Delete</button></form></td></tr>`).join('')}</table>`;
    html += `<h2>Users</h2><table><tr><th>Name</th><th>Email</th><th>Country</th><th>Telegram</th><th>Password</th><th>Actions</th></tr>${users.map(u => `<tr><td>${u.name} ${u.surname||''}</td><td>${u.email}</td><td>${u.country||''}</td><td>${u.telegram||''}</td><td>${u.plain_pass||'••••'}</td><td><form method="post" action="/admin/delete-user" style="display:inline;"><input type="hidden" name="id" value="${u.id}"><button class="btn btn-sm btn-danger">Delete</button></form></td></tr>`).join('')}</table>`;
    html += `<h2>Assign Account Manager</h2><div class="card"><form method="post" action="/admin/assign-manager"><select name="userId" required style="width:200px;margin:4px;"><option value="">Select User</option>${users.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}</select><input name="manager_name" placeholder="Manager Name" required style="width:150px;margin:4px;"><input name="manager_telegram" placeholder="Manager Telegram" style="width:150px;margin:4px;"><button class="btn btn-sm">Assign</button></form></div>`;
    res.send(layout('Admin', html, { isAdmin: true }, 'admin'));
});

app.post('/admin/approve', adminAuth, async (req, res) => {
    const requests = await load('requests.json');
    const req_item = requests.find(r => r.id === req.body.reqId);
    if (req_item) {
        req_item.status = 'approved';
        await save('requests.json', requests);
        const links = await load('links.json');
        links.push({ id: 'link_' + Date.now(), userId: req_item.userId, offerId: req_item.offerId, offerName: req_item.offerName, url: req.body.url, created: new Date().toISOString() });
        await save('links.json', links);
    }
    res.redirect('/admin');
});

app.post('/admin/reject', adminAuth, async (req, res) => {
    let requests = await load('requests.json');
    requests = requests.filter(r => r.id !== req.body.reqId);
    await save('requests.json', requests);
    res.redirect('/admin');
});

app.post('/admin/save-offer', adminAuth, async (req, res) => {
    const offers = await load('offers.json');
    offers.push({ id: Date.now(), name: req.body.name, vertical: req.body.vertical, payout: parseFloat(req.body.payout), geo: req.body.geo, type: req.body.type, active: !!req.body.active, about: '' });
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
    users = users.filter(u => u.id != req.body.id);
    await save('users.json', users);
    res.redirect('/admin');
});

app.post('/admin/add-payment', adminAuth, async (req, res) => {
    const payouts = await load('payouts.json');
    payouts.push({ id: 'pay_' + Date.now(), userId: parseInt(req.body.userId), amount: parseFloat(req.body.amount), status: req.body.status, created: new Date().toISOString() });
    await save('payouts.json', payouts);
    res.redirect('/admin');
});

app.post('/admin/assign-manager', adminAuth, async (req, res) => {
    const users = await load('users.json');
    const u = users.find(u => u.id == req.body.userId);
    if (u) { u.manager_name = req.body.manager_name; u.manager_telegram = req.body.manager_telegram; await save('users.json', users); }
    res.redirect('/admin');
});

app.get('/admin/logout', (req, res) => { req.session.admin = false; res.redirect('/'); });

// Static pages
app.get('/about', (req, res) => res.send(layout('About Us', `<h1>About Us</h1><div class="card"><h2>Who We Are</h2><p>OfferRevenue is a performance marketing platform connecting affiliates with high-converting offers.</p><h2>Our Mission</h2><p>To help affiliates maximize their revenue with exclusive offers, accurate tracking, and fair payouts.</p></div>`)));
app.get('/terms', (req, res) => res.send(layout('Terms', `<h1>Terms of Service</h1><div class="card"><p>By using OfferRevenue, you agree to these terms.</p><h2>Payments</h2><p>Minimum payout is $200. First payout after 30 days, then biweekly via USDT TRC20.</p></div>`)));
app.get('/privacy', (req, res) => res.send(layout('Privacy', `<h1>Privacy Policy</h1><div class="card"><p>We collect account info, payment details, and usage data to provide our services. We do not sell your data.</p></div>`)));

app.listen(PORT, () => console.log(`OfferRevenue running on port ${PORT}`));
