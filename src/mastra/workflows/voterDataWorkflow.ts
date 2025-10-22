import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { voterDataAgent } from "../agents/voterDataAgent";
import axios from "axios";

const useAgentStep = createStep({
  id: "use-agent",
  description: "استخدام Agent لمعالجة الرسالة",
  inputSchema: z.object({
    telegramPayload: z.string().describe("Telegram payload as JSON string"),
    threadId: z.string().describe("معرف المحادثة"),
  }),
  outputSchema: z.object({
    response: z.string().describe("رد Agent"),
    chatId: z.string().describe("Chat ID للرد"),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🤖 [UseAgent] بدء معالجة الرسالة');

    const { text } = await voterDataAgent.generate(
      [{ role: "user", content: inputData.telegramPayload }],
      {
        resourceId: "bot",
        threadId: inputData.threadId,
        maxSteps: 10,
      }
    );

    logger?.info('✅ [UseAgent] تم معالجة الرسالة');

    const parsedThreadId = inputData.threadId.split('/')[1] || inputData.threadId;

    return {
      response: text,
      chatId: parsedThreadId,
    };
  },
});

const sendReplyStep = createStep({
  id: "send-reply",
  description: "إرسال الرد عبر Telegram",
  inputSchema: z.object({
    response: z.string().describe("الرد المراد إرساله"),
    chatId: z.string().describe("Chat ID للرد"),
  }),
  outputSchema: z.object({
    sent: z.boolean().describe("هل تم الإرسال"),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('📤 [SendReply] إرسال الرد عبر Telegram');

    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        throw new Error('TELEGRAM_BOT_TOKEN not configured');
      }

      await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          chat_id: inputData.chatId,
          text: inputData.response,
          parse_mode: 'HTML',
        }
      );

      logger?.info('✅ [SendReply] تم إرسال الرد');

      return { sent: true };
    } catch (error: any) {
      logger?.error('❌ [SendReply] خطأ في الإرسال');
      throw error;
    }
  },
});

export const voterDataWorkflow = createWorkflow({
  id: "voter-data-workflow",
  description: "Workflow لجمع بيانات الناخبين",
  inputSchema: z.object({
    telegramPayload: z.string(),
    threadId: z.string(),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
  }),
})
  .then(useAgentStep)
  .then(sendReplyStep)
  .commit();
