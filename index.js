const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 8080;

// ... (full original content with the root route modified to redirect only on xafftrk.com)

app.get('/', (req, res) => {
    const host = (req.headers.host || '').toLowerCase();
    if (host === 'xafftrk.com' || host === 'www.xafftrk.com') {
        return res.redirect(302, 'https://a.vlmjm1.com/1d3232b3-575e-4641-bea5-0b98a6662058?aff_sub=kontrl&aff_id=427804&aff_sub5=SF_006OG00000SkIji');
    }
    if (req.session.user) return res.redirect('/dashboard');
    res.send(layout('Home', `<div style="text-align:center;padding:40px 0;"><h2>Maximize your earnings with premium affiliate offers</h2><p style="color:var(--dim);margin:16px 0 24px;">Join thousands of affiliates</p><a href="/login" class="btn" style="font-size:18px;padding:14px 32px;">Get Started</a></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;margin:40px 0;"><div class="card" style="text-align:center;"><div style="font-size:40px;">💰</div><h3>Premium Offers</h3><p style="color:var(--dim);">Access exclusive campaigns</p></div><div class="card" style="text-align:center;"><div style="font-size:40px;">📊</div><h3>Analytics Dashboard</h3><p style="color:var(--dim);">See your performance</p></div><div class="card" style="text-align:center;"><div style="font-size:40px;">🚀</div><h3>Fast Payouts</h3><p style="color:var(--dim);">Paid biweekly via USDT</p></div></div><div class="card" style="text-align:center;padding:40px;"><h2>Ready to start earning?</h2><p style="color:var(--dim);margin:16px 0 24px;">Join now</p><a href="/signup" class="btn">Create New Account</a></div>`));
});

// rest of original file
app.listen(PORT, () => console.log(`OfferRevenue running on port ${PORT}`));
