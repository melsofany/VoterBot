import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getSheetsClient } from "../../services/google/clients";

export const saveVoterDataTool = createTool({
  id: "save-voter-data",
  description: "حفظ بيانات الناخب في Google Sheets",
  inputSchema: z.object({
    nationalId: z.string().describe("الرقم القومي"),
    familyName: z.string().describe("اسم العائلة"),
    phoneNumber: z.string().describe("رقم الهاتف"),
    stance: z.enum(['مؤيد', 'معارض', 'محايد']).describe("موقف الناخب"),
    latitude: z.number().optional().describe("خط العرض"),
    longitude: z.number().optional().describe("خط الطول"),
    driveLink: z.string().describe("رابط صورة البطاقة على Drive"),
    ocrText: z.string().optional().describe("النص المستخرج من البطاقة"),
    collectorUserId: z.string().describe("User ID للمندوب الذي جمع البيانات"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    rowNumber: z.number().optional(),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();

    logger?.info('💾 [SaveVoterData] بدء حفظ بيانات الناخب');

    try {
      const sheets = await getSheetsClient();
      const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

      if (!spreadsheetId) {
        throw new Error('GOOGLE_SPREADSHEET_ID not configured');
      }

      const row = [
        new Date().toISOString(),
        context.nationalId,
        context.familyName,
        context.phoneNumber,
        context.stance,
        context.latitude?.toString() || '',
        context.longitude?.toString() || '',
        context.driveLink,
        context.ocrText?.substring(0, 500) || '',
        context.collectorUserId,
      ];

      logger?.info('📊 [SaveVoterData] إضافة صف جديد في Sheet...');

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'بيانات_الناخبين!A:J',
        valueInputOption: 'RAW',
        requestBody: {
          values: [row],
        },
      });

      logger?.info('✅ [SaveVoterData] تم حفظ البيانات بنجاح');

      return {
        success: true,
        message: 'تم حفظ بيانات الناخب بنجاح',
        rowNumber: response.data.updates?.updatedRows || 0,
      };
    } catch (error: any) {
      logger?.error('❌ [SaveVoterData] خطأ في حفظ البيانات:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  },
});
