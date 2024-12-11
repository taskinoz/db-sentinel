const express = require('express');
const Database = require('better-sqlite3');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

// Initialize the app
const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure the dumps directory exists
const dumpsDir = path.join(__dirname, 'dumps');
if (!fs.existsSync(dumpsDir)) {
    fs.mkdirSync(dumpsDir);
}

// Open or create the database file
const db = new Database(':memory:', { verbose: console.log });

// Run SQL initialization
try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            host TEXT NOT NULL,
            port INTEGER NOT NULL,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            database_name TEXT NOT NULL
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS backup_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            credential_id INTEGER NOT NULL,
            backup_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            backup_size INTEGER,
            FOREIGN KEY (credential_id) REFERENCES credentials(id)
        )
    `).run();
} catch (error) {
    console.error(`Error initializing database: ${error.message}`);
}

// Backup function
const backupDatabase = (credential) => {
    const { id, type, host, port, username, password, database_name } = credential;
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
    const backupFile = path.join(dumpsDir, `${database_name}_${timestamp}.sql`);

    let cmd;
    if (type === 'postgres') {
        cmd = `PGPASSWORD='${password}' pg_dump -h ${host} -p ${port} -U ${username} ${database_name}`;
    } else if (type === 'mysql') {
        cmd = `mysqldump -h ${host} -P ${port} -u ${username} -p${password} ${database_name}`;
    }

    if (cmd) {
        exec(cmd, { maxBuffer: 1024 * 500 }, (error, stdout) => {
            if (error) {
                console.error(`Backup failed for ${database_name}: ${error.message}`);
                return;
            }
            // Check if the dump has content
            if (stdout.trim()) {
                fs.writeFileSync(backupFile, stdout);
                const size = fs.statSync(backupFile).size;
                db.prepare(`INSERT INTO backup_logs (credential_id, backup_size) VALUES (?, ?)`).run(id, size);
            } else {
                console.error(`No data found in ${database_name}, skipping file creation.`);
            }
        });
    }
};

// Schedule backups (runs daily at 2 AM)
cron.schedule('0 2 * * *', () => {
    try {
        const credentials = db.prepare(`SELECT * FROM credentials`).all();
        credentials.forEach(backupDatabase);
    } catch (error) {
        console.error(`Error fetching credentials: ${error.message}`);
    }
});

// Routes
app.get('/', (req, res) => {
    try {
        const data = db.prepare(`
            SELECT c.name, c.type, c.database_name, 
                   MAX(b.backup_time) AS last_backup, 
                   SUM(b.backup_size) AS total_size
            FROM credentials c
            LEFT JOIN backup_logs b ON c.id = b.credential_id
            GROUP BY c.id
        `).all();

        // Gather backups for each database
        const backups = {};
        const files = fs.readdirSync(dumpsDir); // Read all files in the dumps directory
        data.forEach((row) => {
            backups[row.database_name] = files
                .filter(file => file.startsWith(`${row.database_name}_`)) // Match files for the database
                .map(file => file.replace(`${row.database_name}_`, '').replace('.sql', '')); // Extract the date part
        });

        res.render('index', { data, backups });
    } catch (error) {
        res.status(500).send(`Error fetching data: ${error.message}`);
    }
});

app.get('/add', (req, res) => {
    res.render('add');
});

app.post('/add', (req, res) => {
    const { name, type, host, port, username, password, database_name, connection_url } = req.body;
    try {
        if (connection_url) {
            const parsed = new URL(connection_url);
            db.prepare(`
                INSERT INTO credentials (name, type, host, port, username, password, database_name) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(name, parsed.protocol.replace(':', ''), parsed.hostname, parsed.port || 5432, parsed.username, parsed.password, parsed.pathname.replace('/', ''));
        } else {
            db.prepare(`
                INSERT INTO credentials (name, type, host, port, username, password, database_name) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(name, type, host, port, username, password, database_name);
        }
        res.redirect('/');
    } catch (error) {
        res.status(500).send(`Error adding database: ${error.message}`);
    }
});


app.post('/download', (req, res) => {
    const { db_name, date } = req.body;
    const filePath = path.join(dumpsDir, `${db_name}_${date}.sql`);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('Backup not found');
    }
});

app.post('/backup-now', (req, res) => {
    const { db_name } = req.body;
    const credential = db.prepare('SELECT * FROM credentials WHERE database_name = ?').get(db_name);
    if (!credential) {
        return res.status(404).send('Database credential not found');
    }
    backupDatabase(credential);
    res.send('Backup started');
});

app.post('/restore', (req, res) => {
    const { db_name, date } = req.body;
    const filePath = path.join(dumpsDir, `${db_name}_${date}.sql`);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Backup file not found');
    }

    const credential = db.prepare('SELECT * FROM credentials WHERE database_name = ?').get(db_name);
    if (!credential) {
        return res.status(404).send('Database credential not found');
    }

    let cmd;
    if (credential.type === 'postgres') {
        cmd = `PGPASSWORD='${credential.password}' psql -h ${credential.host} -p ${credential.port} -U ${credential.username} -d ${credential.database_name} < ${filePath}`;
    } else if (credential.type === 'mysql') {
        cmd = `mysql -h ${credential.host} -P ${credential.port} -u ${credential.username} -p${credential.password} ${credential.database_name} < ${filePath}`;
    }

    exec(cmd, (error) => {
        if (error) {
            console.error(`Restore failed for ${db_name}: ${error.message}`);
            return res.status(500).send('Restore failed');
        }
        res.send('Restore successful');
    });
});

// Start the server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
