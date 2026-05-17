// "מאגר" עסקים לדוגמה עבור קו חיפוש העסקים של "משלנו".
//
// כאן הנתונים קבועים בקוד לצורך הדוגמה. בקו אמיתי יש להחליף את הפונקציות
// שבתחתית הקובץ בקריאות למסד נתונים / API חיצוני (למשל fetch למאגר העסקים).
// מומלץ להפוך אותן ל-async ולהוסיף await בצד הקורא ב-index.js.

export const categories = [
    { id: 1, name: 'מוצרי חשמל' },
    { id: 2, name: 'מזון ומכולת' },
    { id: 3, name: 'הסעות ותחבורה' },
    { id: 4, name: 'שיפוצים ובנייה' },
    { id: 5, name: 'מחשבים וטלפונים' },
    { id: 6, name: 'גמחים' }
];

export const businesses = [
    {
        id: 101,
        name: 'אלקטרו דוד מוצרי חשמל',
        categoryId: 1,
        city: 'בני ברק',
        phone: '0501112233',
        address: 'רבי עקיבא 50',
        hours: 'ימים ראשון עד חמישי משעה תשע בבוקר עד שמונה בערב',
        // אם לעסק יש פרסומת מוקלטת בשלוחה - אפשר לציין את הנתיב כאן והוא יושמע במקום הקראת הפרטים
        audioFile: null
    },
    {
        id: 102,
        name: 'מאור החשמל',
        categoryId: 1,
        city: 'ירושלים',
        phone: '0502223344',
        address: 'מלכי ישראל 30',
        hours: 'ימים ראשון עד חמישי משעה עשר בבוקר עד שבע בערב',
        audioFile: null
    },
    {
        id: 201,
        name: 'מכולת הברכה',
        categoryId: 2,
        city: 'מודיעין עילית',
        phone: '0503334455',
        address: 'נתיבות המשפט 12',
        hours: 'פתוח כל יום משעה שבע בבוקר עד אחת עשרה בלילה',
        audioFile: null
    },
    {
        id: 202,
        name: 'סופר משלנו',
        categoryId: 2,
        city: 'אלעד',
        phone: '0504445566',
        address: 'רבי יהודה הנשיא 8',
        hours: 'ימים ראשון עד חמישי משעה שמונה בבוקר עד עשר בלילה',
        audioFile: null
    },
    {
        id: 301,
        name: 'הסעות אהרון',
        categoryId: 3,
        city: 'בני ברק',
        phone: '0505556677',
        address: 'הרב כהנמן 25',
        hours: 'זמין בכל שעות היממה בהזמנה מראש',
        audioFile: null
    },
    {
        id: 302,
        name: 'מוניות הדרך הבטוחה',
        categoryId: 3,
        city: 'ביתר עילית',
        phone: '0506667788',
        address: 'המגיד ממעזריטש 4',
        hours: 'זמין כל היום',
        audioFile: null
    },
    {
        id: 401,
        name: 'שיפוצי הזהב',
        categoryId: 4,
        city: 'ירושלים',
        phone: '0507778899',
        address: 'בר אילן 18',
        hours: 'ימים ראשון עד חמישי משעה שבע בבוקר עד חמש אחר הצהריים',
        audioFile: null
    },
    {
        id: 501,
        name: 'מחשבי כשרים',
        categoryId: 5,
        city: 'בני ברק',
        phone: '0508889900',
        address: 'חזון איש 40',
        hours: 'ימים ראשון עד חמישי משעה תשע בבוקר עד שש בערב',
        audioFile: null
    },
    {
        id: 601,
        name: 'גמח כלי עבודה',
        categoryId: 6,
        city: 'מודיעין עילית',
        phone: '0509990011',
        address: 'רשבי 3',
        hours: 'ימים ראשון עד חמישי משעה שמונה בבוקר עד עשר בבוקר ובערב משש עד תשע',
        audioFile: null
    }
];

export function getCategories () {
    return categories;
}

export function getCategoryById (categoryId) {
    return categories.find((category) => category.id === categoryId) ?? null;
}

export function getBusinessesByCategory (categoryId) {
    return businesses.filter((business) => business.categoryId === categoryId);
}

export function searchBusinessesByName (query) {
    const normalized = String(query).trim();
    if (!normalized) return [];
    return businesses.filter((business) => business.name.includes(normalized));
}

export function getBusinessById (businessId) {
    return businesses.find((business) => business.id === businessId) ?? null;
}
