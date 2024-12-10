const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const cron = require('node-cron');
const path = require('path');

// Initialize the app
const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database('./backup_manager.db');

// Run SQL initialization
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT CHECK(type IN ('postgres', 'mysql')) NOT NULL,
            host TEXT NOT NULL,
            port INTEGER NOT NULL,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            database_name TEXT NOT NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS backup_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            credential_id INTEGER NOT NULL,
            backup_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            backup_size INTEGER,
            FOREIGN KEY (credential_id) REFERENCES credentials(id)
        )
    `);
});

// Backup function
const backupDatabase = (credential) => {
    const { id, type, host, port, username, password, database_name } = credential;
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
    const backupFile = path.join(__dirname, 'dumps', `${database_name}_${timestamp}.sql`);

    let cmd;
    if (type === 'postgres') {
        cmd = `PGPASSWORD=${password} pg_dump -h ${host} -p ${port} -U ${username} ${database_name} > ${backupFile}`;
    } else if (type === 'mysql') {
        cmd = `mysqldump -h ${host} -P ${port} -u ${username} -p${password} ${database_name} > ${backupFile}`;
    }

    if (cmd) {
        exec(cmd, (error) => {
            if (error) {
                console.error(`Backup failed for ${database_name}: ${error.message}`);
            } else {
                const size = require('fs').statSync(backupFile).size;
                db.run(
                    `INSERT INTO backup_logs (credential_id, backup_size) VALUES (?, ?)`,
                    [id, size],
                    (err) => {
                        if (err) console.error(`Error logging backup: ${err.message}`);
                    }
                );
            }
        });
    }
};

// Schedule backups (runs daily at 2 AM)
cron.schedule('0 2 * * *', () => {
    db.all(`SELECT * FROM credentials`, (err, rows) => {
        if (err) {
            console.error(`Error fetching credentials: ${err.message}`);
        } else {
            rows.forEach(backupDatabase);
        }
    });
});

// Routes
app.get('/', (req, res) => {
    db.all(`
        SELECT c.name, c.type, c.database_name, 
               MAX(b.backup_time) AS last_backup, 
               SUM(b.backup_size) AS total_size
        FROM credentials c
        LEFT JOIN backup_logs b ON c.id = b.credential_id
        GROUP BY c.id
    `, (err, rows) => {
        if (err) {
            res.status(500).send(`Error fetching data: ${err.message}`);
        } else {
            res.render('index', { data: rows });
        }
    });
});

app.get('/add', (req, res) => {
    res.render('add');
});

app.post('/add', (req, res) => {
    const { name, type, host, port, username, password, database_name } = req.body;
    db.run(
        `INSERT INTO credentials (name, type, host, port, username, password, database_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, type, host, port, username, password, database_name],
        (err) => {
            if (err) {
                res.status(500).send(`Error adding database: ${err.message}`);
            } else {
                res.redirect('/');
            }
        }
    );
});

// Start the server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
