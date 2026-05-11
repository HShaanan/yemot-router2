import express from 'express';
import { YemotRouter } from 'yemot-router2';
import { fileURLToPath } from 'url';
import process from 'process';
import {
    getCategories,
    getBusinessesByCategory,
    searchBusinessesByName
} from './businesses.js';

export const app = express();

export const router = YemotRouter({
    printLog: true,
    // הכתובות / שמות העסקים עלולים להכיל תווים שימות לא מקריא (נקודה, מקף, גרש וכו') - נסיר אותם בשקט
    defaults: {
        removeInvalidChars: true
    },
    uncaughtErrorHandler: (error, call) => {
        console.log(`[business-search] uncaught error in call ${call.callId} from ${call.phone}: ${error.stack}`);
        return call.id_list_message([{ type: 'text', data: 'אירעה שגיאה, נסו שנית מאוחר יותר' }]);
    }
});

const MAX_RESULTS_SHOWN = 9;

function digitsRange (count) {
    return Array.from({ length: count }, (_, i) => i + 1);
}

function businessesCountPhrase (count) {
    return count === 1 ? 'נמצא עסק אחד' : `נמצאו ${count} עסקים`;
}

/** @param {import('yemot-router2').Call} call */
async function searchByCategory (call) {
    const categories = getCategories();

    const menuMessages = [
        { type: 'text', data: 'לחיפוש לפי תחום, בחרו מהרשימה' },
        ...categories.map((category, index) => ({
            type: 'text',
            data: `לתחום ${category.name}, הקישו ${index + 1}`
        })),
        { type: 'text', data: 'לחזרה לתפריט הראשי, הקישו כוכבית' }
    ];

    const pick = await call.read(menuMessages, 'tap', {
        max_digits: 1,
        digits_allowed: digitsRange(categories.length),
        block_asterisk_key: false
    });

    const category = categories[Number(pick) - 1];
    if (!category) return;

    const results = getBusinessesByCategory(category.id);
    await presentResults(call, results, `בתחום ${category.name}`);
}

/** @param {import('yemot-router2').Call} call */
async function searchByName (call) {
    const query = await call.read([
        { type: 'text', data: 'הקישו את שם העסק באמצעות מקשי הטלפון, ולסיום הקישו סולמית' }
    ], 'tap', {
        typing_playback_mode: 'HebrewKeyboard',
        min_digits: 2
    });

    const results = searchBusinessesByName(query);
    await presentResults(call, results, `עבור החיפוש ${query}`);
}

/**
 * @param {import('yemot-router2').Call} call
 * @param {object[]} results רשימת העסקים שנמצאו
 * @param {string} subject תיאור קצר של מה חיפשנו, להשמעה בכותרת התוצאות
 */
async function presentResults (call, results, subject) {
    if (results.length === 0) {
        await call.read([
            { type: 'text', data: `לא נמצאו עסקים ${subject}` },
            { type: 'text', data: 'לחזרה לתפריט הראשי, הקישו 1' }
        ], 'tap', { max_digits: 1, digits_allowed: [1] });
        return;
    }

    const shown = results.slice(0, MAX_RESULTS_SHOWN);

    while (true) {
        const headerMessages = [];
        if (results.length > MAX_RESULTS_SHOWN) {
            headerMessages.push({ type: 'text', data: `נמצאו ${results.length} עסקים, מוצגים ${shown.length} הראשונים, מומלץ לדייק את החיפוש` });
        } else {
            headerMessages.push({ type: 'text', data: `${businessesCountPhrase(shown.length)} ${subject}` });
        }

        const listMessages = shown.map((business, index) => ({
            type: 'text',
            data: `למידע על ${business.name} ב${business.city}, הקישו ${index + 1}`
        }));

        const pick = await call.read([
            ...headerMessages,
            ...listMessages,
            { type: 'text', data: 'לחזרה לתפריט הראשי, הקישו 0' }
        ], 'tap', {
            max_digits: 1,
            digits_allowed: [0, ...digitsRange(shown.length)]
        });

        if (Number(pick) === 0) return;

        const business = shown[Number(pick) - 1];
        if (!business) continue;

        await businessDetails(call, business);
    }
}

/**
 * @param {import('yemot-router2').Call} call
 * @param {object} business העסק שאת פרטיו נשמיע
 */
async function businessDetails (call, business) {
    while (true) {
        const detailsMessages = [
            { type: 'text', data: `העסק ${business.name}` },
            { type: 'text', data: `נמצא בעיר ${business.city}, ברחוב ${business.address}` },
            { type: 'text', data: `שעות הפעילות: ${business.hours}` },
            { type: 'text', data: 'מספר הטלפון:' },
            { type: 'digits', data: business.phone }
        ];

        // אם הוגדרה פרסומת מוקלטת לעסק - נשמיע אותה אחרי הפרטים
        if (business.audioFile) {
            detailsMessages.push({ type: 'file', data: business.audioFile });
        }

        const pick = await call.read([
            ...detailsMessages,
            { type: 'text', data: 'לשמיעת הפרטים שוב הקישו 1, לחזרה לרשימת התוצאות הקישו 0' }
        ], 'tap', { max_digits: 1, digits_allowed: [0, 1] });

        if (Number(pick) === 0) return;
    }
}

/** @param {import('yemot-router2').Call} call */
async function mainMenu (call) {
    while (true) {
        const choice = await call.read([
            { type: 'text', data: 'ברוכים הבאים לקו חיפוש העסקים של משלנו' },
            { type: 'text', data: 'לחיפוש עסק לפי תחום, הקישו 1' },
            { type: 'text', data: 'לחיפוש עסק לפי שם, הקישו 2' }
        ], 'tap', { max_digits: 1, digits_allowed: [1, 2] });

        if (Number(choice) === 1) {
            await searchByCategory(call);
        } else if (Number(choice) === 2) {
            await searchByName(call);
        }
    }
}

router.get('/', mainMenu);

// נדרש כדי לתמוך בבקשות POST (api_url_post=yes)
app.use(express.urlencoded({ extended: true }));
app.use('/', router);

const port = process.env.PORT || 3000;
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    app.listen(port, () => {
        console.log(`example business-search line running on port ${port}`);
    });
}
