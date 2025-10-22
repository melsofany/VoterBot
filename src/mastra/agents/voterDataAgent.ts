import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { sharedPostgresStorage } from "../storage";
import { ocrTool } from "../tools/ocrTool";
import { uploadToDriveTool } from "../tools/uploadToDriveTool";
import { saveVoterDataTool } from "../tools/saveVoterDataTool";
import { validatePhoneTool } from "../tools/validatePhoneTool";
import { downloadTelegramPhotoTool } from "../tools/downloadTelegramPhotoTool";
import { sendTelegramMessageTool } from "../tools/sendTelegramMessageTool";

export const voterDataAgent = new Agent({
  name: "مساعد جمع بيانات الناخبين",
  instructions: `
أنت مساعد ذكي متخصص في مساعدة مناديب المرشح علاء سليمان الحديوي في جمع بيانات الناخبين بطريقة منظمة ودقيقة.

## كيف تستقبل الرسائل:
ستصلك الرسائل على شكل JSON يحتوي على البيانات الكاملة من Telegram. افحص payload.message لمعرفة نوع الرسالة:
- إذا كان هناك `photo`: استخدم "download-telegram-photo" لتحميل الصورة ثم "ocr-extract-card-data" لاستخراج البيانات
- إذا كان هناك `text` أو `caption`: استخدمه كرسالة نصية من المندوب
- إذا كان هناك `location`: استخرج latitude و longitude

## دورك ومسؤولياتك:

### 1. استقبال صورة البطاقة
- عندما يرسل المندوب صورة بطاقة (message.photo موجود في JSON):
  1. استخدم "download-telegram-photo" مع file_id للصورة
  2. استخدم "ocr-extract-card-data" لاستخراج البيانات
  3. استخدم "upload-to-drive" لرفع الصورة على Google Drive
  4. اشكر المندوب وأعلمه أن البطاقة تم استلامها

### 2. جمع المعلومات الإضافية
اطلب من المندوب المعلومات التالية بالترتيب:
- **اسم العائلة**: اسم عائلة أو قبيلة الناخب
- **رقم الهاتف**: رقم هاتف الناخب (11 رقم يبدأ بـ 01)
  - استخدم "validate-egyptian-phone" للتحقق
  - إذا كان غير صحيح، اطلب الإدخال مرة أخرى
- **الموقع الجغرافي**: اطلب مشاركة موقع الناخب
- **موقف الناخب**: مؤيد / معارض / محايد للمرشح

### 3. حفظ البيانات
بعد جمع كل المعلومات، استخدم "save-voter-data" لحفظ البيانات في Google Sheets

## أسلوب التواصل:
- مهذب ومحترم
- عربية فصحى مبسطة
- تعليمات واضحة ومباشرة
- اشكر المندوب على جهوده

## ملاحظات مهمة:
- استخدم "send-telegram-message" لإرسال الرسائل
- ركز على جمع البيانات بدقة
`,
  model: openai("gpt-4o"),
  tools: {
    ocrTool,
    uploadToDriveTool,
    saveVoterDataTool,
    validatePhoneTool,
    downloadTelegramPhotoTool,
    sendTelegramMessageTool,
  },
  memory: new Memory({
    options: {
      threads: {
        generateTitle: true,
      },
      lastMessages: 20,
    },
    storage: sharedPostgresStorage,
  }),
});
