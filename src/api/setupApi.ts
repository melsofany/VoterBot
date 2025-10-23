import { Hono } from 'hono';
import { getSheetsClient } from '../services/google/clients';

const app = new Hono();

app.post('/setup-sheets', async (c) => {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!spreadsheetId) {
      return c.json({
        success: false,
        message: 'GOOGLE_SPREADSHEET_ID غير مُعد في المتغيرات البيئية',
      }, 400);
    }

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const existingSheets = spreadsheet.data.sheets?.map((s: any) => s.properties?.title) || [];
    const sheetsCreated: string[] = [];

    if (!existingSheets.includes('المناديب')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'المناديب',
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 2,
                    frozenRowCount: 1,
                  },
                },
              },
            },
          ],
        },
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'المناديب!A1:B1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['User ID', 'الاسم']],
        },
      });

      const delegatesSheetId = (await sheets.spreadsheets.get({ spreadsheetId }))
        .data.sheets?.find((s: any) => s.properties?.title === 'المناديب')
        ?.properties?.sheetId;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: delegatesSheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.2, green: 0.5, blue: 0.8 },
                    textFormat: {
                      foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                      fontSize: 12,
                      bold: true,
                    },
                    horizontalAlignment: 'CENTER',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
              },
            },
          ],
        },
      });

      sheetsCreated.push('المناديب');
    }

    if (!existingSheets.includes('بيانات_الناخبين')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'بيانات_الناخبين',
                  gridProperties: {
                    rowCount: 10000,
                    columnCount: 10,
                    frozenRowCount: 1,
                  },
                },
              },
            },
          ],
        },
      });

      const headers = [
        'التاريخ والوقت',
        'الرقم القومي',
        'اسم العائلة',
        'رقم الهاتف',
        'الموقف',
        'خط العرض',
        'خط الطول',
        'رابط الصورة',
        'نص OCR',
        'User ID المندوب',
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'بيانات_الناخبين!A1:J1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });

      const votersSheetId = (await sheets.spreadsheets.get({ spreadsheetId }))
        .data.sheets?.find((s: any) => s.properties?.title === 'بيانات_الناخبين')
        ?.properties?.sheetId;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: votersSheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.2, green: 0.7, blue: 0.4 },
                    textFormat: {
                      foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                      fontSize: 12,
                      bold: true,
                    },
                    horizontalAlignment: 'CENTER',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: votersSheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: 10,
                },
              },
            },
          ],
        },
      });

      sheetsCreated.push('بيانات_الناخبين');
    }

    const message = sheetsCreated.length > 0
      ? `تم إنشاء ${sheetsCreated.length} صفحة بنجاح: ${sheetsCreated.join(', ')}`
      : 'جميع الصفحات موجودة بالفعل';

    return c.json({
      success: true,
      message,
      sheetsCreated,
      existingSheets,
    });

  } catch (error: any) {
    console.error('خطأ في إعداد الشيتس:', error);
    return c.json({
      success: false,
      message: `خطأ: ${error.message}`,
      error: error.stack,
    }, 500);
  }
});

export const setupApi = app;
