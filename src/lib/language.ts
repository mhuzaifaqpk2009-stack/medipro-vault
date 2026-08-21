export type AppLanguage = { code: string; name: string; nativeName: string; dir?: "ltr" | "rtl" };

export const APP_LANGUAGES: AppLanguage[] = [
  { code: "en", name: "English", nativeName: "English", dir: "ltr" },
  { code: "ur", name: "Urdu", nativeName: "اردو", dir: "rtl" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", dir: "ltr" },
];

type Dict = Record<string, string>;

const D: Record<string, Dict> = {
  ur: {
    Dashboard:"ڈیش بورڈ", "Sales (POS)":"فروخت (POS)", Bills:"بلز", Messages:"پیغامات", Medicines:"ادویات", Inventory:"انوینٹری", Racks:"ریکس", Purchases:"خریداری", Categories:"زمرہ جات", "Pharmacy Operations":"فارمیسی آپریشنز", "Workflow Engine":"ورک فلو انجن", Prescriptions:"نسخے", Suppliers:"سپلائرز", Customers:"گاہک", Calculator:"کیلکولیٹر", "Custom Macros":"حسبِ ضرورت میکروز", Reports:"رپورٹس", Settings:"ترتیبات", Main:"مین", People:"لوگ", Insights:"جائزہ",
    "Sign out":"سائن آؤٹ", "Sign in":"سائن اِن", Add:"شامل کریں", New:"نیا", Edit:"ترمیم", Delete:"حذف کریں", Search:"تلاش", Save:"محفوظ کریں", Cancel:"منسوخ", Open:"کھولیں", Close:"بند کریں", Help:"مدد", Notifications:"اطلاعات", Send:"بھیجیں", Loading:"لوڈ ہو رہا ہے", Yes:"ہاں", No:"نہیں", Back:"واپس", Next:"اگلا", Previous:"پچھلا", Done:"مکمل", Apply:"لاگو کریں", Reset:"ری سیٹ", Clear:"صاف کریں", Select:"منتخب کریں", Selected:"منتخب شدہ", Remove:"ہٹائیں", Update:"اپ ڈیٹ", Create:"بنائیں", View:"دیکھیں", Details:"تفصیلات", Status:"حیثیت", Name:"نام", Generic:"جنیرک", Company:"کمپنی", Barcode:"بارکوڈ", Quantity:"مقدار", Price:"قیمت", Total:"کل", Amount:"رقم", Date:"تاریخ", Time:"وقت", Type:"قسم", Notes:"نوٹس", Description:"تفصیل", Phone:"فون", Email:"ای میل", Address:"پتہ", Country:"ملک", Language:"زبان", English:"انگریزی", Urdu:"اردو", Hindi:"ہندی", Bengali:"بنگالی",
    "Search medicine name":"دوا کا نام تلاش کریں", "Search generic name":"جنیرک نام تلاش کریں", "Search company name":"کمپنی کا نام تلاش کریں", "Search by barcode":"بارکوڈ سے تلاش کریں", "Search by batch":"بیچ سے تلاش کریں", "Voice search":"آواز سے تلاش", "Ready to listen":"سننے کے لیے تیار", "Listening…":"سن رہا ہے…", "Speak naturally. Your words appear below the microphone.":"عام انداز میں بولیں۔ آپ کے الفاظ مائیکروفون کے نیچے ظاہر ہوں گے۔", "Click the microphone to start speaking.":"بولنا شروع کرنے کے لیے مائیکروفون پر کلک کریں۔", "What you say will appear here…":"آپ جو کہیں گے وہ یہاں ظاہر ہوگا…", "Microphone permission was denied.":"مائیکروفون کی اجازت مسترد کر دی گئی ہے۔", "Microphone could not be opened.":"مائیکروفون کھولا نہیں جا سکا۔", "Voice recognition":"آواز کی شناخت",
    Stock:"اسٹاک", "Stock Take":"اسٹاک ٹیک", Reorder:"دوبارہ آرڈر", Returns:"واپسی", Overview:"جائزہ", "What's New":"نیا کیا ہے", "New Medicine":"نئی دوا", "New Customer":"نیا گاہک", "New Supplier":"نیا سپلائر", "New Purchase":"نئی خریداری", "Simple Purchase":"سادہ خریداری", "Purchase Cycle":"خریداری سائیکل", "Low Stock":"کم اسٹاک", Expired:"میعاد ختم", "Near Expiry":"میعاد قریب", Batch:"بیچ", Expiry:"میعاد", Supplier:"سپلائر", Customer:"گاہک", Payment:"ادائیگی", Paid:"ادا شدہ", Unpaid:"غیر ادا شدہ", Pending:"زیر التوا", Discount:"رعایت", Tax:"ٹیکس", Profit:"منافع", Sale:"فروخت", Purchase:"خریداری", Return:"واپسی", Invoice:"انوائس", Receipt:"رسید", Cash:"نقد", Credit:"ادھار", Card:"کارڈ", "Cash Drawer":"کیش دراز", Expenses:"اخراجات", "Audit Log":"آڈٹ لاگ", Users:"صارفین", Permissions:"اجازتیں", Backup:"بیک اپ", Restore:"بحال کریں", Print:"پرنٹ", Export:"ایکسپورٹ", Import:"امپورٹ", "Are you sure?":"کیا آپ واقعی ایسا کرنا چاہتے ہیں؟", "No results found":"کوئی نتیجہ نہیں ملا", "Something went wrong.":"کچھ غلط ہو گیا۔", "Try again":"دوبارہ کوشش کریں"
  },
  hi: {
    Dashboard:"डैशबोर्ड", "Sales (POS)":"बिक्री (POS)", Bills:"बिल", Messages:"संदेश", Medicines:"दवाइयाँ", Inventory:"इन्वेंटरी", Racks:"रैक", Purchases:"खरीदारी", Categories:"श्रेणियाँ", "Pharmacy Operations":"फार्मेसी संचालन", "Workflow Engine":"वर्कफ़्लो इंजन", Prescriptions:"प्रिस्क्रिप्शन", Suppliers:"सप्लायर", Customers:"ग्राहक", Calculator:"कैलकुलेटर", "Custom Macros":"कस्टम मैक्रोज़", Reports:"रिपोर्ट", Settings:"सेटिंग्स", Main:"मुख्य", People:"लोग", Insights:"अवलोकन",
    "Sign out":"साइन आउट", "Sign in":"साइन इन", Add:"जोड़ें", New:"नया", Edit:"संपादित करें", Delete:"हटाएँ", Search:"खोजें", Save:"सहेजें", Cancel:"रद्द करें", Open:"खोलें", Close:"बंद करें", Help:"मदद", Notifications:"सूचनाएँ", Send:"भेजें", Loading:"लोड हो रहा है", Yes:"हाँ", No:"नहीं", Back:"वापस", Next:"अगला", Previous:"पिछला", Done:"पूर्ण", Apply:"लागू करें", Reset:"रीसेट", Clear:"साफ़ करें", Select:"चुनें", Selected:"चयनित", Remove:"हटाएँ", Update:"अपडेट", Create:"बनाएँ", View:"देखें", Details:"विवरण", Status:"स्थिति", Name:"नाम", Generic:"जेनेरिक", Company:"कंपनी", Barcode:"बारकोड", Quantity:"मात्रा", Price:"कीमत", Total:"कुल", Amount:"राशि", Date:"तारीख", Time:"समय", Type:"प्रकार", Notes:"नोट्स", Description:"विवरण", Phone:"फ़ोन", Email:"ईमेल", Address:"पता", Country:"देश", Language:"भाषा", English:"अंग्रेज़ी", Urdu:"उर्दू", Hindi:"हिंदी", Bengali:"बंगाली",
    "Search medicine name":"दवा का नाम खोजें", "Search generic name":"जेनेरिक नाम खोजें", "Search company name":"कंपनी का नाम खोजें", "Search by barcode":"बारकोड से खोजें", "Search by batch":"बैच से खोजें", "Voice search":"आवाज़ से खोजें", "Ready to listen":"सुनने के लिए तैयार", "Listening…":"सुन रहा है…", "Speak naturally. Your words appear below the microphone.":"स्वाभाविक रूप से बोलें। आपके शब्द माइक्रोफ़ोन के नीचे दिखाई देंगे।", "Click the microphone to start speaking.":"बोलना शुरू करने के लिए माइक्रोफ़ोन पर क्लिक करें।", "What you say will appear here…":"आप जो कहेंगे वह यहाँ दिखाई देगा…", "Microphone permission was denied.":"माइक्रोफ़ोन की अनुमति अस्वीकार कर दी गई है।", "Microphone could not be opened.":"माइक्रोफ़ोन नहीं खोला जा सका।", "Voice recognition":"आवाज़ पहचान",
    Stock:"स्टॉक", "Stock Take":"स्टॉक गणना", Reorder:"पुनः ऑर्डर", Returns:"रिटर्न", Overview:"अवलोकन", "What's New":"नया क्या है", "New Medicine":"नई दवा", "New Customer":"नया ग्राहक", "New Supplier":"नया सप्लायर", "New Purchase":"नई खरीदारी", "Simple Purchase":"सरल खरीदारी", "Purchase Cycle":"खरीद चक्र", "Low Stock":"कम स्टॉक", Expired:"समाप्त", "Near Expiry":"समाप्ति के करीब", Batch:"बैच", Expiry:"समाप्ति", Supplier:"सप्लायर", Customer:"ग्राहक", Payment:"भुगतान", Paid:"भुगतान किया गया", Unpaid:"भुगतान नहीं किया गया", Pending:"लंबित", Discount:"छूट", Tax:"टैक्स", Profit:"लाभ", Sale:"बिक्री", Purchase:"खरीदारी", Return:"वापसी", Invoice:"चालान", Receipt:"रसीद", Cash:"नकद", Credit:"उधार", Card:"कार्ड", "Cash Drawer":"कैश ड्रॉअर", Expenses:"खर्च", "Audit Log":"ऑडिट लॉग", Users:"उपयोगकर्ता", Permissions:"अनुमतियाँ", Backup:"बैकअप", Restore:"पुनर्स्थापित करें", Print:"प्रिंट", Export:"निर्यात", Import:"आयात", "Are you sure?":"क्या आप निश्चित हैं?", "No results found":"कोई परिणाम नहीं मिला", "Something went wrong.":"कुछ गलत हो गया।", "Try again":"फिर से कोशिश करें"
  },
  bn: {
    Dashboard:"ড্যাশবোর্ড", "Sales (POS)":"বিক্রয় (POS)", Bills:"বিল", Messages:"বার্তা", Medicines:"ওষুধ", Inventory:"ইনভেন্টরি", Racks:"র‍্যাক", Purchases:"ক্রয়", Categories:"বিভাগ", "Pharmacy Operations":"ফার্মেসি কার্যক্রম", "Workflow Engine":"ওয়ার্কফ্লো ইঞ্জিন", Prescriptions:"প্রেসক্রিপশন", Suppliers:"সরবরাহকারী", Customers:"গ্রাহক", Calculator:"ক্যালকুলেটর", "Custom Macros":"কাস্টম ম্যাক্রো", Reports:"রিপোর্ট", Settings:"সেটিংস", Main:"প্রধান", People:"মানুষ", Insights:"পর্যালোচনা",
    "Sign out":"সাইন আউট", "Sign in":"সাইন ইন", Add:"যোগ করুন", New:"নতুন", Edit:"সম্পাদনা", Delete:"মুছুন", Search:"অনুসন্ধান", Save:"সংরক্ষণ", Cancel:"বাতিল", Open:"খুলুন", Close:"বন্ধ করুন", Help:"সহায়তা", Notifications:"বিজ্ঞপ্তি", Send:"পাঠান", Loading:"লোড হচ্ছে", Yes:"হ্যাঁ", No:"না", Back:"ফিরে যান", Next:"পরবর্তী", Previous:"পূর্ববর্তী", Done:"সম্পন্ন", Apply:"প্রয়োগ করুন", Reset:"রিসেট", Clear:"পরিষ্কার করুন", Select:"নির্বাচন করুন", Selected:"নির্বাচিত", Remove:"সরান", Update:"আপডেট", Create:"তৈরি করুন", View:"দেখুন", Details:"বিস্তারিত", Status:"অবস্থা", Name:"নাম", Generic:"জেনেরিক", Company:"কোম্পানি", Barcode:"বারকোড", Quantity:"পরিমাণ", Price:"মূল্য", Total:"মোট", Amount:"পরিমাণ", Date:"তারিখ", Time:"সময়", Type:"ধরন", Notes:"নোট", Description:"বিবরণ", Phone:"ফোন", Email:"ইমেইল", Address:"ঠিকানা", Country:"দেশ", Language:"ভাষা", English:"ইংরেজি", Urdu:"উর্দু", Hindi:"হিন্দি", Bengali:"বাংলা",
    "Search medicine name":"ওষুধের নাম অনুসন্ধান করুন", "Search generic name":"জেনেরিক নাম অনুসন্ধান করুন", "Search company name":"কোম্পানির নাম অনুসন্ধান করুন", "Search by barcode":"বারকোড দিয়ে অনুসন্ধান করুন", "Search by batch":"ব্যাচ দিয়ে অনুসন্ধান করুন", "Voice search":"ভয়েস অনুসন্ধান", "Ready to listen":"শোনার জন্য প্রস্তুত", "Listening…":"শোনা হচ্ছে…", "Speak naturally. Your words appear below the microphone.":"স্বাভাবিকভাবে বলুন। আপনার কথা মাইক্রোফোনের নিচে দেখা যাবে।", "Click the microphone to start speaking.":"কথা বলা শুরু করতে মাইক্রোফোনে ক্লিক করুন।", "What you say will appear here…":"আপনি যা বলবেন তা এখানে দেখা যাবে…", "Microphone permission was denied.":"মাইক্রোফোনের অনুমতি প্রত্যাখ্যান করা হয়েছে।", "Microphone could not be opened.":"মাইক্রোফোন খোলা যায়নি।", "Voice recognition":"ভয়েস শনাক্তকরণ",
    Stock:"স্টক", "Stock Take":"স্টক গণনা", Reorder:"পুনরায় অর্ডার", Returns:"ফেরত", Overview:"সারসংক্ষেপ", "What's New":"নতুন কী", "New Medicine":"নতুন ওষুধ", "New Customer":"নতুন গ্রাহক", "New Supplier":"নতুন সরবরাহকারী", "New Purchase":"নতুন ক্রয়", "Simple Purchase":"সাধারণ ক্রয়", "Purchase Cycle":"ক্রয় চক্র", "Low Stock":"কম স্টক", Expired:"মেয়াদ শেষ", "Near Expiry":"মেয়াদ শেষের কাছাকাছি", Batch:"ব্যাচ", Expiry:"মেয়াদ", Supplier:"সরবরাহকারী", Customer:"গ্রাহক", Payment:"পেমেন্ট", Paid:"পরিশোধিত", Unpaid:"অপরিশোধিত", Pending:"অপেক্ষমাণ", Discount:"ছাড়", Tax:"কর", Profit:"লাভ", Sale:"বিক্রয়", Purchase:"ক্রয়", Return:"ফেরত", Invoice:"চালান", Receipt:"রসিদ", Cash:"নগদ", Credit:"বাকি", Card:"কার্ড", "Cash Drawer":"ক্যাশ ড্রয়ার", Expenses:"খরচ", "Audit Log":"অডিট লগ", Users:"ব্যবহারকারী", Permissions:"অনুমতি", Backup:"ব্যাকআপ", Restore:"পুনরুদ্ধার", Print:"প্রিন্ট", Export:"রপ্তানি", Import:"আমদানি", "Are you sure?":"আপনি কি নিশ্চিত?", "No results found":"কোনো ফলাফল পাওয়া যায়নি", "Something went wrong.":"কিছু ভুল হয়েছে।", "Try again":"আবার চেষ্টা করুন"
  },
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function getLanguage() {
  const stored = localStorage.getItem("medicore.language") || "en";
  return APP_LANGUAGES.some((lang) => lang.code === stored) ? stored : "en";
}

export function setLanguage(code: string) {
  const lang = APP_LANGUAGES.find((item) => item.code === code) || APP_LANGUAGES[0];
  localStorage.setItem("medicore.language", lang.code);
  document.documentElement.lang = lang.code;
  document.documentElement.dir = lang.dir || "ltr";
  document.documentElement.dataset.languageDir = lang.dir || "ltr";
  window.dispatchEvent(new CustomEvent("medicore:language-change", { detail: lang.code }));
}

export function translateText(text: string, code = getLanguage()) {
  if (code === "en") return text;
  const dict = D[code];
  if (!dict) return text;
  const keys = Object.keys(dict).sort((a, b) => b.length - a.length).map(escapeRegExp);
  if (!keys.length) return text;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}_])(${keys.join("|")})(?=$|[^\\p{L}\\p{N}_])`, "gu");
  return text.replace(re, (_match, prefix: string, key: string) => `${prefix}${dict[key] ?? key}`);
}

const originals = new WeakMap<Text, string>();
const originalAttrs = new WeakMap<Element, Record<string, string>>();
const ATTRS = ["placeholder", "title", "aria-label"] as const;

export function installLanguageObserver() {
  const apply = () => {
    const code = getLanguage();
    const lang = APP_LANGUAGES.find((item) => item.code === code) || APP_LANGUAGES[0];
    document.documentElement.lang = lang.code;
    document.documentElement.dir = lang.dir || "ltr";
    document.documentElement.dataset.languageDir = lang.dir || "ltr";
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) nodes.push(node as Text);
    for (const textNode of nodes) {
      if (!originals.has(textNode)) originals.set(textNode, textNode.nodeValue || "");
      const original = originals.get(textNode) || "";
      if (!original.trim() || original.length > 500) continue;
      textNode.nodeValue = translateText(original, code);
    }
    document.querySelectorAll<HTMLElement>("*").forEach((element) => {
      const saved = originalAttrs.get(element) || {};
      for (const attr of ATTRS) {
        const value = element.getAttribute(attr);
        if (value !== null && saved[attr] === undefined) saved[attr] = value;
        const original = saved[attr];
        if (original !== undefined) element.setAttribute(attr, translateText(original, code));
      }
      if (Object.keys(saved).length) originalAttrs.set(element, saved);
    });
  };
  const observer = new MutationObserver(() => {
    if ((window as any).__medicoreLangBusy) return;
    (window as any).__medicoreLangBusy = true;
    requestAnimationFrame(() => { try { apply(); } finally { (window as any).__medicoreLangBusy = false; } });
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: [...ATTRS] });
  apply();
  return () => observer.disconnect();
}
