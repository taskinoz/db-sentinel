-- Table for storing database credentials
CREATE TABLE IF NOT EXISTS credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('postgres', 'mysql')) NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    database_name TEXT NOT NULL
);

-- Table for storing backup logs
CREATE TABLE IF NOT EXISTS backup_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    credential_id INTEGER NOT NULL,
    backup_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    backup_size INTEGER,
    FOREIGN KEY (credential_id) REFERENCES credentials(id)
);
