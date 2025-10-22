import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getVisionClient } from "../../services/google/clients";

export const ocrTool = createTool({
  id: "ocr-extract-card-data",
  description: "استخراج النص والبيانات من صورة بطاقة الناخب باستخدام Google Cloud Vision OCR",
  inputSchema: z.object({
    imageBuffer: z.string().describe("صورة البطاقة بصيغة base64"),
  }),
  outputSchema: z.object({
    fullText: z.string().describe("النص الكامل المستخرج من البطاقة"),
    nationalId: z.string().describe("الرقم القومي المستخرج"),
    extractedData: z.object({
      name: z.string().optional().describe("الاسم"),
      address: z.string().optional().describe("العنوان"),
    }).optional(),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const { imageBuffer } = context;

    logger?.info('🔍 [OCR] بدء استخراج البيانات من صورة البطاقة...');

    try {
      const visionClient = await getVisionClient();
      
      const imageBytes = Buffer.from(imageBuffer, 'base64');

      logger?.info('📸 [OCR] إرسال الصورة إلى Google Cloud Vision...');

      const [result] = await visionClient.textDetection({
        image: { content: imageBytes },
      });

      const detections = result.textAnnotations || [];
      const fullText = detections.length ? detections[0].description || '' : '';

      logger?.info('📝 [OCR] تم استخراج النص');

      const nationalIdMatch = fullText.match(/\b(\d{14})\b/);
      const nationalId = nationalIdMatch ? nationalIdMatch[0] : '';

      logger?.info('🆔 [OCR] الرقم القومي المستخرج');

      return {
        fullText,
        nationalId,
        extractedData: {
          name: '',
          address: '',
        },
      };
    } catch (error: any) {
      logger?.error('❌ [OCR] خطأ في استخراج البيانات:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  },
});
