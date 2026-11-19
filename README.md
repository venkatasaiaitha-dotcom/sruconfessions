# 💬 SRU Confessions - Full Stack Web Application & MySQL Database

A secure, anonymous confession platform for SRU students built with **Node.js**, **Express**, and **MySQL** (with **MySQL Workbench** integration).

---

## 🐬 MySQL Database & MySQL Workbench Setup

### Step 1: Open and Run the Database Script in MySQL Workbench
1. Open **MySQL Workbench** on your machine.
2. Click on your local MySQL connection (e.g. `Local instance MySQL80` or `root@localhost:3306`) and log in.
3. In the top menu, go to:
   **File** ➔ **Open SQL Script...** (or press `Ctrl + Shift + O`).
4. Select the file:
   `schema.sql` located inside the project folder:
   `c:\Users\AITHA VENKATA SAI\OneDrive\Desktop\venkata sai\sru confessions01\schema.sql`
5. Click the **⚡ Lightning Bolt (Execute)** button in the query toolbar (or press `Ctrl + Shift + Enter`).
6. In the bottom "Output" panel, you will see green checkmarks:
   - Database `sru_confessions` created.
   - Tables `confessions` and `admins` created.
   - Initial admin account (`admin` / `sru2024`) seeded.
   - Sample confessions inserted for testing.

---

### Step 2: Connect the Node.js Backend to MySQL
Open the `.env` file in the project folder and set your MySQL Workbench password:

```env
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=sru_confessions
```

> **Note:** If `DB_PASSWORD` is not configured or MySQL is unreachable, the server will automatically fall back to the built-in local SQLite database so the app never crashes.

---

## 🔍 Useful Queries in MySQL Workbench

Once you execute `schema.sql`, you can open a new Query tab (`Ctrl + T`) in MySQL Workbench and run these queries:

### 1. View all confessions (newest first)
```sql
USE sru_confessions;
SELECT id, confession, status, created_at FROM confessions ORDER BY id DESC;
```

### 2. View confession statistics (Total and Today)
```sql
SELECT 
    COUNT(*) AS total_confessions,
    COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) AS today_confessions
FROM confessions;
```

### 3. Search confessions by keyword
```sql
SELECT * FROM confessions WHERE confession LIKE '%library%' ORDER BY id DESC;
```

### 4. Delete an inappropriate confession
```sql
DELETE FROM confessions WHERE id = 1;
```

---

## 📁 Project Architecture

```
sru confessions01/
├── schema.sql             # MySQL Workbench SQL script (creates DB, tables, seeds data)
├── server.js              # Express web server & API router
├── db.js                  # Unified database adapter (MySQL & SQLite fallback)
├── middleware/
│   ├── auth.js            # JWT admin verification middleware
│   └── rateLimiter.js     # Anti-spam & brute force protection
├── routes/
│   ├── confessions.js     # Public submission endpoint (POST /api/confessions)
│   ├── auth.js            # Admin login, session verify, password change
│   └── admin.js           # Admin moderation & confession deletion
├── public/                # Static frontend assets served by Express
│   ├── index.html         # User view, Admin view, & Login modal
│   ├── css/
│   │   └── style.css      # Responsive styles & modern UI
│   └── js/
│       └── script.js      # Frontend API integration & state management
├── .env                   # Configuration file (MySQL credentials, JWT secret)
├── .env.example           # Example configuration template
├── package.json           # Dependencies and scripts
└── README.md              # Full documentation
```

---

## 🚀 Running the Project

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
*(or run `npm run dev` for auto-reloading development mode)*

Open your browser and visit:
👉 **http://localhost:5000**

---

## 🔑 Default Admin Credentials

- **Username**: `admin`
- **Password**: `sru2024`

*(Hashed securely with bcrypt in the `admins` table)*

---

## 📡 API Reference

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/confessions` | Public | Submit an anonymous confession |
| `POST` | `/api/auth/login` | Public | Admin login, returns JWT token |
| `GET` | `/api/auth/verify` | Admin | Validate current JWT session |
| `GET` | `/api/admin/confessions` | Admin | List confessions (with `?search=` and pagination) |
| `DELETE` | `/api/admin/confessions/:id` | Admin | Delete a confession by ID |
| `GET` | `/api/admin/stats` | Admin | Confession count statistics |
| `GET` | `/api/health` | Public | Server uptime & active database engine |
