const bcrypt = require('bcryptjs');

let dbDriver = 'memory'; // 'supabase' or 'memory'
let supabaseClient = null;

let memoryStore = {
    confessions: [],
    admins: [],
    nextConfessionId: 1,
    nextAdminId: 1
};

// ====================================================================
// 1. SUPABASE CLIENT INITIALIZATION
// ====================================================================
function initSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_project_url' && !supabaseUrl.includes('EXAMPLE_KEY')) {
        try {
            const { createClient } = require('@supabase/supabase-js');
            supabaseClient = createClient(supabaseUrl.trim(), supabaseKey.trim(), {
                auth: {
                    persistSession: false
                }
            });
            dbDriver = 'supabase';
            console.log(`✅ [Database] Initialized Supabase client for (${supabaseUrl}).`);
            return true;
        } catch (err) {
            console.error('[Database] Failed to initialize Supabase client:', err.message);
            return false;
        }
    }

    return false;
}

// ====================================================================
// 2. INITIALIZATION ROUTINE
// ====================================================================
let isInitialized = false;

async function initDb() {
    if (isInitialized) return;

    const connected = initSupabase();
    if (!connected) {
        dbDriver = 'memory';
        console.log('⚠️ [Database] SUPABASE_URL / SUPABASE_KEY not configured in .env yet.');
    }

    await seedAdmin();
    isInitialized = true;
}

// Seed default admin
async function seedAdmin() {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'sru2024';

    try {
        if (dbDriver === 'supabase' && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('admins')
                .select('id')
                .eq('username', adminUser)
                .maybeSingle();

            if (!error && !data) {
                const hash = bcrypt.hashSync(adminPass, 10);
                await supabaseClient.from('admins').insert([
                    { username: adminUser, password_hash: hash }
                ]);
                console.log(`[Database] Seeded initial admin account "${adminUser}" in Supabase.`);
            }
        } else {
            const existing = memoryStore.admins.find(a => a.username === adminUser);
            if (!existing) {
                const hash = bcrypt.hashSync(adminPass, 10);
                memoryStore.admins.push({
                    id: memoryStore.nextAdminId++,
                    username: adminUser,
                    password_hash: hash,
                    created_at: new Date().toISOString()
                });
                console.log(`[Database] Seeded initial admin account "${adminUser}" in memory store.`);
            }
        }
    } catch (err) {
        console.warn('[Database] Seed admin check skipped:', err.message);
    }
}

// ====================================================================
// 3. UNIFIED DATABASE SERVICES & STORAGE BUCKET INTEGRATION
// ====================================================================
const dbService = {
    // Helper: Upload confession text and JSON to Supabase Storage Bucket
    async saveConfessionToBucket(item) {
        if (!supabaseClient || !item || !item.id) return;
        try {
            // 1. Upload Readable Plain Text File (.txt)
            const txtFileName = `confession_${item.id}.txt`;
            const txtContent = `CONFESSION #${item.id}\nDate: ${item.created_at}\nStatus: ${item.status || 'approved'}\n----------------------------------------\n${item.confession}\n`;
            
            await supabaseClient.storage
                .from('confessions')
                .upload(txtFileName, txtContent, {
                    contentType: 'text/plain; charset=utf-8',
                    upsert: true
                });

            // 2. Upload Structured JSON File (.json)
            const jsonFileName = `confession_${item.id}.json`;
            const jsonBody = JSON.stringify(item, null, 2);
            await supabaseClient.storage
                .from('confessions')
                .upload(jsonFileName, jsonBody, {
                    contentType: 'application/json',
                    upsert: true
                });
        } catch (err) {
            console.warn('[Storage Bucket] Could not upload to bucket:', err.message);
        }
    },

    // Helper: Remove confession files from Supabase Storage Bucket
    async deleteConfessionFromBucket(id) {
        if (!supabaseClient || !id) return;
        try {
            await supabaseClient.storage
                .from('confessions')
                .remove([`confession_${id}.txt`, `confession_${id}.json`]);
        } catch (err) {
            console.warn('[Storage Bucket] Could not delete from bucket:', err.message);
        }
    },

    // Add Confession
    async createConfession(confession, ipHash = null) {
        await initDb();

        if (dbDriver === 'supabase' && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('confessions')
                .insert([{ confession, ip_hash: ipHash }])
                .select('id, confession, created_at, status');

            if (error) {
                console.error('[Supabase Insert Error]:', error);
                throw new Error(`Supabase Error: ${error.message}${error.hint ? ' - ' + error.hint : ''}. Please run the SQL permissions in the Supabase SQL Editor.`);
            }

            const item = (data && data.length > 0) ? data[0] : {
                id: Date.now(),
                confession,
                status: 'approved',
                created_at: new Date().toISOString()
            };

            // Store copies in Supabase Storage Bucket (.txt and .json)
            this.saveConfessionToBucket(item).catch(() => {});

            return item;
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

        if (dbDriver === 'supabase' && supabaseClient) {
            let query = supabaseClient
                .from('confessions')
                .select('id, confession, created_at, status')
                .order('id', { ascending: false })
                .range(offset, offset + limit - 1);

            if (search) {
                query = query.ilike('confession', `%${search}%`);
            }

            const { data, error } = await query;
            if (error) throw new Error(`Supabase Query Error: ${error.message}`);
            return data || [];
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

        if (dbDriver === 'supabase' && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('confessions')
                .select('id, confession, created_at, status')
                .eq('id', id)
                .maybeSingle();

            if (error) throw new Error(`Supabase Error: ${error.message}`);
            return data;
        } else {
            return memoryStore.confessions.find(c => c.id === id) || null;
        }
    },

    // Delete Confession
    async deleteConfession(id) {
        await initDb();
        id = Number(id);

        if (dbDriver === 'supabase' && supabaseClient) {
            // Remove from bucket if present
            this.deleteConfessionFromBucket(id).catch(() => {});

            const { error } = await supabaseClient
                .from('confessions')
                .delete()
                .eq('id', id);

            if (error) throw new Error(`Supabase Delete Error: ${error.message}`);
            return true;
        } else {
            const initialLen = memoryStore.confessions.length;
            memoryStore.confessions = memoryStore.confessions.filter(c => c.id !== id);
            return memoryStore.confessions.length < initialLen;
        }
    },

    // Count Confessions
    async countConfessions(search = '') {
        await initDb();

        if (dbDriver === 'supabase' && supabaseClient) {
            let query = supabaseClient
                .from('confessions')
                .select('*', { count: 'exact', head: true });

            if (search) {
                query = query.ilike('confession', `%${search}%`);
            }

            const { count, error } = await query;
            if (error) return 0;
            return count || 0;
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

        if (dbDriver === 'supabase' && supabaseClient) {
            const total = await this.countConfessions();
            
            const todayStart = new Date();
            todayStart.setUTCHours(0, 0, 0, 0);

            const { count: todayCount } = await supabaseClient
                .from('confessions')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', todayStart.toISOString());

            return {
                total,
                today: todayCount || 0
            };
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

        if (dbDriver === 'supabase' && supabaseClient) {
            const { data } = await supabaseClient
                .from('admins')
                .select('id, username, password_hash')
                .eq('username', username)
                .maybeSingle();

            return data || null;
        } else {
            return memoryStore.admins.find(a => a.username === username) || null;
        }
    },

    // Update Admin Password
    async updateAdminPassword(username, newPasswordHash) {
        await initDb();

        if (dbDriver === 'supabase' && supabaseClient) {
            const { error } = await supabaseClient
                .from('admins')
                .update({ password_hash: newPasswordHash })
                .eq('username', username);

            return !error;
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
