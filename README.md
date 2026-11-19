# 💬 SRU Confessions - Full Stack Web Application with Supabase

An anonymous confession platform for SRU students built with **Node.js**, **Express**, and **Supabase (Cloud PostgreSQL)**.

---

## ⚡ Supabase Setup Guide (Takes 2 Minutes)

### Step 1: Create a Free Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in with GitHub.
2. Click **"New project"**.
3. Choose a name (e.g. `sru-confessions`), set a database password, and click **"Create new project"**.

---

### Step 2: Create Tables in Supabase
1. In your Supabase Project Dashboard, click **"SQL Editor"** (terminal icon in the left menu).
2. Click **"+ New query"**.
3. Copy and paste the entire contents of [supabase_schema.sql](file:///c:/Users/AITHA%20VENKATA%20SAI/OneDrive/Desktop/venkata%20sai/sru%20confessions01/supabase_schema.sql) into the editor.
4. Click **"Run"** (or press `Ctrl + Enter`).
5. You will see `Success. No rows returned.`
   - Your `confessions` and `admins` tables are now created with Row Level Security policies!

---

### Step 3: Get Your Supabase API Keys
1. In the Supabase left sidebar, click **Project Settings** (gear icon) ➔ **API**.
2. Copy:
   - **Project URL** (e.g. `https://xyzprojectid.supabase.co`)
   - **Project API Keys** ➔ **`anon` `public`** key (or `service_role` secret key).

---

### Step 4: Add Keys to Netlify (For Live Cloud Deployment)
1. Open your [Netlify Dashboard](https://app.netlify.com).
2. Go to your site ➔ **Site configuration** ➔ **Environment variables**.
3. Click **"Add a variable"**:
   - Key: `SUPABASE_URL` | Value: `your-project-url`
   - Key: `SUPABASE_KEY` | Value: `your-anon-or-service-key`
4. Click **Save**.
5. Go to the **Deploys** tab ➔ **Trigger deploy** ➔ **Deploy site**.

---

### Step 5: Add Keys to `.env` (For Local Development)
Open `.env` in the project root:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-api-key
```

Run locally:
```bash
npm start
```

---

## 📊 Viewing Confessions in Supabase Dashboard

Whenever anyone submits a confession on your site:
1. Open [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **"Table Editor"** (spreadsheet icon on the left).
3. Click on the **`confessions`** table.
4. All submitted confessions will appear live with exact date, time, and content!
