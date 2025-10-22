import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getDriveClient } from "../../services/google/clients";
import { Readable } from 'stream';

export const uploadToDriveTool = createTool({
  id: "upload-to-drive",
  description: "رفع صورة بطاقة الناخب إلى Google Drive مع تسميتها بالرقم القومي",
  inputSchema: z.object({
    imageBuffer: z.string().describe("صورة البطاقة بصيغة base64"),
    nationalId: z.string().describe("الرقم القومي لتسمية الملف"),
  }),
  outputSchema: z.object({
    fileId: z.string().describe("معرف الملف في Google Drive"),
    webViewLink: z.string().describe("رابط عرض الملف"),
    fileName: z.string().describe("اسم الملف"),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const { imageBuffer, nationalId } = context;

    logger?.info('📤 [UploadToDrive] بدء رفع الصورة إلى Google Drive');

    try {
      const drive = await getDriveClient();
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

      if (!folderId) {
        throw new Error('GOOGLE_DRIVE_FOLDER_ID not configured');
      }

      const fileName = nationalId ? `${nationalId}_${Date.now()}.jpg` : `card_${Date.now()}.jpg`;
      
      const imageBytes = Buffer.from(imageBuffer, 'base64');
      const stream = Readable.from(imageBytes);

      logger?.info('☁️ [UploadToDrive] رفع الملف');

      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
        },
        media: {
          mimeType: 'image/jpeg',
          body: stream,
        },
        fields: 'id,webViewLink',
      });

      const fileId = response.data.id || '';
      const webViewLink = response.data.webViewLink || '';

      logger?.info('✅ [UploadToDrive] تم رفع الصورة بنجاح');

      return {
        fileId,
        webViewLink,
        fileName,
      };
    } catch (error: any) {
      logger?.error('❌ [UploadToDrive] خطأ في رفع الصورة:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  },
});
