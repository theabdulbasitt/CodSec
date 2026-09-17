import express from 'express';
import { DatabaseSync } from 'node:sqlite';

const PORT = process.env.PORT || 8001;
const FLAG = process.env.FLAG || 'CODSEC{un10n_b4sed_sql1_pwn}';

// In-memory DB, re-seeded fresh every start. node:sqlite = Node's built-in
// SQLite (22.5+), so there is no native build step.
const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT);
  CREATE TABLE secrets (id INTEGER PRIMARY KEY, flag TEXT);
  INSERT INTO users (username, password) VALUES ('alice', 'wonderland'), ('bob', 'builder');
  INSERT INTO secrets (flag) VALUES ('${FLAG}');
`);

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Navigation header for all pages
const nav = `
<nav style="margin-bottom: 20px; padding: 10px; background: #f0f0f0;">
  <a href="/">Home</a> |
  <a href="/login">Sign In</a> |
  <a href="/search">Search Products</a> |
  <a href="/products">Catalog</a> |
  <a href="/feedback">Contact Us</a> |
  <a href="/about">About</a> |
  <a href="/admin">Admin Portal</a>
</nav>
`;

// Home Page
app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<meta charset="utf-8"><title>Acme Corp — Internal Portal</title>
${nav}
<h1>Acme Corporation Internal Systems</h1>
<p>Welcome to Acme Corp's internal web portal. Use the navigation bar above to explore resources.</p>
<ul>
  <li><a href="/login">Employee Login</a></li>
  <li><a href="/search">Search Inventory</a></li>
  <li><a href="/products">Product Catalog</a></li>
  <li><a href="/feedback">Support / Feedback</a></li>
</ul>`);
});

// Login Page (GET) & Handler (POST) - Vulnerable to SQLi
app.get('/login', (_req, res) => {
    res.type('html').send(`<!doctype html>
<meta charset="utf-8"><title>Acme Login</title>
${nav}
<h1>Acme Internal — Sign in</h1>
<form method="POST" action="/login">
  <p><label>Username <input name="username"></label></p>
  <p><label>Password <input name="password" type="password"></label></p>
  <p><button type="submit">Sign in</button></p>
</form>`);
});

app.post('/login', (req, res) => {
    const username = req.body.username ?? '';
    const password = req.body.password ?? '';

    const sql =
        `SELECT id, username FROM users ` +
        `WHERE username = '${username}' AND password = '${password}'`;

    try {
        const row = db.prepare(sql).get();
        if (row) {
            return res.type('html').send(`${nav}<p>Welcome back, ${row.username}!</p>`);
        }
        return res.status(401).type('html').send(`${nav}<p>Invalid credentials.</p>`);
    } catch (err) {
        return res.status(500).type('html').send(`${nav}<pre>DB error: ${err.message}</pre>`);
    }
});

// Search Page & Endpoint (GET with query params)
app.get('/search', (req, res) => {
    const q = req.query.q ? String(req.query.q) : '';
    res.type('html').send(`<!doctype html>
<meta charset="utf-8"><title>Search Catalog</title>
${nav}
<h1>Search Products</h1>
<form method="GET" action="/search">
  <p><label>Search query: <input name="q" value="${q}"></label></p>
  <p><button type="submit">Search</button></p>
</form>
${q ? `<p>Results for "<strong>${q}</strong>": No items found matching this query.</p>` : ''}
`);
});

// Product Catalog
app.get('/products', (req, res) => {
    const category = req.query.category ?? 'all';
    res.type('html').send(`<!doctype html>
<meta charset="utf-8"><title>Product Catalog</title>
${nav}
<h1>Catalog (Category: ${category})</h1>
<ul>
  <li>Anvil - Heavy Duty (SKU-1001)</li>
  <li>Giant Rubber Band (SKU-1002)</li>
  <li>Dehydrated Boulders (SKU-1003)</li>
</ul>
<p>Filter by: <a href="/products?category=tools">Tools</a> | <a href="/products?category=traps">Traps</a> | <a href="/products">All</a></p>
`);
});

// Feedback / Contact Form (POST)
app.get('/feedback', (_req, res) => {
    res.type('html').send(`<!doctype html>
<meta charset="utf-8"><title>Customer Feedback</title>
${nav}
<h1>Send Us Feedback</h1>
<form method="POST" action="/feedback">
  <p><label>Your Email: <input name="email" type="email"></label></p>
  <p><label>Comments: <textarea name="message"></textarea></label></p>
  <p><button type="submit">Submit Feedback</button></p>
</form>
`);
});

app.post('/feedback', (req, res) => {
    const email = req.body.email ?? '';
    res.type('html').send(`<!doctype html>
<meta charset="utf-8"><title>Feedback Received</title>
${nav}
<h1>Thank You</h1>
<p>Thank you, your feedback from ${email || 'anonymous'} has been received.</p>
<p><a href="/">Return Home</a></p>
`);
});

// Static Info Page
app.get('/about', (_req, res) => {
    res.type('html').send(`<!doctype html>
<meta charset="utf-8"><title>About Acme</title>
${nav}
<h1>About Acme Corporation</h1>
<p>Providing high quality coyote defense products since 1949.</p>
<p><a href="/">Back to Home</a></p>
`);
});

// Protected / Admin Page
app.get('/admin', (_req, res) => {
    res.status(403).type('html').send(`<!doctype html>
<meta charset="utf-8"><title>Admin Portal</title>
${nav}
<h1>403 Forbidden</h1>
<p>Access denied. Administrator privileges required.</p>
`);
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`target-001 listening on :${PORT}`));