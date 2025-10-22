import { Mastra } from "@mastra/core";
import { MastraError } from "@mastra/core/error";
import { PinoLogger } from "@mastra/loggers";
import { LogLevel, MastraLogger } from "@mastra/core/logger";
import pino from "pino";
import { MCPServer } from "@mastra/mcp";
import { NonRetriableError } from "inngest";
import { z } from "zod";

import { sharedPostgresStorage } from "./storage";
import { inngest, inngestServe } from "./inngest";
import { voterDataWorkflow } from "./workflows/voterDataWorkflow";
import { voterDataAgent } from "./agents/voterDataAgent";
import { registerTelegramTrigger } from "../triggers/telegramTriggers";
import { getSheetsClient } from "../services/google/clients";
import { ocrTool } from "./tools/ocrTool";
import { uploadToDriveTool } from "./tools/uploadToDriveTool";
import { saveVoterDataTool } from "./tools/saveVoterDataTool";
import { validatePhoneTool } from "./tools/validatePhoneTool";
import { checkAuthorizedUserTool } from "./tools/checkAuthorizedUserTool";
import { downloadTelegramPhotoTool } from "./tools/downloadTelegramPhotoTool";
import { sendTelegramMessageTool } from "./tools/sendTelegramMessageTool";
import { delegatesApi } from "../api/delegatesApi";
import { readFile } from "fs/promises";
import { join } from "path";

class ProductionPinoLogger extends MastraLogger {
  protected logger: pino.Logger;

  constructor(
    options: {
      name?: string;
      level?: LogLevel;
    } = {},
  ) {
    super(options);

    this.logger = pino({
      name: options.name || "app",
      level: options.level || LogLevel.INFO,
      base: {},
      formatters: {
        level: (label: string, _number: number) => ({
          level: label,
        }),
      },
      timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
    });
  }

  debug(message: string, args: Record<string, any> = {}): void {
    this.logger.debug(args, message);
  }

  info(message: string, args: Record<string, any> = {}): void {
    this.logger.info(args, message);
  }

  warn(message: string, args: Record<string, any> = {}): void {
    this.logger.warn(args, message);
  }

  error(message: string, args: Record<string, any> = {}): void {
    this.logger.error(args, message);
  }
}

export const mastra = new Mastra({
  storage: sharedPostgresStorage,
  workflows: { voterDataWorkflow },
  agents: { voterDataAgent },
  mcpServers: {
    allTools: new MCPServer({
      name: "allTools",
      version: "1.0.0",
      tools: {
        ocrTool,
        uploadToDriveTool,
        saveVoterDataTool,
        validatePhoneTool,
        checkAuthorizedUserTool,
        downloadTelegramPhotoTool,
        sendTelegramMessageTool,
      },
    }),
  },
  bundler: {
    // A few dependencies are not properly picked up by
    // the bundler if they are not added directly to the
    // entrypoint.
    externals: [
      "@slack/web-api",
      "inngest",
      "inngest/hono",
      "hono",
      "hono/streaming",
    ],
    // sourcemaps are good for debugging.
    sourcemap: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    middleware: [
      async (c, next) => {
        const mastra = c.get("mastra");
        const logger = mastra?.getLogger();
        logger?.debug("[Request]", { method: c.req.method, url: c.req.url });
        try {
          await next();
        } catch (error) {
          logger?.error("[Response]", {
            method: c.req.method,
            url: c.req.url,
            error,
          });
          if (error instanceof MastraError) {
            if (error.id === "AGENT_MEMORY_MISSING_RESOURCE_ID") {
              // This is typically a non-retirable error. It means that the request was not
              // setup correctly to pass in the necessary parameters.
              throw new NonRetriableError(error.message, { cause: error });
            }
          } else if (error instanceof z.ZodError) {
            // Validation errors are never retriable.
            throw new NonRetriableError(error.message, { cause: error });
          }

          throw error;
        }
      },
    ],
    apiRoutes: [
      {
        path: "/api/inngest",
        method: "ALL",
        createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
      },
      {
        path: "/dashboard",
        method: "GET",
        handler: async (c) => {
          try {
            const html = await readFile(join(process.cwd(), 'public', 'dashboard.html'), 'utf-8');
            return c.html(html);
          } catch (error) {
            return c.text('Dashboard not found', 404);
          }
        },
      },
      {
        path: "/api/dashboard/*",
        method: "ALL",
        handler: async (c) => {
          return delegatesApi.fetch(c.req.raw, c.env);
        },
      },
      ...registerTelegramTrigger({
        triggerType: "telegram/message",
        handler: async (mastra, triggerInfo) => {
          const logger = mastra.getLogger();
          logger?.info("📱 [Telegram Trigger] رسالة جديدة من Telegram");

          const userId = String(triggerInfo.payload?.message?.from?.id || '');
          const chatId = String(triggerInfo.payload?.message?.chat?.id || '');

          try {
            const sheets = await getSheetsClient();
            const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

            if (!spreadsheetId) {
              throw new Error('GOOGLE_SPREADSHEET_ID not configured');
            }

            const response = await sheets.spreadsheets.values.get({
              spreadsheetId,
              range: 'المناديب!A:A',
            });

            const rows = response.data.values || [];
            const authorizedUserIds = rows.flat().filter(id => id && id.trim());
            const isAuthorized = authorizedUserIds.includes(userId);

            if (!isAuthorized) {
              logger?.warn("⛔ [Telegram Trigger] مستخدم غير مصرح له");
              return;
            }

            logger?.info("✅ [Telegram Trigger] مستخدم مصرح له، بدء معالجة");

            const telegramPayload = JSON.stringify(triggerInfo.payload);

            const run = await mastra.getWorkflow("voter-data-workflow").createRunAsync();
            await run.start({
              inputData: {
                telegramPayload,
                threadId: `telegram/${chatId}`,
              },
            });

            logger?.info("🚀 [Telegram Trigger] تم بدء Workflow");
          } catch (error: any) {
            logger?.error("❌ [Telegram Trigger] خطأ في معالجة الرسالة");
          }
        },
      }),
    ],
  },
  logger:
    process.env.NODE_ENV === "production"
      ? new ProductionPinoLogger({
          name: "Mastra",
          level: "info",
        })
      : new PinoLogger({
          name: "Mastra",
          level: "info",
        }),
});

/*  Sanity check 1: Throw an error if there are more than 1 workflows.  */
// !!!!!! Do not remove this check. !!!!!!
if (Object.keys(mastra.getWorkflows()).length > 1) {
  throw new Error(
    "More than 1 workflows found. Currently, more than 1 workflows are not supported in the UI, since doing so will cause app state to be inconsistent.",
  );
}

/*  Sanity check 2: Throw an error if there are more than 1 agents.  */
// !!!!!! Do not remove this check. !!!!!!
if (Object.keys(mastra.getAgents()).length > 1) {
  throw new Error(
    "More than 1 agents found. Currently, more than 1 agents are not supported in the UI, since doing so will cause app state to be inconsistent.",
  );
}
