import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import axios from "axios";

export const downloadTelegramPhotoTool = createTool({
  id: "download-telegram-photo",
  description: "تحميل صورة من Telegram باستخدام File ID",
  inputSchema: z.object({
    fileId: z.string().describe("معرف الملف في Telegram"),
  }),
  outputSchema: z.object({
    imageBuffer: z.string().describe("الصورة بصيغة base64"),
    success: z.boolean(),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const { fileId } = context;

    logger?.info('📥 [DownloadTelegramPhoto] بدء تحميل الصورة');

    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        throw new Error('TELEGRAM_BOT_TOKEN not configured');
      }

      const fileResponse = await axios.get(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
      );
      
      const filePath = fileResponse.data.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

      logger?.info('📥 [DownloadTelegramPhoto] جاري التحميل...');

      const imageResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data).toString('base64');

      logger?.info('✅ [DownloadTelegramPhoto] تم التحميل بنجاح');

      return {
        imageBuffer,
        success: true,
      };
    } catch (error: any) {
      logger?.error('❌ [DownloadTelegramPhoto] خطأ في التحميل:', { error: error.message });
      throw error;
    }
  },
});
