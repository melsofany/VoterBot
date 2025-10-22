import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import axios from "axios";

export const sendTelegramMessageTool = createTool({
  id: "send-telegram-message",
  description: "إرسال رسالة عبر Telegram إلى المستخدم",
  inputSchema: z.object({
    chatId: z.string().describe("Chat ID للمستخدم"),
    message: z.string().describe("الرسالة المراد إرسالها"),
  }),
  outputSchema: z.object({
    sent: z.boolean().describe("هل تم الإرسال"),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();

    logger?.info('📤 [SendTelegramMessage] إرسال رسالة');

    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        throw new Error('TELEGRAM_BOT_TOKEN not configured');
      }

      await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          chat_id: context.chatId,
          text: context.message,
          parse_mode: 'HTML',
        }
      );

      logger?.info('✅ [SendTelegramMessage] تم إرسال الرسالة');

      return { sent: true };
    } catch (error: any) {
      logger?.error('❌ [SendTelegramMessage] خطأ في الإرسال');
      throw error;
    }
  },
});
