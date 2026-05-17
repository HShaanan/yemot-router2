import express from 'express';
import { YemotRouter } from 'yemot-router2';
import { fileURLToPath } from 'url';
import process from 'process';

export const app = express();

// --- קונפיג דרך משתני סביבה (לא בקוד) ---
// AGENT_URL   - כתובת ה-API של הסוכן (Base44 וכו')
// AGENT_KEY   - טוקן אימות (נשלח ב-Authorization: Bearer)
const AGENT_URL = process.env.AGENT_URL;
const AGENT_KEY = process.env.AGENT_KEY;
const AGENT_TIMEOUT_MS = 60000;

// שם המוזיקה להמתנה - יש להחליף לשם מוזיקה שקיים במערכת שלך (ראה תיעוד ימות)
const HOLD_MUSIC = process.env.HOLD_MUSIC || 'music1';
const HOLD_MUSIC_SEC = 8;

// שלוחה 1 (לשימוש ב-go_to_folder לחזרה לאותה שלוחה בזמן המתנה)
const EXTENSION = '1';

// מצב חיפוש פעיל לכל שיחה, לפי ApiCallId (קבוע לאורך כל השיחה גם בין כניסות חוזרות לשלוחה)
/** @type {Map<string, {query:string,status:'pending'|'done',results:any[]|null,error:Error|null}>} */
const searches = new Map();

export const router = YemotRouter({
    printLog: true,
    defaults: { removeInvalidChars: true },
    uncaughtErrorHandler: (error, call) => {
        console.log(`[search-agent] uncaught error in call ${call.callId}: ${error.stack}`);
        searches.delete(call.callId);
        return call.id_list_message([{ type: 'text', data: 'אירעה שגיאה, נסו שנית מאוחר יותר' }]);
    }
});

// ניקוי מצב כשמנתקים
router.events.on('call_hangup', (call) => searches.delete(call.callId));

/**
 * קורא לסוכן עם השאילתא ומחזיר מערך תוצאות.
 * ⚠️ מבנה ה-body והתשובה הם הנחת ברירת מחדל - יש להתאים לחוזה האמיתי של הסוכן.
 * @returns {Promise<any[]>}
 */
async function callAgent (query, call) {
    if (!AGENT_URL) throw new Error('AGENT_URL is not set');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
    try {
        const response = await fetch(AGENT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(AGENT_KEY ? { Authorization: `Bearer ${AGENT_KEY}` } : {})
            },
            body: JSON.stringify({ query, phone: call.phone, callId: call.callId }),
            signal: controller.signal
        });
        if (!response.ok) throw new Error(`agent status ${response.status}`);
        const data = await response.json();
        // מתאים את עצמו לכמה צורות תשובה - יש לוודא מול החוזה האמיתי
        const results = data.results ?? data.items ?? data.businesses ?? data.output ?? [];
        return Array.isArray(results) ? results : [];
    } finally {
        clearTimeout(timer);
    }
}

/**
 * הופך תוצאה בודדת לטקסט להקראה.
 * ⚠️ התאם לשדות שהסוכן שלך מחזיר.
 */
function formatResult (result) {
    if (typeof result === 'string') return result;
    const parts = [
        result.name,
        result.city && `ב${result.city}`,
        result.address,
        result.phone && `טלפון ${result.phone}`
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : (result.text || 'תוצאה ללא פרטים');
}

/** הקראת התוצאות אחת-אחת עם ניווט 1/2/3 */
async function presentResults (call, state) {
    const results = state.results;
    let index = 0;

    while (true) {
        const isLast = index === results.length - 1;
        const navText = isLast
            ? 'לשמיעה חוזרת הקישו 1, לחיפוש חדש הקישו 3'
            : 'לשמיעה חוזרת הקישו 1, לתוצאה הבאה הקישו 2, לחיפוש חדש הקישו 3';

        const choice = await call.read([
            { type: 'text', data: `תוצאה ${index + 1} מתוך ${results.length}` },
            { type: 'text', data: formatResult(results[index]) },
            { type: 'text', data: navText }
        ], 'tap', {
            max_digits: 1,
            digits_allowed: isLast ? [1, 3] : [1, 2, 3]
        });

        if (Number(choice) === 1) continue; // השמעה חוזרת של אותה תוצאה
        if (Number(choice) === 2 && !isLast) { index++; continue; }
        if (Number(choice) === 3) { // חיפוש חדש - איפוס וחזרה לתחילת השלוחה
            searches.delete(call.callId);
            return call.restart_ext();
        }
    }
}

/** @param {import('yemot-router2').Call} call */
async function callHandler (call) {
    let state = searches.get(call.callId);

    // כניסה ראשונה: השמעת הקלטה + קליטת שאילתא (עסק/צורך + עיר) בזיהוי דיבור
    if (!state) {
        const query = await call.read([
            { type: 'file', data: '000' }
        ], 'stt');

        state = { query, status: 'pending', results: null, error: null };
        searches.set(call.callId, state);

        // הפעלת החיפוש ברקע (לא ממתינים לו כאן - כדי שנוכל לנגן מוזיקת המתנה)
        (async () => {
            try {
                state.results = await callAgent(query, call);
            } catch (error) {
                state.error = error;
                console.log(`[search-agent] agent failed for call ${call.callId}: ${error.message}`);
            } finally {
                state.status = 'done';
            }
        })();
    }

    // עדיין מחפש: מוזיקת המתנה ואז חזרה אוטומטית לאותה שלוחה (לולאת polling)
    if (state.status === 'pending') {
        return call.id_list_message([
            { type: 'text', data: 'מחפש עבורך, נא להמתין' },
            { type: 'music_on_hold', data: { musicName: HOLD_MUSIC, maxSec: HOLD_MUSIC_SEC } },
            { type: 'go_to_folder', data: `/${call.extension || EXTENSION}` }
        ]);
    }

    // הסתיים - שגיאה / אין תוצאות
    if (state.error || !state.results || state.results.length === 0) {
        const message = state.error ? 'אירעה שגיאה בחיפוש, נסו שנית' : 'לא נמצאו תוצאות עבור הבקשה';
        searches.delete(call.callId);
        return call.id_list_message([{ type: 'text', data: message }]);
    }

    // הסתיים - הקראת התוצאות
    await presentResults(call, state);
}

router.get('/', callHandler);

// נדרש כדי לתמוך בבקשות POST (api_url_post=yes)
app.use(express.urlencoded({ extended: true }));
app.use('/', router);

const port = process.env.PORT || 3000;
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    app.listen(port, () => {
        console.log(`example search-agent line running on port ${port}`);
    });
}
