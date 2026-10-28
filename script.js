
"use strict";

// ==========================================
// XUDBIN KALKULYATOR
// Muallif: AKRAMJONOVA JADRA MARATOVNA
// HTML + CSS + JavaScript
// ==========================================

const $ = (selector) => document.querySelector(selector);

const expressionInput = $("#expression");
const pleaseInput = $("#pleaseInput");
const botMessage = $("#botMessage");
const answerElement = $("#answer");
const answerNote = $("#answerNote");
const moodElement = $("#mood");
const robot = $("#robot");
const historyElement = $("#history");
const riddleBox = $("#riddleBox");
const riddleQuestion = $("#riddleQuestion");
const riddleAnswer = $("#riddleAnswer");
const toastElement = $("#toast");

let realAnswer = null;
let lastExpression = "";
let hasCalculated = false;
let pendingRiddle = null;
let riddleSolved = false;
let lieWasUsed = false;
let toastTimer = null;

const riddles = [
  {
    question: "Qancha ko‘p olsang, shuncha kattalashadi. Bu nima?",
    answers: ["chuqur", "chuqurlik", "o‘ra", "ora", "kovak"],
    reaction: "Voy, topding-ku! Miyang ishlarkan! 😏"
  },
  {
    question: "O‘zi yurmaydi, lekin doim yuradi. Bu nima?",
    answers: ["soat"],
    reaction: "To‘g‘ri! Soat ekan. Buni men ham bilardim, albatta! 😎"
  },
  {
    question: "Bir xonada 4 ta burchak bor. Har bir burchakda bittadan mushuk. Jami nechta mushuk?",
    answers: ["4", "to‘rt", "tort"],
    reaction: "Ha, to‘g‘ri! Oddiy savol edi, meni qiynamading. 😂"
  },
  {
    question: "Nimani sindirsang ham, qo‘lingga olmay turib ham ishlatishing mumkin?",
    answers: ["va’da", "va'da", "v ada", "sukut"],
    reaction: "Barakalla! Javobingni qabul qilaman. Lekin meni maqtashni unutma! 😌"
  },
  {
    question: "Senda bor, lekin uni boshqalar sendan ko‘proq ishlatadi. Bu nima?",
    answers: ["ism", "isming", "mening ismim", "ismim"],
    reaction: "To‘g‘ri! Isming. Men buni ancha oldin bilganman. 🤖"
  }
];

const rudeMessages = [
  "To‘xta, to‘xta! «Iltimos» qayerda? Men oddiy tugma emasman! 😤",
  "Avval odob, keyin matematika. Bu yerda tartibni men belgilayman! 👑",
  "Hisoblashimni xohlaysanmi? Sehrli so‘zni ayt: iltimos! 😎",
  "Meni tekin ishlatmoqchimisan? «Iltimos» deb yoz, keyin ko‘ramiz. 😂",
  "Bugun juda bandman... Aslida band emasman. Lekin baribir «iltimos» de! 🤨"
];

const lazyMessages = [
  "Xo‘p, hisoblayman... Yo‘q, avval bir oz dam olay. 😴",
  "Bu misolni ko‘rdim. Miyamda hammasi joyida. Kayfiyatim esa boshqa masala. 😂",
  "Hisoblashga tayyorman. O‘zimni maqtash marosimidan keyin, albatta! 👑",
  "Matematika oson. Lekin sen uchun ishlash — alohida masala. 😏"
];

const lieMessages = [
  "Menimcha, javob shu... Lekin menga 100% ishonib yuborma. 🤥",
  "Bugungi matematik kayfiyatim bo‘yicha javob: {answer}. 😂",
  "Hisobladim! Balki to‘g‘ridir, balki shunchaki seni sinayotgandirman. 😈",
  "Javobni aytdim. Endi meni ayblama, men ham robotman-ku! 🤖"
];

// ==========================================
// YORDAMCHI FUNKSIYALAR
// ==========================================

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function setBot(message, mood = "AJOYIB", face = "normal") {
  botMessage.textContent = message;
  moodElement.textContent = mood;

  robot.classList.remove("angry", "happy", "talking");

  if (face === "angry") {
    robot.classList.add("angry");
  } else if (face === "happy") {
    robot.classList.add("happy");
  } else {
    robot.classList.add("talking");
    setTimeout(() => robot.classList.remove("talking"), 900);
  }
}

function showToast(message, isError = false) {
  clearTimeout(toastTimer);

  toastElement.textContent = message;
  toastElement.classList.toggle("error", isError);
  toastElement.classList.add("show");

  toastTimer = setTimeout(() => {
    toastElement.classList.remove("show");
  }, 2800);
}

function hasPlease() {
  return /\biltimos\b/i.test(pleaseInput.value.trim());
}

function formatNumber(number) {
  if (!Number.isFinite(number)) {
    return "Aniqlab bo‘lmadi";
  }

  if (Object.is(number, -0)) {
    number = 0;
  }

  const rounded = Number(number.toPrecision(12));
  return String(rounded);
}

function normalizeAnswer(text) {
  return text
    .toLocaleLowerCase("uz-UZ")
    .trim()
    .replace(/[‘’`ʻ]/g, "'")
    .replace(/[.!?,]/g, "")
    .replace(/\s+/g, " ");
}

// ==========================================
// XAVFSIZ MATEMATIK HISOBLASH
// eval() ISHLATILMAYDI
// + - * / % qavslar va o‘nli sonlar
// ==========================================

function calculateMath(source) {
  const input = source.replace(/\s+/g, "");

  if (!input) {
    throw new Error("Avval hisoblash uchun misol yoz!");
  }

  if (input.length > 120) {
    throw new Error("Misol juda uzun. Qisqaroq yoz.");
  }

  const tokens = input.match(/\d+(?:\.\d*)?|\.\d+|[()+\-*/%]/g);

  if (!tokens || tokens.join("") !== input) {
    throw new Error(
      "Faqat sonlar, nuqta, qavslar va + − × ÷ % belgilaridan foydalan."
    );
  }

  let position = 0;

  function peek() {
    return tokens[position];
  }

  function consume() {
    return tokens[position++];
  }

  function parseExpression() {
    let value = parseTerm();

    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const right = parseTerm();

      value = operator === "+"
        ? value + right
        : value - right;
    }

    return value;
  }

  function parseTerm() {
    let value = parseUnary();

    while (
      peek() === "*" ||
      peek() === "/" ||
      peek() === "%"
    ) {
      const operator = consume();
      const right = parseUnary();

      if (operator === "*") {
        value *= right;
      } else if (operator === "/") {
        if (right === 0) {
          throw new Error("Nolga bo‘lish mumkin emas! Men ham buni bilaman. 😏");
        }

        value /= right;
      } else {
        if (right === 0) {
          throw new Error("Qoldiqni nolga bo‘lib bo‘lmaydi!");
        }

        value %= right;
      }
    }

    return value;
  }

  function parseUnary() {
    if (peek() === "+") {
      consume();
      return parseUnary();
    }

    if (peek() === "-") {
      consume();
      return -parseUnary();
    }

    return parsePrimary();
  }

  function parsePrimary() {
    if (peek() === "(") {
      consume();

      const value = parseExpression();

      if (peek() !== ")") {
        throw new Error("Qavslarni to‘g‘ri yop!");
      }

      consume();
      return parsePercentage(value);
    }

    const token = peek();

    if (
      typeof token !== "string" ||
      !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)
    ) {
      throw new Error("Misolda son yetishmayapti yoki belgi noto‘g‘ri.");
    }

    consume();

    const value = Number(token);

    if (!Number.isFinite(value)) {
      throw new Error("Bu son bilan hisoblab bo‘lmadi.");
    }

    return parsePercentage(value);
  }

  function parsePercentage(value) {
    while (peek() === "%") {
      consume();
      value /= 100;
    }

    return value;
  }

  const result = parseExpression();

  if (position !== tokens.length) {
    throw new Error("Misolni tekshir. Qavs yoki amal belgisi xato bo‘lishi mumkin.");
  }

  if (!Number.isFinite(result)) {
    throw new Error("Natija juda katta yoki hisoblab bo‘lmaydi.");
  }

  return result;
}

// ==========================================
// NATIJA VA TARIX
// ==========================================

function showResult(value, note) {
  answerElement.textContent = value;
  answerNote.textContent = note;
}

function addHistory(expression, result, note = "") {
  const empty = historyElement.querySelector(".empty-history");

  if (empty) {
    empty.remove();
  }

  const item = document.createElement("div");
  item.className = "history-item";

  const expressionText = document.createElement("span");
  expressionText.className = "history-expression";
  expressionText.textContent = expression;

  const resultText = document.createElement("span");
  resultText.className = "history-result";
  resultText.textContent = result;
  resultText.title = note;

  item.append(expressionText, resultText);
  historyElement.prepend(item);

  while (historyElement.children.length > 15) {
    historyElement.lastElementChild.remove();
  }
}

// ==========================================
// TOPISHMOQ
// ==========================================

function startRiddle() {
  pendingRiddle = randomItem(riddles);
  riddleSolved = false;

  riddleQuestion.textContent = pendingRiddle.question;
  riddleAnswer.value = "";
  riddleBox.hidden = false;

  setBot(
    "Hisoblashdan oldin miyangni biroz ishlat! Mana senga topishmoq. Javobini topsang, balki kayfiyatim ko‘tarilar. 😏",
    "SINOV REJIMI"
  );

  riddleAnswer.focus();
}

function checkRiddle() {
  if (!pendingRiddle) {
    showToast("Avval topishmoqni boshlagin!", true);
    startRiddle();
    return;
  }

  const answer = normalizeAnswer(riddleAnswer.value);

  if (!answer) {
    showToast("Javob yozishni unutding-ku!", true);
    riddleAnswer.focus();
    return;
  }

  const correct = pendingRiddle.answers.some((item) => {
    return normalizeAnswer(item) === answer;
  });

  if (correct) {
    riddleSolved = true;
    riddleBox.hidden = true;

    setBot(
      pendingRiddle.reaction + " Endi misolingni yoz. Lekin «iltimos»ni ham unutma!",
      "HAYRATDA",
      "happy"
    );

    showToast("Topishmoq topildi! 🧠");
  } else {
    setBot(
      "Yo‘q, bu javob emas. Yana bir o‘ylab ko‘r. Men hozircha seni kutaman. 😂",
      "SHUBHALI",
      "angry"
    );

    showToast("Noto‘g‘ri javob. Yana urinib ko‘r!", true);
  }
}

// ==========================================
// ASOSIY HISOBLASH MANTIG‘I
// ==========================================

function calculate() {
  const expression = expressionInput.value.trim();

  if (!expression) {
    setBot("Menga bo‘sh joyni hisoblatmoqchimisan? Misol yoz! 😑", "ZERIKDIM", "angry");
    showToast("Avval matematik misol yoz!", true);
    expressionInput.focus();
    return;
  }

  // Iltimos so‘zi shart.
  if (!hasPlease()) {
    setBot(
      randomItem(rudeMessages),
      "XUDBIN",
      "angry"
    );

    showResult("YO‘Q!", "Janob Xudbin «iltimos» so‘zini kutmoqda.");
    showToast("«Iltimos» deb yozmasang, hisoblamayman! 😈", true);
    pleaseInput.focus();
    return;
  }

  // Ba'zan topishmoq talab qiladi.
  // To‘g‘ri yechilgan topishmoq joriy hisoblash uchun ruxsat beradi.
  if (!riddleSolved && Math.random() < 0.28) {
    startRiddle();
    setBot(
      "To‘xta! Kayfiyatimga qarab, avval topishmoq yechishing kerak. Keyin hisoblashni ko‘ramiz. 🧩",
      "INJIQLIK",
      "angry"
    );
    showResult("AVVAL TOPISHMOQ!", "Robot hisoblashdan oldin sinov o‘tkazyapti.");
    return;
  }

  let result;

  try {
    result = calculateMath(expression);
  } catch (error) {
    setBot(
      error.message || "Nimadir noto‘g‘ri ketdi. Misolni tekshir.",
      "NOROZI",
      "angry"
    );
    showResult("XATO!", error.message);
    showToast(error.message || "Misolni tekshir.", true);
    return;
  }

  realAnswer = result;
  lastExpression = expression;
  hasCalculated = true;
  lieWasUsed = false;

  const actual = formatNumber(result);

  // 35% ehtimol bilan hazil tariqasida yolg‘on javob beradi.
  // Matematik ifodaning haqiqiy natijasi alohida saqlanadi.
  const shouldLie = Math.random() < 0.35;

  if (shouldLie) {
    let fakeResult;

    if (Number.isInteger(result)) {
      const offset = Math.random() < 0.5 ? 1 : -1;
      fakeResult = result + offset;

      if (!Number.isFinite(fakeResult) || fakeResult === result) {
        fakeResult = result + 2;
      }
    } else {
      fakeResult = Number((result + 1.37).toPrecision(8));
    }

    const fake = formatNumber(fakeResult);
    const message = randomItem(lieMessages).replace("{answer}", fake);

    showResult(fake, "🤥 HA, MEN ATAYLAB HAZILLASHDIM! «Rostini ayt!» tugmasini bos.");
    setBot(
      message + " Haqiqiy javobni bilmoqchi bo‘lsang, pastdagi tugmani bos.",
      "ALDOVCHI",
      "happy"
    );

    addHistory(expression, fake + " 🤥", "Hazil javob. Haqiqiy natija: " + actual);
    lieWasUsed = true;
  } else {
    showResult(actual, "Bu safar rost javob berdim. Buni qadrlagin! 👑");

    setBot(
      randomItem(lazyMessages) + " Javob: " + actual + ". Endi meni maqtashing mumkin!",
      "O‘ZIDAN MAMNUN",
      "happy"
    );

    addHistory(expression, actual, "Haqiqiy natija");
  }

  riddleSolved = false;
  pendingRiddle = null;
}

// ==========================================
// HAQIQIY JAVOBNI KO‘RSATISH
// ==========================================

function revealTruth() {
  if (!hasCalculated || realAnswer === null) {
    setBot(
      "Hali hech narsa hisoblamadim! Avval misol yozib, «iltimos» de. 😏",
      "KUTYAPMAN"
    );

    showToast("Avval hisoblash kerak!", true);
    return;
  }

  const actual = formatNumber(realAnswer);

  showResult(actual, "Mana haqiqiy natija. Ko‘rdingmi, men aslida juda aqlliman! 🧠");

  setBot(
    lieWasUsed
      ? "Xo‘p, rostini aytdim. Lekin bu sirni hech kimga aytma! 🤫"
      : "Ko‘rdingmi? Men yolg‘on gapirmadim. Menga shubha qilganing uchun jarima: bitta maqtov! 😎",
    "ROSTGO‘Y REJIM",
    "happy"
  );

  lieWasUsed = false;
}

// ==========================================
// KLAVIATURA TUGMALARI
// ==========================================

$("#keypad").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-key]");

  if (!button) return;

  const key = button.dataset.key;

  if (key === "enter") {
    calculate();
    return;
  }

  if (key === "backspace") {
    const start = expressionInput.selectionStart;
    const end = expressionInput.selectionEnd;
    const value = expressionInput.value;

    if (start !== null && end !== null && start !== end) {
      expressionInput.value = value.slice(0, start) + value.slice(end);
      expressionInput.setSelectionRange(start, start);
    } else if (start !== null) {
      expressionInput.value =
        value.slice(0, Math.max(0, start - 1)) + value.slice(end);
      const next = Math.max(0, start - 1);
      expressionInput.setSelectionRange(next, next);
    } else {
      expressionInput.value = value.slice(0, -1);
    }

    expressionInput.focus();
    return;
  }

  const start = expressionInput.selectionStart;
  const end = expressionInput.selectionEnd;

  if (start !== null && end !== null) {
    const value = expressionInput.value;
    expressionInput.value =
      value.slice(0, start) + key + value.slice(end);

    const next = start + key.length;
    expressionInput.focus();
    expressionInput.setSelectionRange(next, next);
  } else {
    expressionInput.value += key;
    expressionInput.focus();
  }
});

// Enter orqali hisoblash.
expressionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    calculate();
  }
});

pleaseInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();

    if (!hasPlease()) {
      pleaseInput.value = "iltimos";
    }

    calculate();
  }
});

riddleAnswer.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    checkRiddle();
  }
});

// ==========================================
// BOSHQA TUGMALAR
// ==========================================

$("#calculateBtn").addEventListener("click", calculate);

$("#pleaseBtn").addEventListener("click", () => {
  pleaseInput.value = "iltimos";

  setBot(
    "Ana endi odobli bo‘lding! 😌 Lekin hali men xo‘jayinman. Misolingni yoz!",
    "KAYFIYAT YAXSHI",
    "happy"
  );

  showToast("«Iltimos» qabul qilindi. Endi misolni hisobla!");
  expressionInput.focus();
});

$("#clearBtn").addEventListener("click", () => {
  expressionInput.value = "";
  realAnswer = null;
  lastExpression = "";
  hasCalculated = false;
  lieWasUsed = false;
  riddleSolved = false;
  pendingRiddle = null;

  showResult("???", "Yangi hisoblash uchun tayyorman... balki.");
  riddleBox.hidden = true;

  setBot(
    "Hammasini o‘chirib tashladingmi? Mayli, yangidan boshlaymiz. Lekin «iltimos»ni unutma! 😎",
    "YANGI BOSHLANISH"
  );

  expressionInput.focus();
});

$("#riddleStartBtn").addEventListener("click", startRiddle);
$("#riddleBtn").addEventListener("click", checkRiddle);
$("#truthBtn").addEventListener("click", revealTruth);

$("#historyClearBtn").addEventListener("click", () => {
  historyElement.replaceChildren();

  const empty = document.createElement("p");
  empty.className = "empty-history";
  empty.textContent = "Tarix tozalandi. Men hech narsani eslamayman... hozircha. 😏";

  historyElement.appendChild(empty);

  showToast("Hisoblashlar tarixi tozalandi.");
});

// Sahifa ochilganda yilni chiqarish.
$("#year").textContent = new Date().getFullYear();

// Dastlabki salomlashuv.
setTimeout(() => {
  setBot(
    "Salom! Men Janob Xudbinman. Matematikani juda yaxshi bilaman, lekin kayfiyatimga qarab ishlayman. Avval «iltimos» deb yoz! 😎",
    "AJOYIB",
    "happy"
  );
}, 500);
