import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getSheetsClient } from "../../services/google/clients";

export const checkAuthorizedUserTool = createTool({
  id: "check-authorized-user",
  description: "التحقق من أن User ID مصرح له باستخدام البوت من خلال قراءة قائمة المناديب في Google Sheet",
  inputSchema: z.object({
    userId: z.string().describe("Telegram User ID للتحقق منه"),
  }),
  outputSchema: z.object({
    isAuthorized: z.boolean().describe("هل المستخدم مصرح له"),
    message: z.string().describe("رسالة توضيحية"),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const { userId } = context;

    logger?.info('🔐 [CheckAuthorizedUser] بدء التحقق من User ID');

    try {
      const sheets = await getSheetsClient();
      const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

      if (!spreadsheetId) {
        throw new Error('GOOGLE_SPREADSHEET_ID not configured');
      }

      logger?.info('📊 [CheckAuthorizedUser] قراءة قائمة المناديب من Sheet...');

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'المناديب!A:A',
      });

      const rows = response.data.values || [];
      const authorizedUserIds = rows.flat().filter(id => id && id.trim());

      logger?.info('📋 [CheckAuthorizedUser] المناديب المصرح لهم:', { 
        count: authorizedUserIds.length
      });

      const isAuthorized = authorizedUserIds.includes(userId);

      if (isAuthorized) {
        logger?.info('✅ [CheckAuthorizedUser] المستخدم مصرح له');
        return {
          isAuthorized: true,
          message: 'المستخدم مصرح له باستخدام البوت',
        };
      } else {
        logger?.warn('⛔ [CheckAuthorizedUser] المستخدم غير مصرح له');
        return {
          isAuthorized: false,
          message: 'المستخدم غير مصرح له باستخدام البوت',
        };
      }
    } catch (error: any) {
      logger?.error('❌ [CheckAuthorizedUser] خطأ في التحقق:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  },
});
