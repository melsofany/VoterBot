import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const validatePhoneTool = createTool({
  id: "validate-egyptian-phone",
  description: "التحقق من صحة رقم الهاتف المصري (11 رقم ويبدأ بـ 01)",
  inputSchema: z.object({
    phoneNumber: z.string().describe("رقم الهاتف المراد التحقق منه"),
  }),
  outputSchema: z.object({
    isValid: z.boolean().describe("هل الرقم صحيح"),
    cleanedPhone: z.string().describe("الرقم بعد التنظيف"),
    message: z.string().describe("رسالة توضيحية"),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const { phoneNumber } = context;

    logger?.info('📱 [ValidatePhone] التحقق من رقم الهاتف');

    const cleaned = phoneNumber.replace(/\D/g, '');

    logger?.info('🔢 [ValidatePhone] الرقم بعد التنظيف');

    const isValid = /^(01)\d{9}$/.test(cleaned);

    if (isValid) {
      logger?.info('✅ [ValidatePhone] رقم الهاتف صحيح');
      return {
        isValid: true,
        cleanedPhone: cleaned,
        message: 'رقم الهاتف صحيح',
      };
    } else {
      logger?.warn('⚠️ [ValidatePhone] رقم الهاتف غير صحيح');
      return {
        isValid: false,
        cleanedPhone: cleaned,
        message: 'رقم الهاتف يجب أن يكون 11 رقم ويبدأ بـ 01',
      };
    }
  },
});
