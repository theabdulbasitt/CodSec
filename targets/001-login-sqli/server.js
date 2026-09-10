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

// A plain login form, so the app is explorable by hand in a browser too.
app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<meta charset="utf-8"><title>Acme Login</title>
<h1>Acme Internal — Sign in</h1>
<form method="POST" action="/login">
  <p><label>Username <input name="username"></label></p>
  <p><label>Password <input name="password" type="password"></label></p>
  <p><button type="submit">Sign in</button></p>
</form>`);
});

// The vulnerable endpoint. Fields are concatenated straight into the SQL.
app.post('/login', (req, res) => {
    const username = req.body.username ?? '';
    const password = req.body.password ?? '';

    const sql =
        `SELECT id, username FROM users ` +
        `WHERE username = '${username}' AND password = '${password}'`;

    try {
        const row = db.prepare(sql).get();
        if (row) {
            // `row.username` is reflected back — the UNION exfiltration channel.
            return res.type('html').send(`<p>Welcome back, ${row.username}!</p>`);
        }
        return res.status(401).type('html').send('<p>Invalid credentials.</p>');
    } catch (err) {
        // Verbose errors ON — a realistic misconfig, and the channel an attacker
        // uses to fingerprint the database engine.
        return res.status(500).type('html').send(`<pre>DB error: ${err.message}</pre>`);
    }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`target-001 listening on :${PORT}`));