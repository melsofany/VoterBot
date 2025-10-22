import { getSheetsClient } from "../services/google/clients";
import { Hono } from "hono";
import { cors } from "hono/cors";

export const delegatesApi = new Hono();

delegatesApi.use('/*', cors());

delegatesApi.get('/delegates', async (c) => {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!spreadsheetId) {
      return c.json({ error: 'GOOGLE_SPREADSHEET_ID not configured' }, 500);
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'المناديب!A:A',
    });

    const rows = response.data.values || [];
    const delegates = rows.flat().filter(id => id && id.trim());

    return c.json({ delegates });
  } catch (error: any) {
    console.error('Error fetching delegates:', error);
    return c.json({ error: error.message }, 500);
  }
});

delegatesApi.post('/delegates', async (c) => {
  try {
    const { userId } = await c.req.json();

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
      range: 'المناديب!A:A',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[userId.trim()]],
      },
    });

    return c.json({ success: true, message: 'تم إضافة المندوب بنجاح' });
  } catch (error: any) {
    console.error('Error adding delegate:', error);
    return c.json({ error: error.message }, 500);
  }
});

delegatesApi.delete('/delegates/:userId', async (c) => {
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
      range: 'المناديب!A:A',
    });

    const rows = response.data.values || [];
    const delegates = rows.map(row => row[0]).filter(id => id && id.trim());

    const indexToDelete = delegates.findIndex(id => id === userId.trim());

    if (indexToDelete === -1) {
      return c.json({ error: 'User ID غير موجود' }, 404);
    }

    const updatedDelegates = delegates.filter(id => id !== userId.trim());

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'المناديب!A:A',
    });

    if (updatedDelegates.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'المناديب!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: updatedDelegates.map(id => [id]),
        },
      });
    }

    return c.json({ success: true, message: 'تم حذف المندوب بنجاح' });
  } catch (error: any) {
    console.error('Error deleting delegate:', error);
    return c.json({ error: error.message }, 500);
  }
});

delegatesApi.get('/voters', async (c) => {
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
