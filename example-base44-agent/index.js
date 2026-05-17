import express from 'express';
import { YemotRouter } from 'yemot-router2';
import { fileURLToPath } from 'url';
import process from 'process';

export const app = express();

// --- הגדרות הסוכן ב-Base44 (דרך משתני סביבה, לא בקוד) ---
// BASE44_AGENT_URL  - כתובת ה-API של הסוכן שלך ב-Base44
// BASE44_API_KEY    - מפתח/טוקן לאימות מול Base44 (נשלח ב-Authorization: Bearer)
const BASE44_AGENT_URL = process.env.BASE44_AGENT_URL;
const BASE44_API_KEY = process.env.BASE44_API_KEY;
const AGENT_TIMEOUT_MS = 15000;

export const router = YemotRouter({
    printLog: true,
    defaults: {
        removeInvalidChars: true
    },
    uncaughtErrorHandler: (error, call) => {
        console.log(`[base44-agent] uncaught error in call ${call.callId}: ${error.stack}`);
        return call.id_list_message([{ type: 'text', data: 'אירעה שגיאה, נסו שנית מאוחר יותר' }]);
    }
});

/**
 * שולח את הטקסט שזוהה לסוכן ב-Base44 ומחזיר את תשובת הסוכן (string) או null.
 * ⚠️ מבנה ה-body והתשובה הם הנחת ברירת מחדל - יש להתאים לפי החוזה האמיתי של הסוכן שלך.
 * @param {import('yemot-router2').Call} call
 * @param {string} userText
 * @returns {Promise<string|null>}
 */
async function sendToBase44Agent (call, userText) {
    if (!BASE44_AGENT_URL) {
        console.log('[base44-agent] BASE44_AGENT_URL is not set');
        return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

    try {
        const response = await fetch(BASE44_AGENT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(BASE44_API_KEY ? { Authorization: `Bearer ${BASE44_API_KEY}` } : {})
            },
            body: JSON.stringify({
                message: userText,
                phone: call.phone,
                callId: call.callId
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            console.log(`[base44-agent] agent responded with status ${response.status}`);
            return null;
        }

        const data = await response.json();
        // מתאים את עצמו לכמה צורות תשובה נפוצות - יש לוודא מול החוזה האמיתי
        return data.reply ?? data.message ?? data.output ?? data.text ?? null;
    } catch (error) {
        console.log(`[base44-agent] failed to reach agent: ${error.message}`);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

/** @param {import('yemot-router2').Call} call */
async function callHandler (call) {
    // 1. השמעת ההקלטה 000 (הקובץ 000.wav בשלוחה הנוכחית - ללא סיומת)
    //    + 2. הקלטה והמרה ל-STT (זיהוי הדיבור נעשה בצד ימות, מחזיר טקסט).
    const userText = await call.read([
        { type: 'file', data: '000' }
    ], 'stt');

    console.log(`[base44-agent] call ${call.callId} recognized text: ${userText}`);

    // 3. שליחה לסוכן ב-Base44
    const agentReply = await sendToBase44Agent(call, userText);

    // 4. השמעת תשובת הסוכן (אם חזרה), אחרת הודעת אישור
    return call.id_list_message([{
        type: 'text',
        data: agentReply || 'תודה, פנייתך התקבלה'
    }]);
}

router.get('/', callHandler);

// נדרש כדי לתמוך בבקשות POST (api_url_post=yes)
app.use(express.urlencoded({ extended: true }));
app.use('/', router);

const port = process.env.PORT || 3000;
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    app.listen(port, () => {
        console.log(`example base44-agent line running on port ${port}`);
    });
}
