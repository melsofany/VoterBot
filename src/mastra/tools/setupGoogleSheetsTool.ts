import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getSheetsClient } from "../../services/google/clients";

export const setupGoogleSheetsTool = createTool({
  id: "setup-google-sheets",
  description: "إعداد صفحات Google Sheets تلقائيًا بالهيكل الصحيح للمشروع",
  inputSchema: z.object({
    spreadsheetId: z.string().optional().describe("معرف الجدول (اختياري - سيستخدم من المتغيرات البيئية إذا لم يُحدد)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    sheetsCreated: z.array(z.string()),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();

    logger?.info('🔧 [SetupGoogleSheets] بدء إعداد صفحات Google Sheets');

    try {
      const sheets = await getSheetsClient();
      const spreadsheetId = context.spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;

      if (!spreadsheetId) {
        throw new Error('GOOGLE_SPREADSHEET_ID not configured');
      }

      logger?.info('📊 [SetupGoogleSheets] الحصول على معلومات الجدول الحالي...');

      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      const existingSheets = spreadsheet.data.sheets?.map((s: any) => s.properties?.title) || [];
      logger?.info('📋 [SetupGoogleSheets] الصفحات الموجودة:', { sheets: existingSheets });

      const sheetsCreated: string[] = [];

      if (!existingSheets.includes('المناديب')) {
        logger?.info('➕ [SetupGoogleSheets] إنشاء صفحة "المناديب"...');
        
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

        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId: (await sheets.spreadsheets.get({ spreadsheetId }))
                      .data.sheets?.find((s: any) => s.properties?.title === 'المناديب')
                      ?.properties?.sheetId,
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
        logger?.info('✅ [SetupGoogleSheets] تم إنشاء صفحة "المناديب"');
      }

      if (!existingSheets.includes('بيانات_الناخبين')) {
        logger?.info('➕ [SetupGoogleSheets] إنشاء صفحة "بيانات_الناخبين"...');
        
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
        logger?.info('✅ [SetupGoogleSheets] تم إنشاء صفحة "بيانات_الناخبين"');
      }

      const message = sheetsCreated.length > 0
        ? `تم إنشاء ${sheetsCreated.length} صفحة بنجاح: ${sheetsCreated.join(', ')}`
        : 'جميع الصفحات موجودة بالفعل - لا توجد صفحات جديدة لإنشائها';

      logger?.info('✅ [SetupGoogleSheets] اكتمل الإعداد بنجاح');

      return {
        success: true,
        message,
        sheetsCreated,
      };
    } catch (error: any) {
      logger?.error('❌ [SetupGoogleSheets] خطأ في الإعداد:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  },
});
