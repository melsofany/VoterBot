import { getSheetsClient } from "../services/google/clients";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { randomBytes } from "crypto";

export const delegatesApi = new Hono().basePath('/api/dashboard');

delegatesApi.use('/*', cors());

const sessions = new Map<string, { username: string; createdAt: number }>();
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

function createSession(username: string): string {
  const token = generateSessionToken();
  sessions.set(token, { username, createdAt: Date.now() });
  return token;
}

function validateSession(token: string | undefined): boolean {
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TIMEOUT) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireAuth(c: any, next: () => Promise<void>) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || getCookie(c, 'session_token');
  if (!validateSession(token)) {
    return c.json({ error: 'غير مصرح' }, 401);
  }
  return next();
}

delegatesApi.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json();
    const adminUsername = process.env.DASHBOARD_USERNAME;
    const adminPassword = process.env.DASHBOARD_PASSWORD;
    
    if (!adminUsername || !adminPassword) {
      return c.json({ error: 'النظام غير مهيأ بشكل صحيح' }, 500);
    }
    
    if (username === adminUsername && password === adminPassword) {
      const token = createSession(username);
      setCookie(c, 'session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: SESSION_TIMEOUT / 1000,
        path: '/',
      });
      return c.json({ success: true, message: 'تم تسجيل الدخول بنجاح', token });
    }
    
    return c.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, 401);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

delegatesApi.post('/logout', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || getCookie(c, 'session_token');
  if (token) {
    sessions.delete(token);
    deleteCookie(c, 'session_token');
  }
  return c.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

delegatesApi.get('/check-auth', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || getCookie(c, 'session_token');
  return c.json({ authenticated: validateSession(token) });
});

delegatesApi.get('/delegates', async (c) => {
  const authCheck = await requireAuth(c, async () => {});
  if (authCheck) return authCheck;
  
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!spreadsheetId) {
      return c.json({ error: 'GOOGLE_SPREADSHEET_ID not configured' }, 500);
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'المناديب!A:B',
    });

    const rows = response.data.values || [];
    const delegates = rows.map(row => ({
      userId: row[0] || '',
      name: row[1] || '',
    })).filter(d => d.userId);

    return c.json({ delegates });
  } catch (error: any) {
    console.error('Error fetching delegates:', error);
    return c.json({ error: error.message }, 500);
  }
});

delegatesApi.post('/delegates', async (c) => {
  const authCheck = await requireAuth(c, async () => {});
  if (authCheck) return authCheck;
  
  try {
    const { userId, name } = await c.req.json();

    if (!userId || !userId.trim()) {
      return c.json({ error: 'User ID مطلوب' }, 400);
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!spreadsheetId) {
      return c.json({ error: 'GOOGLE_SPREADSHEET_ID not configured' }, 500);
    }

    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'المناديب!A:A',
    });

    const rows = existingResponse.data.values || [];
    const delegates = rows.flat().filter(id => id && id.trim());

    if (delegates.includes(userId.trim())) {
      return c.json({ error: 'هذا User ID موجود بالفعل' }, 400);
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'المناديب!A:B',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[userId.trim(), name?.trim() || '']],
      },
    });

    return c.json({ success: true, message: 'تم إضافة المندوب بنجاح' });
  } catch (error: any) {
    console.error('Error adding delegate:', error);
    return c.json({ error: error.message }, 500);
  }
});

delegatesApi.delete('/delegates/:userId', async (c) => {
  const authCheck = await requireAuth(c, async () => {});
  if (authCheck) return authCheck;
  
  try {
    const userId = c.req.param('userId');

    if (!userId || !userId.trim()) {
      return c.json({ error: 'User ID مطلوب' }, 400);
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!spreadsheetId) {
      return c.json({ error: 'GOOGLE_SPREADSHEET_ID not configured' }, 500);
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'المناديب!A:B',
    });

    const rows = response.data.values || [];
    const delegates = rows.map(row => ({ userId: row[0] || '', name: row[1] || '' })).filter(d => d.userId.trim());

    const indexToDelete = delegates.findIndex(d => d.userId === userId.trim());

    if (indexToDelete === -1) {
      return c.json({ error: 'User ID غير موجود' }, 404);
    }

    const updatedDelegates = delegates.filter(d => d.userId !== userId.trim());

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'المناديب!A:B',
    });

    if (updatedDelegates.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'المناديب!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: updatedDelegates.map(d => [d.userId, d.name]),
        },
      });
    }

    return c.json({ success: true, message: 'تم حذف المندوب بنجاح' });
  } catch (error: any) {
    console.error('Error deleting delegate:', error);
    return c.json({ error: error.message }, 500);
  }
});

delegatesApi.get('/stats', async (c) => {
  const authCheck = await requireAuth(c, async () => {});
  if (authCheck) return authCheck;
  
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!spreadsheetId) {
      return c.json({ error: 'GOOGLE_SPREADSHEET_ID not configured' }, 500);
    }

    const [delegatesResponse, votersResponse] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'المناديب!A:B' }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'بيانات_الناخبين!A:J' }),
    ]);

    const delegatesRows = delegatesResponse.data.values || [];
    const votersRows = votersResponse.data.values || [];

    const delegates = delegatesRows.filter(row => row[0]);
    const voters = votersRows.filter(row => row[1]);

    const stanceCounts = { مؤيد: 0, معارض: 0, محايد: 0 };
    const delegateStats: Record<string, { name: string; count: number }> = {};

    delegates.forEach(row => {
      const userId = row[0];
      const name = row[1] || '';
      delegateStats[userId] = { name, count: 0 };
    });

    voters.forEach(row => {
      const stance = row[4];
      if (stance in stanceCounts) {
        stanceCounts[stance as keyof typeof stanceCounts]++;
      }
      const collectorId = row[9];
      if (collectorId && delegateStats[collectorId]) {
        delegateStats[collectorId].count++;
      }
    });

    return c.json({
      totalDelegates: delegates.length,
      totalVoters: voters.length,
      stanceCounts,
      delegateStats,
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return c.json({ error: error.message }, 500);
  }
});

delegatesApi.get('/voters', async (c) => {
  const authCheck = await requireAuth(c, async () => {});
  if (authCheck) return authCheck;
  
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!spreadsheetId) {
      return c.json({ error: 'GOOGLE_SPREADSHEET_ID not configured' }, 500);
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'بيانات_الناخبين!A:J',
    });

    const rows = response.data.values || [];
    
    if (rows.length === 0) {
      return c.json({ voters: [] });
    }

    const voters = rows.map((row, index) => ({
      rowNumber: index + 1,
      timestamp: row[0] || '',
      nationalId: row[1] || '',
      familyName: row[2] || '',
      phoneNumber: row[3] || '',
      stance: row[4] || '',
      latitude: row[5] || '',
      longitude: row[6] || '',
      driveLink: row[7] || '',
      collectorUserId: row[9] || '',
    }));

    return c.json({ voters });
  } catch (error: any) {
    console.error('Error fetching voters:', error);
    return c.json({ error: error.message }, 500);
  }
});
