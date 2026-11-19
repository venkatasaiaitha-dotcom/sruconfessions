const fs = require('fs');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');

let dbDriver = null; // 'mysql', 'sqlite', or 'memory'
let mysqlPool = null;
let sqliteDb = null;
let memoryStore = {
    confessions: [],
    admins: [],
    nextConfessionId: 1,
    nextAdminId: 1
};

// Safe writable directory for local or serverless (Vercel / AWS / Render)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
const dataDir = isServerless ? path.join(os.tmpdir(), 'sru_confessions') : path.join(__dirname, 'data');

// ====================================================================
// 1. IN-MEMORY / JSON FALLBACK (Always Works Anywhere)
// ====================================================================
function initMemoryStore() {
    dbDriver = 'memory';
    console.log('[Database] Using in-memory fallback store.');
}

// ====================================================================
// 2. SQLITE IMPLEMENTATION (Zero-config persistent mode)
// ====================================================================
function initSqlite() {
    try {
        const { DatabaseSync } = require('node:sqlite');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        const dbPath = path.join(dataDir, 'confessions.db');
        sqliteDb = new DatabaseSync(dbPath);
        sqliteDb.exec('PRAGMA journal_mode = WAL;');
        sqliteDb.exec('PRAGMA foreign_keys = ON;');

        sqliteDb.exec(`
            CREATE TABLE IF NOT EXISTS confessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                confession TEXT NOT NULL,
                status TEXT DEFAULT 'approved',
                ip_hash TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        dbDriver = 'sqlite';
        console.log(`[Database] Using SQLite storage (${dbPath}).`);
    } catch (err) {
        console.warn(`[Database] SQLite initialization skipped (${err.message}). Using in-memory fallback.`);
        initMemoryStore();
    }
}

// ====================================================================
// 3. MYSQL IMPLEMENTATION (MySQL Workbench / Cloud MySQL)
// ====================================================================
async function initMysql() {
    if (mysqlPool) return; // already initialized
    const mysql = require('mysql2/promise');

    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT, 10) || 3306;
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';
    const database = process.env.DB_NAME || 'sru_confessions';

    // Step 1: Connect to server without database to create DB if needed
    try {
        const rootConn = await mysql.createConnection({ host, port, user, password, connectTimeout: 3000 });
        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await rootConn.end();
    } catch (connErr) {
        throw new Error(`MySQL Connection Error: ${connErr.message}`);
    }

    // Step 2: Create connection pool for the confessions database
    mysqlPool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4',
        connectTimeout: 3000
    });

    // Test connection
    const testConn = await mysqlPool.getConnection();
    testConn.release();

    // Step 3: Ensure tables exist
    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`confessions\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`confession\` TEXT NOT NULL,
            \`status\` ENUM('approved', 'flagged', 'archived') NOT NULL DEFAULT 'approved',
            \`ip_hash\` VARCHAR(64) NULL,
            \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX \`idx_created_at\` (\`created_at\`),
            INDEX \`idx_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`admins\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`username\` VARCHAR(50) NOT NULL UNIQUE,
            \`password_hash\` VARCHAR(255) NOT NULL,
            \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    dbDriver = 'mysql';
    console.log(`✅ [Database] Successfully connected to MySQL server (${host}:${port}/${database}).`);
}

// ====================================================================
// INITIALIZATION ROUTINE (Mutex protected)
// ====================================================================
let isInitialized = false;
let initPromise = null;

async function initDb() {
    if (isInitialized) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        const preference = (process.env.DB_TYPE || 'mysql').toLowerCase();

        if (preference === 'mysql' && process.env.DB_PASSWORD) {
            try {
                await initMysql();
                await seedAdmin();
                isInitialized = true;
                return;
            } catch (err) {
                console.warn('⚠️  Could not connect to MySQL Server:', err.message);
                console.warn('👉 Falling back to local storage engine.');
            }
        }

        initSqlite();
        await seedAdmin();
        isInitialized = true;
    })();

    return initPromise;
}

// Seed default admin
async function seedAdmin() {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'sru2024';

    const existing = await dbService.getAdminByUsername(adminUser);
    if (!existing) {
        const hash = bcrypt.hashSync(adminPass, 10);
        if (dbDriver === 'mysql' && mysqlPool) {
            await mysqlPool.execute('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [adminUser, hash]);
        } else if (dbDriver === 'sqlite' && sqliteDb) {
            const stmt = sqliteDb.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)');
            stmt.run(adminUser, hash);
        } else {
            memoryStore.admins.push({
                id: memoryStore.nextAdminId++,
                username: adminUser,
                password_hash: hash,
                created_at: new Date().toISOString()
            });
        }
        console.log(`[Database] Seeded initial admin account "${adminUser}".`);
    }
}

// ====================================================================
// UNIFIED DATABASE SERVICES
// ====================================================================
const dbService = {
    // Add Confession
    async createConfession(confession, ipHash = null) {
        await initDb();

        if (dbDriver === 'mysql' && mysqlPool) {
            const [result] = await mysqlPool.execute(
                'INSERT INTO confessions (confession, ip_hash) VALUES (?, ?)',
                [confession, ipHash]
            );
            return await this.getConfessionById(result.insertId);
        } else if (dbDriver === 'sqlite' && sqliteDb) {
            const stmt = sqliteDb.prepare('INSERT INTO confessions (confession, ip_hash) VALUES (?, ?)');
            const result = stmt.run(confession, ipHash);
            return await this.getConfessionById(result.lastInsertRowid);
        } else {
            const item = {
                id: memoryStore.nextConfessionId++,
                confession,
                status: 'approved',
                ip_hash: ipHash,
                created_at: new Date().toISOString()
            };
            memoryStore.confessions.push(item);
            return item;
        }
    },

    // Get Confessions List
    async getConfessions({ limit = 100, offset = 0, search = '' } = {}) {
        await initDb();
        limit = Number(limit) || 100;
        offset = Number(offset) || 0;

        if (dbDriver === 'mysql' && mysqlPool) {
            if (search) {
                const [rows] = await mysqlPool.query(
                    `SELECT id, confession, created_at, status 
                     FROM confessions 
                     WHERE confession LIKE ? 
                     ORDER BY id DESC 
                     LIMIT ? OFFSET ?`,
                    [`%${search}%`, limit, offset]
                );
                return rows;
            }
            const [rows] = await mysqlPool.query(
                `SELECT id, confession, created_at, status 
                 FROM confessions 
                 ORDER BY id DESC 
                 LIMIT ? OFFSET ?`,
                [limit, offset]
            );
            return rows;
        } else if (dbDriver === 'sqlite' && sqliteDb) {
            if (search) {
                const stmt = sqliteDb.prepare(`
                    SELECT id, confession, created_at, status 
                    FROM confessions 
                    WHERE confession LIKE ? 
                    ORDER BY id DESC 
                    LIMIT ? OFFSET ?
                `);
                return stmt.all(`%${search}%`, limit, offset);
            }
            const stmt = sqliteDb.prepare(`
                SELECT id, confession, created_at, status 
                FROM confessions 
                ORDER BY id DESC 
                LIMIT ? OFFSET ?
            `);
            return stmt.all(limit, offset);
        } else {
            let list = memoryStore.confessions;
            if (search) {
                list = list.filter(c => c.confession.toLowerCase().includes(search.toLowerCase()));
            }
            list = [...list].sort((a, b) => b.id - a.id);
            return list.slice(offset, offset + limit);
        }
    },

    // Get Confession by ID
    async getConfessionById(id) {
        await initDb();
        id = Number(id);

        if (dbDriver === 'mysql' && mysqlPool) {
            const [rows] = await mysqlPool.execute(
                'SELECT id, confession, created_at, status FROM confessions WHERE id = ?',
                [id]
            );
            return rows[0] || null;
        } else if (dbDriver === 'sqlite' && sqliteDb) {
            const stmt = sqliteDb.prepare('SELECT id, confession, created_at, status FROM confessions WHERE id = ?');
            return stmt.get(id) || null;
        } else {
            return memoryStore.confessions.find(c => c.id === id) || null;
        }
    },

    // Delete Confession
    async deleteConfession(id) {
        await initDb();
        id = Number(id);

        if (dbDriver === 'mysql' && mysqlPool) {
            const [result] = await mysqlPool.execute('DELETE FROM confessions WHERE id = ?', [id]);
            return result.affectedRows > 0;
        } else if (dbDriver === 'sqlite' && sqliteDb) {
            const stmt = sqliteDb.prepare('DELETE FROM confessions WHERE id = ?');
            const result = stmt.run(id);
            return result.changes > 0;
        } else {
            const initialLen = memoryStore.confessions.length;
            memoryStore.confessions = memoryStore.confessions.filter(c => c.id !== id);
            return memoryStore.confessions.length < initialLen;
        }
    },

    // Count Confessions
    async countConfessions(search = '') {
        await initDb();

        if (dbDriver === 'mysql' && mysqlPool) {
            if (search) {
                const [rows] = await mysqlPool.execute(
                    'SELECT COUNT(*) as count FROM confessions WHERE confession LIKE ?',
                    [`%${search}%`]
                );
                return rows[0]?.count || 0;
            }
            const [rows] = await mysqlPool.execute('SELECT COUNT(*) as count FROM confessions');
            return rows[0]?.count || 0;
        } else if (dbDriver === 'sqlite' && sqliteDb) {
            if (search) {
                const stmt = sqliteDb.prepare('SELECT COUNT(*) as count FROM confessions WHERE confession LIKE ?');
                const row = stmt.get(`%${search}%`);
                return row ? row.count : 0;
            }
            const stmt = sqliteDb.prepare('SELECT COUNT(*) as count FROM confessions');
            const row = stmt.get();
            return row ? row.count : 0;
        } else {
            if (search) {
                return memoryStore.confessions.filter(c => c.confession.toLowerCase().includes(search.toLowerCase())).length;
            }
            return memoryStore.confessions.length;
        }
    },

    // Get Stats
    async getStats() {
        await initDb();

        if (dbDriver === 'mysql' && mysqlPool) {
            const [totalRows] = await mysqlPool.execute('SELECT COUNT(*) as total FROM confessions');
            const [todayRows] = await mysqlPool.execute(
                'SELECT COUNT(*) as today FROM confessions WHERE DATE(created_at) = CURDATE()'
            );
            return {
                total: totalRows[0]?.total || 0,
                today: todayRows[0]?.today || 0
            };
        } else if (dbDriver === 'sqlite' && sqliteDb) {
            const totalStmt = sqliteDb.prepare('SELECT COUNT(*) as total FROM confessions');
            const todayStmt = sqliteDb.prepare(`
                SELECT COUNT(*) as today 
                FROM confessions 
                WHERE date(created_at, 'localtime') = date('now', 'localtime')
            `);
            const total = totalStmt.get()?.total || 0;
            const today = todayStmt.get()?.today || 0;
            return { total, today };
        } else {
            const total = memoryStore.confessions.length;
            const today = memoryStore.confessions.filter(c => {
                const d = new Date(c.created_at);
                const now = new Date();
                return d.toDateString() === now.toDateString();
            }).length;
            return { total, today };
        }
    },

    // Get Admin by Username
    async getAdminByUsername(username) {
        await initDb();

        if (dbDriver === 'mysql' && mysqlPool) {
            const [rows] = await mysqlPool.execute(
                'SELECT id, username, password_hash FROM admins WHERE username = ?',
                [username]
            );
            return rows[0] || null;
        } else if (dbDriver === 'sqlite' && sqliteDb) {
            const stmt = sqliteDb.prepare('SELECT id, username, password_hash FROM admins WHERE username = ?');
            return stmt.get(username) || null;
        } else {
            return memoryStore.admins.find(a => a.username === username) || null;
        }
    },

    // Update Admin Password
    async updateAdminPassword(username, newPasswordHash) {
        await initDb();

        if (dbDriver === 'mysql' && mysqlPool) {
            const [result] = await mysqlPool.execute(
                'UPDATE admins SET password_hash = ? WHERE username = ?',
                [newPasswordHash, username]
            );
            return result.affectedRows > 0;
        } else if (dbDriver === 'sqlite' && sqliteDb) {
            const stmt = sqliteDb.prepare('UPDATE admins SET password_hash = ? WHERE username = ?');
            const result = stmt.run(newPasswordHash, username);
            return result.changes > 0;
        } else {
            const admin = memoryStore.admins.find(a => a.username === username);
            if (admin) {
                admin.password_hash = newPasswordHash;
                return true;
            }
            return false;
        }
    },

    getDriver() {
        return dbDriver;
    }
};

module.exports = {
    initDb,
    seedAdmin,
    ...dbService
};
