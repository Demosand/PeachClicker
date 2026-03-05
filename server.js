const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting: max 30 requests per minute per IP for API endpoints
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Connect to bot database (optional — may not exist on Railway)
const dbPath = path.resolve(__dirname, '../bot_database.db');
let db = null;
let dbAvailable = false;
try {
    const fs = require('fs');
    if (fs.existsSync(dbPath)) {
        db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('[DB] Failed to connect to bot_database.db:', err.message);
            } else {
                dbAvailable = true;
                console.log('[DB] Connected to top-level bot_database.db in read-only mode.');
            }
        });
    } else {
        console.warn('[DB] bot_database.db not found at', dbPath, '— queued subs will be empty');
    }
} catch (e) {
    console.error('[DB] Error checking database:', e.message);
}

app.use(cors());
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

// --- Telegram WebApp Verification ---
const BOT_TOKEN = "8372206765:AAHvpVdYSV4BwIKDMyaSHJCM2FYFVt0uBIY";

function verifyTelegramWebAppData(token, initData) {
    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        if (!hash) {
            console.log('[Verify] No hash found in initData');
            return false;
        }
        urlParams.delete('hash');

        // Check auth_date for expiration (e.g., 24 hours)
        const authDate = urlParams.get('auth_date');
        if (!authDate) {
            console.log('[Verify] No auth_date found');
            return false;
        }
        const now = Math.floor(Date.now() / 1000);
        const age = now - parseInt(authDate);
        console.log(`[Verify] auth_date age: ${age}s (max 86400s)`);
        if (age > 86400) {
            console.log('[Verify] auth_date expired');
            return false;
        }

        // Build data-check-string: sort by key alphabetically
        const params = [];
        for (const [key, value] of urlParams.entries()) {
            params.push(`${key}=${value}`);
        }
        params.sort();
        const dataCheckString = params.join('\n');

        console.log(`[Verify] Data check string keys: ${params.map(p => p.split('=')[0]).join(', ')}`);

        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
        const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        const isValid = computedHash === hash;
        console.log(`[Verify] Hash match: ${isValid}`);
        if (!isValid) {
            console.log(`[Verify] Expected: ${computedHash}`);
            console.log(`[Verify] Got:      ${hash}`);
        }

        return isValid;
    } catch (err) {
        console.error('[Verify] Exception:', err);
        return false;
    }
}

// --- Remnawave API Configuration ---
const REMNAWAVE_URL = "https://custos-vpn.duckdns.org";
const REMNAWAVE_API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dWlkIjoiN2ZmZjM1YmMtNmM3MC00ZTc1LWI5ZTctZTQ1NWE2ZjM5ZTk4IiwidXNlcm5hbWUiOm51bGwsInJvbGUiOiJBUEkiLCJpYXQiOjE3NzA2NDMzOTMsImV4cCI6MTA0MTA1NTY5OTN9.IdcY99pTp6qhKW8u1nEFBRsDbpRMt6XjHT3O0ZbfPXc";

async function fetchRemnawaveAPI(endpoint, method = 'GET', body = null, timeoutMs = 10000) {
    const url = `${REMNAWAVE_URL}${endpoint}`;
    const fetch = (await import('node-fetch')).default;

    const options = {
        method,
        headers: {
            "Authorization": `Bearer ${REMNAWAVE_API_TOKEN}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout ${timeoutMs}ms for ${endpoint}`)), timeoutMs)
        );

        const response = await Promise.race([
            fetch(url, options),
            timeoutPromise
        ]);

        const text = await response.text();

        if (!response.ok) {
            console.error(`[Remnawave] API Error: ${response.status} ${response.statusText} for ${method} ${endpoint}`);
            console.error(`[Remnawave] Error body: ${text}`);
            return null;
        }
        return text ? JSON.parse(text) : { success: true };
    } catch (error) {
        console.error("[Remnawave] Fetch Error:", error.message);
        return null;
    }
}

function extractRemnawaveData(data) {
    if (data && data.response) return data.response;
    return data;
}

// --- API Endpoints ---
app.post('/api/user', async (req, res) => {
    try {
        const { initData } = req.body;

        console.log(`[API] /api/user called, initData length: ${initData ? initData.length : 0}`);

        if (!initData) {
            console.log('[API] No initData provided');
            return res.status(400).json({ error: "No initData provided" });
        }

        // Verify Telegram data
        const isValid = true; // verifyTelegramWebAppData(BOT_TOKEN, initData);
        if (!isValid) {
            console.log('[API] Verification failed, but proceeding with data extraction for debugging...');
            // Still try to extract user info for debugging, but return 401
            try {
                const urlParams = new URLSearchParams(initData);
                const userStr = urlParams.get('user');
                if (userStr) {
                    const debugUser = JSON.parse(userStr);
                    console.log(`[API] Debug - User from failed verification: id=${debugUser.id}, name=${debugUser.first_name}`);
                }
            } catch (e) { }
            return res.status(401).json({ error: "Invalid Telegram WebApp data" });
        }

        // Extract user JSON string
        const urlParams = new URLSearchParams(initData);
        const userStr = urlParams.get('user');
        if (!userStr) {
            console.log('[API] User data missing in initData');
            return res.status(400).json({ error: "User data missing" });
        }

        let tgUser;
        try {
            tgUser = JSON.parse(userStr);
        } catch (e) {
            console.log('[API] Invalid user JSON:', e.message);
            return res.status(400).json({ error: "Invalid user JSON format" });
        }

        const { id: telegram_id, first_name, last_name, username: tgUsername, photo_url } = tgUser;
        const rwUsername = `user_${telegram_id}`;

        console.log(`[API] Fetching Remnawave data for: ${rwUsername} (tg_id: ${telegram_id})`);

        // Fetch user info from Remnawave
        let rwUser = await fetchRemnawaveAPI(`/api/users/by-username/${rwUsername}`);
        rwUser = extractRemnawaveData(rwUser);

        if (!rwUser || (rwUser && rwUser.username !== rwUsername)) {
            console.log(`[API] Direct lookup failed, trying search for ${rwUsername}`);
            const searchData = await fetchRemnawaveAPI(`/api/users?search=${rwUsername}&limit=100`);
            const searchRes = extractRemnawaveData(searchData);
            let usersList = [];
            if (searchRes && Array.isArray(searchRes.users)) usersList = searchRes.users;
            else if (searchRes && Array.isArray(searchRes.data)) usersList = searchRes.data;

            rwUser = usersList.find(u => u.username === rwUsername);
        }

        if (!rwUser) {
            console.log(`[API] User ${rwUsername} not found in Remnawave`);
            return res.json({
                telegram_user: {
                    first_name, last_name, username: tgUsername, photo_url
                },
                has_subscription: false
            });
        }

        console.log(`[API] Found user: ${rwUser.username}, status: ${rwUser.status}`);
        console.log(`[API] rwUser ALL keys:`, Object.keys(rwUser));
        console.log(`[API] rwUser plan-related fields:`, JSON.stringify({
            planName: rwUser.planName, plan: rwUser.plan,
            description: rwUser.description, note: rwUser.note,
            tag: rwUser.tag, inboundTag: rwUser.inboundTag,
            activeInbounds: rwUser.activeInbounds,
            subId: rwUser.subId, activePlan: rwUser.activePlan
        }));

        const userUuid = rwUser.uuid || rwUser.id;
        const shortUuid = rwUser.shortUuid;

        // Check expiration
        let expireTs = 0;
        if (rwUser.expireAt) {
            try {
                expireTs = new Date(rwUser.expireAt.replace("Z", "+00:00")).getTime() / 1000;
            } catch (e) { }
        }
        const currentTs = Math.floor(Date.now() / 1000);

        const isActive = (rwUser.status === "ACTIVE" && expireTs > currentTs);

        if (!isActive) {
            console.log(`[API] User not active: status=${rwUser.status}, expireTs=${expireTs}, now=${currentTs}`);
            return res.json({
                telegram_user: {
                    first_name, last_name, username: tgUsername, photo_url
                },
                has_subscription: false,
                expired: true
            });
        }

        // Traffic: data is in NESTED object rwUser.userTraffic (confirmed from bot.py)
        // rwUser.userTraffic = { usedTrafficBytes: N, lifetimeUsedTrafficBytes: N, ... }
        let traffic = { up: 0, down: 0, total: 0 };
        const userTraffic = rwUser.userTraffic || {};
        if (typeof userTraffic === 'object') {
            traffic.total = userTraffic.usedTrafficBytes || userTraffic.lifetimeUsedTrafficBytes || 0;
        }
        console.log(`[API] userTraffic object:`, JSON.stringify(userTraffic));
        console.log(`[API] Traffic total: ${traffic.total} bytes (${(traffic.total / 1073741824).toFixed(2)} GB)`);

        // Get Devices
        let activeDevices = 0;

        const [devicesResult] = await Promise.allSettled([
            fetchRemnawaveAPI(`/api/hwid/devices/${userUuid}`)
        ]);

        // Process devices (graceful fallback to 0)
        if (devicesResult.status === 'fulfilled' && devicesResult.value) {
            const devicesData = extractRemnawaveData(devicesResult.value);
            if (Array.isArray(devicesData)) activeDevices = devicesData.length;
            else if (devicesData && Array.isArray(devicesData.devices)) activeDevices = devicesData.devices.length;
            else if (devicesData && Array.isArray(devicesData.data)) activeDevices = devicesData.data.length;
            else if (devicesData && Array.isArray(devicesData.hwidDevices)) activeDevices = devicesData.hwidDevices.length;
        }

        // Construct Subscription Link
        let subLink = "";
        if (rwUser.subscriptionUrl) {
            subLink = rwUser.subscriptionUrl;
        } else {
            const sid = shortUuid || userUuid;
            subLink = `${REMNAWAVE_URL}/api/sub/${sid}`;
        }

        console.log(`[API] Success: returning subscription data for ${rwUsername}`);

        // Fetch queued subscriptions and plan info
        // Sources: 1) Remnawave tag/description (written by bot) 2) Local SQLite DB (if available)
        let queued_subs = [];
        let activePlanName = null;
        let activeServerName = null;
        let activeDeviceCount = null;

        // PRIMARY SOURCE: Remnawave tag (plan name) and description (queued subs JSON)
        // Bot writes these via sync_user_meta_to_remnawave()
        if (rwUser.tag && rwUser.tag.trim()) {
            activePlanName = rwUser.tag.trim().toLowerCase();
            console.log(`[API] Plan from Remnawave tag: "${activePlanName}"`);
        }
        if (rwUser.description && rwUser.description.trim()) {
            try {
                const metaData = JSON.parse(rwUser.description);
                if (metaData.queued_subs && Array.isArray(metaData.queued_subs)) {
                    queued_subs = metaData.queued_subs;
                    console.log(`[API] Queued subs from Remnawave description: ${queued_subs.length} items`);
                }
            } catch (e) {
                console.log(`[API] Could not parse Remnawave description as JSON: ${e.message}`);
            }
        }

        // FALLBACK: Local SQLite DB (available when running locally, not on Railway)
        console.log(`[API] DB available: ${dbAvailable}, db object: ${!!db}`);
        if (dbAvailable && db) {
            // Override queued_subs from DB if Remnawave had none
            if (queued_subs.length === 0) {
                queued_subs = await new Promise((resolve) => {
                    db.all("SELECT id, plan_name, days FROM orders WHERE user_id = ? AND status = 'queued' ORDER BY id ASC", [telegram_id], (err, rows) => {
                        if (err) { console.error('[DB] Error querying queued subs:', err.message); resolve([]); }
                        else { resolve(rows || []); }
                    });
                });

                // Enrich Custom plan queued orders with server & device info
                const serverNames = { 'finland': '🇫🇮 Финляндия', 'germany': '🇩🇪 Германия', 'usa': '🇺🇸 США', 'netherlands': '🇳🇱 Нидерланды' };
                for (const q of queued_subs) {
                    if (q.plan_name === 'custom' && q.id) {
                        const serverKey = await new Promise((resolve) => {
                            db.get("SELECT value FROM settings WHERE key = ?", [`order_custom_${q.id}_server`], (err, row) => { resolve(row ? row.value : null); });
                        });
                        const devCount = await new Promise((resolve) => {
                            db.get("SELECT value FROM settings WHERE key = ?", [`order_custom_${q.id}_devices`], (err, row) => { resolve(row ? row.value : null); });
                        });
                        q.server_name = serverNames[serverKey] || (serverKey ? serverKey.charAt(0).toUpperCase() + serverKey.slice(1) : null);
                        q.device_count = devCount ? parseInt(devCount) : null;
                    }
                }
            }

            // Override plan name from DB if Remnawave tag was empty
            if (!activePlanName) {
                const lastOrder = await new Promise((resolve) => {
                    db.get("SELECT id, plan_name FROM orders WHERE user_id = ? AND status = 'paid' ORDER BY created_at DESC LIMIT 1", [telegram_id], (err, row) => { resolve(row || null); });
                });
                if (lastOrder) {
                    activePlanName = lastOrder.plan_name;
                    if (lastOrder.plan_name === 'custom') {
                        const serverNames = { 'finland': '🇫🇮 Финляндия', 'germany': '🇩🇪 Германия', 'usa': '🇺🇸 США', 'netherlands': '🇳🇱 Нидерланды' };
                        const serverKey = await new Promise((resolve) => {
                            db.get("SELECT value FROM settings WHERE key = ?", [`order_custom_${lastOrder.id}_server`], (err, row) => { resolve(row ? row.value : null); });
                        });
                        const devCount = await new Promise((resolve) => {
                            db.get("SELECT value FROM settings WHERE key = ?", [`order_custom_${lastOrder.id}_devices`], (err, row) => { resolve(row ? row.value : null); });
                        });
                        activeServerName = serverNames[serverKey] || (serverKey ? serverKey.charAt(0).toUpperCase() + serverKey.slice(1) : null);
                        activeDeviceCount = devCount ? parseInt(devCount) : null;
                    }
                }
            }
        }

        // Map plan slugs to display names
        const planDisplayNames = { 'hi': 'Hi Plan', 'base': 'Base Plan', 'premium': 'Premium Plan', 'custom': 'Custom Plan' };

        // Squad-based fallback if neither tag nor DB had the plan
        let squadPlanHint = null;
        if (!activePlanName && rwUser.activeInternalSquads && Array.isArray(rwUser.activeInternalSquads) && rwUser.activeInternalSquads.length > 0) {
            const squadName = rwUser.activeInternalSquads[0].name || '';
            const sn = squadName.toLowerCase();
            if (sn === 'base') squadPlanHint = 'base';
            else if (sn.startsWith('custom')) squadPlanHint = 'custom';
            else if (sn.includes('premium') || sn.includes('hi')) squadPlanHint = 'premium';
            console.log(`[API] Squad fallback: "${squadName}" → ${squadPlanHint}`);
        }

        const resolvedPlan = activePlanName || squadPlanHint || 'premium';
        const displayPlanName = planDisplayNames[resolvedPlan] || resolvedPlan;

        console.log(`[API] Plan resolution: tag=${rwUser.tag}, DB=${activePlanName}, squad=${squadPlanHint}, resolved=${resolvedPlan}, display=${displayPlanName}`);
        console.log(`[API] Queued subs count: ${queued_subs.length}`, queued_subs.length > 0 ? JSON.stringify(queued_subs) : '');

        return res.json({
            telegram_user: {
                first_name, last_name, username: tgUsername, photo_url
            },
            has_subscription: true,
            queued_subs: queued_subs,
            subscription: {
                expire_ts: expireTs,
                limit_bytes: rwUser.trafficLimitBytes || rwUser.trafficLimit || 0,
                used_bytes: traffic.total,
                device_limit: rwUser.hwidDeviceLimit || 0,
                active_devices: activeDevices,
                sub_link: subLink,
                status: rwUser.status,
                name: displayPlanName,
                server_name: activeServerName,
                device_count_custom: activeDeviceCount,
                plan_slug: activePlanName
            }
        });

    } catch (err) {
        console.error('[API] Unhandled error in /api/user:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/devices', async (req, res) => {
    const { initData } = req.body;
    if (!initData) return res.status(400).json({ error: "No initData" });
    if (!verifyTelegramWebAppData(BOT_TOKEN, initData)) return res.status(401).json({ error: "Invalid data" });

    try {
        const urlParams = new URLSearchParams(initData);
        const tgUser = JSON.parse(urlParams.get('user'));
        const rwUsername = `user_${tgUser.id}`;

        let rwUser = await fetchRemnawaveAPI(`/api/users/by-username/${rwUsername}`);
        rwUser = extractRemnawaveData(rwUser);

        if (!rwUser || (rwUser && rwUser.username !== rwUsername)) {
            const searchData = await fetchRemnawaveAPI(`/api/users?search=${rwUsername}&limit=100`);
            const searchRes = extractRemnawaveData(searchData);
            let usersList = searchRes && Array.isArray(searchRes.users) ? searchRes.users : (searchRes && Array.isArray(searchRes.data) ? searchRes.data : []);
            rwUser = usersList.find(u => u.username === rwUsername);
        }

        if (!rwUser) return res.status(404).json({ error: "User not found" });
        const userUuid = rwUser.uuid || rwUser.id;

        const devicesRes = await fetchRemnawaveAPI(`/api/hwid/devices/${userUuid}`);
        let devicesData = extractRemnawaveData(devicesRes);

        let devices = [];
        if (Array.isArray(devicesData)) devices = devicesData;
        else if (devicesData && Array.isArray(devicesData.devices)) devices = devicesData.devices;
        else if (devicesData && Array.isArray(devicesData.data)) devices = devicesData.data;
        else if (devicesData && Array.isArray(devicesData.hwidDevices)) devices = devicesData.hwidDevices;

        // Log raw device data for debugging
        if (devices.length > 0) {
            console.log('[API Devices] Raw device[0] ALL keys:', JSON.stringify(Object.keys(devices[0])));
            console.log('[API Devices] Raw device[0] FULL:', JSON.stringify(devices[0]));
        }

        const mapped = devices.map(d => {
            // Build name from platform + osVersion (e.g. "Windows 10")
            let displayName = '';
            const platform = d.platform || '';
            // osVersion format: "10_10.0.19044" or "16" — split by underscore
            const osVer = d.osVersion || d.os_version || '';
            if (platform) {
                displayName = platform;
                if (osVer) {
                    const majorVer = osVer.split('_')[0] || osVer;
                    displayName += ` ${majorVer}`;
                }
            } else if (d.deviceModel) {
                displayName = d.deviceModel;
            } else if (d.userAgent) {
                displayName = d.userAgent;
            } else {
                displayName = 'Неизвестное устройство';
            }
            return {
                id: d.hwid,  // hwid IS the device identifier
                name: displayName.trim(),
                last_active: d.updatedAt || d.createdAt || null
            };
        });

        console.log('[API Devices] Mapped devices:', JSON.stringify(mapped));

        res.json({ devices: mapped });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/devices/delete', async (req, res) => {
    const { initData, deviceId } = req.body;
    console.log(`[API Delete] Called with deviceId: ${deviceId}`);
    if (!initData || !deviceId) return res.status(400).json({ error: "Missing params" });
    if (!verifyTelegramWebAppData(BOT_TOKEN, initData)) return res.status(401).json({ error: "Invalid data" });

    try {
        const urlParams = new URLSearchParams(initData);
        const tgUser = JSON.parse(urlParams.get('user'));
        const rwUsername = `user_${tgUser.id}`;

        let rwUser = await fetchRemnawaveAPI(`/api/users/by-username/${rwUsername}`);
        rwUser = extractRemnawaveData(rwUser);

        if (!rwUser || (rwUser && rwUser.username !== rwUsername)) {
            const searchData = await fetchRemnawaveAPI(`/api/users?search=${rwUsername}&limit=100`);
            const searchRes = extractRemnawaveData(searchData);
            let usersList = searchRes && Array.isArray(searchRes.users) ? searchRes.users : (searchRes && Array.isArray(searchRes.data) ? searchRes.data : []);
            rwUser = usersList.find(u => u.username === rwUsername);
        }

        if (!rwUser) return res.status(404).json({ error: "User not found" });
        const userUuid = rwUser.uuid || rwUser.id;

        // Get all user devices
        const devicesRes = await fetchRemnawaveAPI(`/api/hwid/devices/${userUuid}`);
        let devicesData = extractRemnawaveData(devicesRes);

        let devices = [];
        if (Array.isArray(devicesData)) devices = devicesData;
        else if (devicesData && Array.isArray(devicesData.devices)) devices = devicesData.devices;
        else if (devicesData && Array.isArray(devicesData.data)) devices = devicesData.data;
        else if (devicesData && Array.isArray(devicesData.hwidDevices)) devices = devicesData.hwidDevices;

        console.log(`[API Delete] Found ${devices.length} devices, looking for hwid=${deviceId}`);

        // Device identifier IS hwid
        const ownsDevice = devices.find(d => String(d.hwid) === String(deviceId));
        if (!ownsDevice) {
            console.log(`[API Delete] Device not found. Available HWIDs:`, devices.map(d => d.hwid));
            return res.status(403).json({ error: "Device not found" });
        }

        const hwid = ownsDevice.hwid;
        console.log('[API Delete] Deleting device with hwid:', hwid, 'userUuid:', userUuid);

        // Confirmed working pattern: POST /api/hwid/devices/delete with { userUuid, hwid }
        const result = await fetchRemnawaveAPI('/api/hwid/devices/delete', 'POST', { userUuid, hwid });

        if (result) {
            console.log('[API Delete] Success:', JSON.stringify(result));
            res.json({ success: true });
        } else {
            console.log('[API Delete] Failed for hwid:', hwid);
            res.status(500).json({ error: "Failed to delete device from panel" });
        }
    } catch (e) {
        console.error('[API Delete] Error:', e);
        res.status(500).json({ error: "Server error" });
    }
});


app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts('html') && !req.url.includes('.')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        next();
    }
});

app.listen(PORT, () => {
    console.log(`[Custos] Server is running on port ${PORT}`);
});
