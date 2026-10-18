import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ATDF_CONTENT_VERSION, categories as contentCategories } from "./atdf-content-data.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedRoot = path.join(projectRoot, "public", "generated", "atdf-2026");
const visualRefreshRoot = path.join(projectRoot, "public", "generated", "atdf-2026-v2", "optimized");
const backupRoot = path.join(projectRoot, "outputs", "atdf-content-backups");
const storagePrefix = `atdf-content/${ATDF_CONTENT_VERSION}`;
const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim()
  || process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim()
  || "trivia-assets";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const answerKeys = ["a", "b", "c", "d"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value, maxLength = 37) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function textLines(lines, x, y, lineHeight, attrs = "") {
  return lines.map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" ${attrs}>${escapeXml(line)}</text>`).join("");
}

function categoryMotif(slug, color = "#56C35A") {
  const common = `fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"`;
  switch (slug) {
    case "pharmaceuticals":
      return `<g ${common}><rect x="158" y="208" width="196" height="96" rx="48" transform="rotate(-35 256 256)"/><path d="M204 170l104 148"/><path d="M134 360h244"/><path d="M168 360v-94m176 94v-94"/></g>`;
    case "automotive":
      return `<g ${common}><path d="M102 315l30-92c9-28 34-47 64-47h120c28 0 53 18 63 44l33 95"/><path d="M86 315h340v75H86z"/><circle cx="158" cy="390" r="34"/><circle cx="354" cy="390" r="34"/><path d="M169 176l-32 80h238l-35-80"/></g>`;
    case "textile-and-apparel":
      return `<g ${common}><path d="M164 132l92 46 92-46 72 75-57 58v137H149V265l-57-58z"/><path d="M214 156c7 34 77 34 84 0"/><path d="M214 294h84m-42-42v84"/></g>`;
    case "logistics":
      return `<g ${common}><rect x="86" y="238" width="220" height="130" rx="14"/><path d="M306 274h67l55 62v32H306z"/><circle cx="166" cy="385" r="32"/><circle cx="364" cy="385" r="32"/><path d="M113 205h276M146 164h212"/></g>`;
    default:
      return `<g ${common}><path d="M256 420C154 351 112 280 139 207c26-70 97-80 117-137 20 57 91 67 117 137 27 73-15 144-117 213z"/><path d="M256 393V153m0 104c-40-3-73-25-96-62m96 112c43-5 78-28 101-66"/></g>`;
  }
}

function iconSvg(category) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#061F35"/><stop offset="1" stop-color="#0B4A3D"/></linearGradient></defs>
  <rect width="512" height="512" rx="116" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="190" fill="none" stroke="${category.color}" stroke-opacity=".28" stroke-width="3"/>
  <path d="M55 178C142 122 213 164 284 123c74-42 128-22 177 12M40 329c89-60 169-16 239-64 67-46 126-40 193-4" fill="none" stroke="#F1C46E" stroke-opacity=".22" stroke-width="4"/>
  ${categoryMotif(category.slug, "#F5F1E7")}
</svg>`;
}

function mapSvg(category, categoryIndex) {
  const pathVariants = [
    "M160 143C725 205 250 424 744 540S329 831 715 1002 482 1307 747 1480",
    "M720 124C258 252 756 395 280 561S701 835 245 1023 604 1325 208 1494",
    "M166 115C396 276 679 242 702 463S227 654 246 866 720 1086 663 1305 370 1415 180 1510",
    "M735 133C505 215 227 264 210 489s475 191 457 413-465 203-394 419 309 104 458 187",
    "M153 139C283 324 664 235 720 466S298 687 216 872s378 275 450 456-202 165-478 170"
  ];
  const pathData = pathVariants[categoryIndex % pathVariants.length];
  const nodes = Array.from({ length: 10 }, (_, index) => {
    const y = 150 + index * 142;
    const direction = index % 2 === categoryIndex % 2 ? 1 : -1;
    const x = 450 + direction * (130 + ((index * 37 + categoryIndex * 29) % 115));
    return `<g><circle cx="${x}" cy="${y}" r="31" fill="#F7F2E7" stroke="${category.color}" stroke-width="10"/><circle cx="${x}" cy="${y}" r="9" fill="#06253B"/></g>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600" viewBox="0 0 900 1600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#021A2E"/><stop offset=".52" stop-color="#063B3A"/><stop offset="1" stop-color="#08263E"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="${category.color}" stop-opacity=".38"/><stop offset="1" stop-color="${category.color}" stop-opacity="0"/></radialGradient>
    <pattern id="contours" width="160" height="120" patternUnits="userSpaceOnUse"><path d="M-20 62C25 5 79 112 181 33" fill="none" stroke="#DAE8D7" stroke-opacity=".07" stroke-width="3"/></pattern>
  </defs>
  <rect width="900" height="1600" fill="url(#bg)"/>
  <rect width="900" height="1600" fill="url(#contours)"/>
  <ellipse cx="450" cy="760" rx="430" ry="690" fill="url(#glow)"/>
  <path d="M463 206c-132 25-218 147-204 281 8 79 58 129 75 202 17 72-20 133-3 205 17 71 86 98 104 169 18 70-6 143 43 206 49-63 25-136 43-206 18-71 87-98 104-169 17-72-20-133-3-205 17-73 67-123 75-202 14-134-72-256-204-281l-30 0z" fill="#0B5948" fill-opacity=".46" stroke="#7BCB76" stroke-opacity=".25" stroke-width="5"/>
  <path d="${pathData}" fill="none" stroke="#F0C35F" stroke-opacity=".35" stroke-width="24"/>
  <path d="${pathData}" fill="none" stroke="#F9F5E9" stroke-width="8" stroke-linecap="round" stroke-dasharray="4 22"/>
  ${nodes}
  <g transform="translate(54 58)"><rect width="792" height="116" rx="42" fill="#F7F2E7" fill-opacity=".95"/><g transform="translate(24 -6) scale(.17)">${categoryMotif(category.slug, category.color)}</g><text x="132" y="72" fill="#06253B" font-family="Arial, sans-serif" font-size="39" font-weight="800">${escapeXml(category.title)}</text></g>
</svg>`;
}

function levelVisualSvg(category, level, levelNumber) {
  const titleLines = wrapText(level.title, 28);
  const topicLines = wrapText(level.topic, 45);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#031A2D"/><stop offset=".58" stop-color="#073D3A"/><stop offset="1" stop-color="#09233A"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="${category.color}" stop-opacity=".5"/><stop offset="1" stop-color="${category.color}" stop-opacity="0"/></radialGradient>
    <pattern id="lines" width="150" height="110" patternUnits="userSpaceOnUse"><path d="M-30 68C25 7 83 117 178 28" fill="none" stroke="#F4F0E6" stroke-opacity=".065" stroke-width="2"/></pattern>
  </defs>
  <rect width="1200" height="675" rx="38" fill="url(#bg)"/>
  <rect width="1200" height="675" rx="38" fill="url(#lines)"/>
  <ellipse cx="235" cy="335" rx="310" ry="360" fill="url(#glow)"/>
  <g transform="translate(-5 75) scale(.66)">${categoryMotif(category.slug, "#F4F0E6")}</g>
  <circle cx="163" cy="126" r="54" fill="#F5F1E7"/><text x="163" y="144" text-anchor="middle" fill="#06253B" font-family="Arial, sans-serif" font-size="53" font-weight="900">${levelNumber}</text>
  ${textLines(titleLines, 424, 112, 56, `fill="#F7F3E9" font-family="Arial, sans-serif" font-size="50" font-weight="900"`)}
  ${textLines(topicLines, 428, 238, 35, `fill="#BDE8C5" font-family="Arial, sans-serif" font-size="25" font-weight="700"`)}
  <g transform="translate(426 356)">
    <g><rect width="166" height="186" rx="26" fill="#F7F2E7" fill-opacity=".96"/><circle cx="83" cy="66" r="35" fill="${category.color}" fill-opacity=".18"/><path d="M64 67l14 14 30-34" fill="none" stroke="${category.color}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><text x="83" y="143" text-anchor="middle" fill="#08253A" font-family="Arial" font-size="20" font-weight="800">CONTROL</text></g>
    <g transform="translate(184)"><rect width="166" height="186" rx="26" fill="#F7F2E7" fill-opacity=".96"/><circle cx="83" cy="66" r="35" fill="${category.color}" fill-opacity=".18"/><path d="M61 45h44v52H61zM69 57h28m-28 12h28m-28 12h18" fill="none" stroke="${category.color}" stroke-width="7" stroke-linecap="round"/><text x="83" y="143" text-anchor="middle" fill="#08253A" font-family="Arial" font-size="20" font-weight="800">EVIDENCE</text></g>
    <g transform="translate(368)"><rect width="166" height="186" rx="26" fill="#F7F2E7" fill-opacity=".96"/><circle cx="83" cy="66" r="35" fill="#F2A43A" fill-opacity=".2"/><path d="M83 37l31 57H52zM83 55v20m0 9v2" fill="none" stroke="#E38B1D" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><text x="83" y="143" text-anchor="middle" fill="#08253A" font-family="Arial" font-size="20" font-weight="800">RISK</text></g>
    <g transform="translate(552)"><rect width="166" height="186" rx="26" fill="#F7F2E7" fill-opacity=".96"/><circle cx="83" cy="66" r="35" fill="${category.color}" fill-opacity=".18"/><path d="M52 77l22-22 17 17 25-28m0 0v25m0-25H91" fill="none" stroke="${category.color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><text x="83" y="143" text-anchor="middle" fill="#08253A" font-family="Arial" font-size="20" font-weight="800">ACTION</text></g>
  </g>
  <text x="1130" y="632" text-anchor="end" fill="#F1C46E" font-family="Arial" font-size="18" font-weight="700" letter-spacing="3">BUILDING AFRICA'S EXPORTS THROUGH QUALITY</text>
</svg>`;
}

function rotateOptions(correct, distractors, correctIndex) {
  const options = [...distractors];
  options.splice(correctIndex, 0, correct);
  return {
    option_a: options[0].en,
    option_b: options[1].en,
    option_c: options[2].en,
    option_d: options[3].en,
    correct_option: answerKeys[correctIndex],
    amOptions: {
      optionA: options[0].am,
      optionB: options[1].am,
      optionC: options[2].am,
      optionD: options[3].am
    }
  };
}

const genericDistractors = {
  benefit: [
    { en: "Remove every destination country's legal requirements", am: "የእያንዳንዱን መዳረሻ አገር ሕጋዊ መስፈርት ሙሉ በሙሉ ማስወገድ" },
    { en: "Guarantee that every shipment is exempt from duty", am: "እያንዳንዱ ጭነት ከቀረጥ ነፃ መሆኑን ማረጋገጥ" },
    { en: "Replace technical controls with advertising", am: "ቴክኒካዊ ቁጥጥሮችን በማስታወቂያ መተካት" }
  ],
  evidence: [
    { en: "An undated verbal assurance with no records", am: "መዝገብ የሌለው ቀን ያልተጻፈበት የቃል ማረጋገጫ" },
    { en: "A marketing poster that contains no test data", am: "የምርመራ መረጃ የሌለው የገበያ ማስታወቂያ" },
    { en: "An unrelated invoice with no lot or result details", am: "የሎት ወይም የውጤት ዝርዝር የሌለው ያልተያያዘ ደረሰኝ" }
  ],
  risk: [
    { en: "A seasonal change to the company logo", am: "ወቅታዊ የኩባንያ አርማ ለውጥ" },
    { en: "A shortage of office furniture", am: "የቢሮ ዕቃ እጥረት" },
    { en: "Lower engagement on an unrelated social post", am: "ባልተያያዘ ማህበራዊ ሚዲያ ልጥፍ ላይ ዝቅተኛ ተሳትፎ" }
  ],
  action: [
    { en: "Ship immediately and create records only if a problem occurs", am: "ወዲያውኑ መላክና ችግር ሲፈጠር ብቻ መዝገብ መፍጠር" },
    { en: "Copy a competitor's label without checking the requirement", am: "መስፈርቱን ሳያረጋግጡ የተወዳዳሪን መለያ መቅዳት" },
    { en: "Ignore the destination market and rely on assumptions", am: "የመዳረሻ ገበያውን ችላ ብሎ በግምት ላይ መተማመን" }
  ],
  atdf: [
    { en: "It makes evidence and standards unnecessary for trade", am: "ለንግድ ማስረጃና ደረጃዎችን አላስፈላጊ ያደርጋል" },
    { en: "It focuses only on advertising and not on product quality", am: "በምርት ጥራት ሳይሆን በማስታወቂያ ብቻ ያተኩራል" },
    { en: "It prevents African firms from entering additional markets", am: "የአፍሪካ ድርጅቶች ወደ ተጨማሪ ገበያዎች እንዳይገቡ ይከለክላል" }
  ]
};

const questionStems = {
  benefit: [
    ["Study the level illustration. Which outcome best explains why {topic} matters to exporters?", "የደረጃውን ምስል ይመልከቱ። {topic} ለላኪዎች አስፈላጊ የሆነበትን ውጤት በተሻለ የሚገልጸው የትኛው ነው?"],
    ["The illustration connects quality controls to trade. What is the main benefit of {topic}?", "ምስሉ የጥራት ቁጥጥርን ከንግድ ጋር ያገናኛል። {topic} ዋና ጥቅም ምንድን ነው?"],
    ["Looking at the visual, which export result should {topic} produce?", "ምስሉን በመመልከት {topic} የትኛውን የወጪ ንግድ ውጤት ሊያመጣ ይገባል?"],
    ["Which quality outcome is the level visual designed to highlight for {topic}?", "የደረጃው ምስል ለ{topic} ለማጉላት የተነደፈው የትኛውን የጥራት ውጤት ነው?"]
  ],
  evidence: [
    ["In the illustrated quality system, which record would best prove that {control} is working?", "በምስሉ የጥራት ሥርዓት ውስጥ {control} እየሰራ መሆኑን በተሻለ የሚያረጋግጠው የትኛው መዝገብ ነው?"],
    ["An auditor reviews the control shown in the visual. Which evidence is most credible?", "ኦዲተር በምስሉ የታየውን ቁጥጥር ይገመግማል። በጣም ታማኝ ማስረጃ የትኛው ነው?"],
    ["Which documented evidence should accompany the control highlighted in the illustration?", "በምስሉ ከተጠቀሰው ቁጥጥር ጋር መያያዝ ያለበት የትኛው የተመዘገበ ማስረጃ ነው?"],
    ["What would give a buyer the strongest proof that the illustrated control is effective?", "በምስሉ የታየው ቁጥጥር ውጤታማ መሆኑን ለገዢ ጠንካራ ማስረጃ የሚሰጠው ምንድን ነው?"]
  ],
  risk: [
    ["Which trade or quality risk is this level mainly designed to reduce?", "ይህ ደረጃ በዋናነት ለመቀነስ የተነደፈው የትኛውን የንግድ ወይም የጥራት አደጋ ነው?"],
    ["If the level's control fails, which consequence is most relevant?", "የደረጃው ቁጥጥር ካልሰራ የትኛው ውጤት በጣም ተያያዥ ነው?"],
    ["What is the most important risk addressed by {topic}?", "በ{topic} የሚፈታው በጣም አስፈላጊ አደጋ ምንድን ነው?"],
    ["Which problem would a weak {topic} system most likely create?", "ደካማ {topic} ሥርዓት በብዛት ሊፈጥረው የሚችለው ችግር የትኛው ነው?"]
  ],
  action: [
    ["An African exporter is strengthening {topic}. What should the team do first?", "አንድ የአፍሪካ ላኪ {topic}ን እያጠናከረ ነው። ቡድኑ መጀመሪያ ምን ማድረግ አለበት?"],
    ["Which practical first step best turns this level into an operating control?", "ይህን ደረጃ ወደ ተግባራዊ ቁጥጥር በተሻለ የሚቀይረው የትኛው የመጀመሪያ እርምጃ ነው?"],
    ["A small exporter wants to meet this requirement. Which action is the best starting point?", "አንድ አነስተኛ ላኪ ይህን መስፈርት ማሟላት ይፈልጋል። የትኛው እርምጃ ምርጥ መነሻ ነው?"],
    ["Which implementation step should come before commercial export under this topic?", "በዚህ ርዕስ ስር ከንግድ ወጪ ንግድ በፊት መምጣት ያለበት የትኛው የትግበራ ደረጃ ነው?"]
  ]
};

function fillStem(template, level, language) {
  const topic = language === "am" ? level.amTopic : level.topic;
  const control = language === "am" ? level.amControl : level.control;
  return template.replaceAll("{topic}", topic).replaceAll("{control}", control);
}

function buildQuestion(level, levelNumber, questionIndex, mediaUrl) {
  const stemVariant = (levelNumber + questionIndex) % 4;
  let stem;
  let correct;
  let distractors;
  let explanation;
  let amExplanation;

  if (questionIndex === 0) {
    stem = questionStems.benefit[stemVariant];
    correct = { en: level.benefit, am: level.amBenefit };
    distractors = genericDistractors.benefit;
    explanation = `${level.topic} supports export quality because ${level.benefit.toLowerCase()}.`;
    amExplanation = `${level.amTopic} የወጪ ንግድ ጥራትን ይደግፋል፤ ${level.amBenefit}።`;
  } else if (questionIndex === 1) {
    stem = questionStems.evidence[stemVariant];
    correct = { en: level.evidence, am: level.amEvidence };
    distractors = genericDistractors.evidence;
    explanation = `Credible quality evidence is traceable and specific. Here, the best evidence is ${level.evidence}.`;
    amExplanation = `ታማኝ የጥራት ማስረጃ ሊከታተል የሚችልና ግልጽ ነው። እዚህ ምርጡ ማስረጃ ${level.amEvidence} ነው።`;
  } else if (questionIndex === 2) {
    stem = questionStems.risk[stemVariant];
    correct = { en: level.risk, am: level.amRisk };
    distractors = genericDistractors.risk;
    explanation = `The control is important because it reduces the risk of ${level.risk}.`;
    amExplanation = `ይህ ቁጥጥር ${level.amRisk} የሚለውን አደጋ ስለሚቀንስ አስፈላጊ ነው።`;
  } else if (questionIndex === 3) {
    stem = questionStems.action[stemVariant];
    correct = { en: level.action, am: level.amAction };
    distractors = genericDistractors.action;
    explanation = `A sound implementation begins with a defined, evidence-based step: ${level.action}.`;
    amExplanation = `ጠንካራ ትግበራ በተወሰነና በማስረጃ ላይ በተመሠረተ እርምጃ ይጀምራል፤ ${level.amAction}።`;
  } else {
    stem = [
      "Why is this level relevant to ATDF's ‘Building Africa's Exports Through Quality’ agenda?",
      "How does this topic support the ATDF goal of turning quality into market access?"
    ][levelNumber % 2];
    const amStem = [
      "ይህ ደረጃ ለATDF ‘የአፍሪካን ወጪ ንግድ በጥራት መገንባት’ አጀንዳ ተያያዥ የሆነው ለምንድን ነው?",
      "ይህ ርዕስ ጥራትን ወደ ገበያ መዳረሻ የመቀየር የATDF ዓላማን እንዴት ይደግፋል?"
    ][levelNumber % 2];
    correct = {
      en: "It turns trusted standards and verifiable quality into easier market access",
      am: "የታመኑ ደረጃዎችንና ሊረጋገጥ የሚችል ጥራትን ወደ ቀላል የገበያ መዳረሻ ይቀይራል"
    };
    distractors = genericDistractors.atdf;
    explanation = "ATDF treats standards and quality infrastructure as practical foundations for trust, competitiveness and market access.";
    amExplanation = "ATDF ደረጃዎችንና የጥራት መሠረተ ልማትን ለእምነት፣ ለተወዳዳሪነትና ለገበያ መዳረሻ ተግባራዊ መሠረት አድርጎ ይመለከታል።";
    const arranged = rotateOptions(correct, distractors, (levelNumber + questionIndex) % 4);
    return {
      question_text: stem,
      ...Object.fromEntries(Object.entries(arranged).filter(([key]) => key !== "amOptions")),
      explanation,
      translations: {
        am: { questionText: amStem, ...arranged.amOptions, explanation: amExplanation }
      },
      media_url: "",
      is_active: false,
      sort_order: questionIndex
    };
  }

  const arranged = rotateOptions(correct, distractors, (levelNumber + questionIndex) % 4);
  return {
    question_text: fillStem(stem[0], level, "en"),
    ...Object.fromEntries(Object.entries(arranged).filter(([key]) => key !== "amOptions")),
    explanation,
    translations: {
      am: {
        questionText: fillStem(stem[1], level, "am"),
        ...arranged.amOptions,
        explanation: amExplanation
      }
    },
    media_url: questionIndex < 2 ? mediaUrl : "",
    is_active: false,
    sort_order: questionIndex
  };
}

async function selectAll(table, columns = "*") {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table} select failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function chunks(values, size = 100) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function ensureBucket() {
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (data) return;
  if (error && !error.message.toLowerCase().includes("not found")) throw new Error(`Storage lookup failed: ${error.message}`);
  const created = await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: "10MB" });
  if (created.error) throw new Error(`Storage bucket creation failed: ${created.error.message}`);
}

async function uploadAsset(storagePath, body, contentType) {
  const { error } = await supabase.storage.from(bucket).upload(storagePath, body, {
    contentType,
    cacheControl: "31536000",
    upsert: true
  });
  if (error) throw new Error(`Asset upload failed (${storagePath}): ${error.message}`);
  return supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
}

async function prepareAssets() {
  await ensureBucket();
  await mkdir(path.join(generatedRoot, "questions"), { recursive: true });

  const assets = {};
  for (let categoryIndex = 0; categoryIndex < contentCategories.length; categoryIndex += 1) {
    const category = contentCategories[categoryIndex];
    const iconBuffer = await readFile(path.join(visualRefreshRoot, "icons", `${category.slug}.png`));
    const mapBuffer = await readFile(path.join(visualRefreshRoot, "maps", `${category.slug}.jpg`));
    const podiumBuffer = await readFile(path.join(visualRefreshRoot, "podiums", `${category.slug}.png`));
    const iconUrl = await uploadAsset(`${storagePrefix}/icons/${category.slug}-v3.png`, iconBuffer, "image/png");
    const mapUrl = await uploadAsset(`${storagePrefix}/maps/${category.slug}-v3.jpg`, mapBuffer, "image/jpeg");
    const podiumUrl = await uploadAsset(`${storagePrefix}/podiums/${category.slug}-v3.png`, podiumBuffer, "image/png");
    const cardBuffer = await readFile(path.join(visualRefreshRoot, "cards", `${category.slug}.jpg`));
    const cardUrl = await uploadAsset(`${storagePrefix}/cards/${category.slug}-v3.jpg`, cardBuffer, "image/jpeg");

    assets[category.slug] = { iconUrl, mapUrl, podiumUrl, cardUrl, levels: {} };
    for (let levelIndex = 0; levelIndex < category.levels.length; levelIndex += 1) {
      const levelNumber = levelIndex + 1;
      const svg = levelVisualSvg(category, category.levels[levelIndex], levelNumber);
      const fileName = `level-${String(levelNumber).padStart(2, "0")}.svg`;
      const localDir = path.join(generatedRoot, "questions", category.slug);
      await mkdir(localDir, { recursive: true });
      await writeFile(path.join(localDir, fileName), svg, "utf8");
      assets[category.slug].levels[levelNumber] = await uploadAsset(
        `${storagePrefix}/questions/${category.slug}/${fileName}`,
        Buffer.from(svg),
        "image/svg+xml"
      );
    }
  }
  return assets;
}

async function inspect() {
  const tableNames = ["categories", "category_levels", "questions", "player_progress", "score_events", "rewards", "player_game_sessions"];
  const counts = {};
  for (const table of tableNames) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`${table} count failed: ${error.message}`);
    counts[table] = count;
  }
  const { data: liveCategories, error } = await supabase
    .from("categories")
    .select("id,title,is_active,sort_order,card_background_url,map_background_url")
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(`Category inspection failed: ${error.message}`);
  console.log(JSON.stringify({ counts, categories: liveCategories, bucket, version: ATDF_CONTENT_VERSION }, null, 2));
}

async function buildBackup(liveCategories, oldLevels) {
  const categoryIds = liveCategories.map((row) => row.id);
  const levelIds = oldLevels.map((row) => row.id);
  const allQuestions = await selectAll("questions");
  const questions = allQuestions.filter((row) => levelIds.includes(row.level_id));
  const [allProgress, allScores, allSessions, allRewards] = await Promise.all([
    selectAll("player_progress"),
    selectAll("score_events"),
    selectAll("player_game_sessions"),
    selectAll("rewards")
  ]);
  const backup = {
    version: ATDF_CONTENT_VERSION,
    createdAt: new Date().toISOString(),
    categories: liveCategories,
    levels: oldLevels,
    questions,
    playerProgress: allProgress.filter((row) => categoryIds.includes(row.category_id)),
    scoreEvents: allScores.filter((row) => categoryIds.includes(row.category_id)),
    playerGameSessions: allSessions.filter((row) => categoryIds.includes(row.category_id)),
    rewards: allRewards.filter((row) => categoryIds.includes(row.category_id))
  };
  await mkdir(backupRoot, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const backupPath = path.join(backupRoot, `before-${ATDF_CONTENT_VERSION}-${stamp}.json`);
  await writeFile(backupPath, JSON.stringify(backup, null, 2), "utf8");
  return { backup, backupPath };
}

async function insertRows(table, rows, size = 500) {
  for (const group of chunks(rows, size)) {
    const { error } = await supabase.from(table).insert(group);
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
  }
}

async function deleteByIds(table, ids) {
  for (const group of chunks(ids, 100)) {
    const { error } = await supabase.from(table).delete().in("id", group);
    if (error) throw new Error(`${table} delete failed: ${error.message}`);
  }
}

async function restoreBackup(backup, stagedLevelIds = [], createdCategoryIds = [], restoreHistory = true) {
  console.error("Replacement failed. Restoring the backed-up content...");
  if (stagedLevelIds.length) {
    const { data: stagedQuestions } = await supabase.from("questions").select("id").in("level_id", stagedLevelIds);
    if (stagedQuestions?.length) await deleteByIds("questions", stagedQuestions.map((row) => row.id));
    await deleteByIds("category_levels", stagedLevelIds);
  }
  if (createdCategoryIds.length) await deleteByIds("categories", createdCategoryIds);

  for (const category of backup.categories) {
    const { id, ...values } = category;
    const { error } = await supabase.from("categories").update(values).eq("id", id);
    if (error) throw new Error(`Category rollback failed: ${error.message}`);
  }

  const oldLevelIds = backup.levels.map((row) => row.id);
  if (oldLevelIds.length) {
    const { data: present } = await supabase.from("category_levels").select("id").in("id", oldLevelIds);
    const presentIds = new Set((present ?? []).map((row) => row.id));
    await insertRows("category_levels", backup.levels.filter((row) => !presentIds.has(row.id)));
  }
  const oldQuestionIds = backup.questions.map((row) => row.id);
  if (oldQuestionIds.length) {
    const { data: present } = await supabase.from("questions").select("id").in("id", oldQuestionIds.slice(0, 100));
    if ((present ?? []).length !== oldQuestionIds.length) {
      const current = await selectAll("questions", "id");
      const presentIds = new Set(current.map((row) => row.id));
      await insertRows("questions", backup.questions.filter((row) => !presentIds.has(row.id)));
    }
  }

  if (restoreHistory) {
    const categoryIds = backup.categories.map((row) => row.id);
    for (const table of ["player_progress", "player_game_sessions", "score_events"]) {
      for (const group of chunks(categoryIds, 50)) {
        const { error } = await supabase.from(table).delete().in("category_id", group);
        if (error) throw new Error(`${table} rollback cleanup failed: ${error.message}`);
      }
    }
    await insertRows("player_progress", backup.playerProgress);
    await insertRows("player_game_sessions", backup.playerGameSessions);
    await insertRows("score_events", backup.scoreEvents);
  }
  console.error("Backup restoration completed.");
}

function validateContentDefinition() {
  assert(contentCategories.length === 5, "The content definition must contain exactly five categories.");
  const expectedTitles = ["Pharmaceuticals", "Automotive", "Textile and apparel", "Logistics", "Agro processing"];
  assert(JSON.stringify(contentCategories.map((item) => item.title)) === JSON.stringify(expectedTitles), "Category titles or order are incorrect.");
  for (const category of contentCategories) {
    assert(category.levels.length === 10, `${category.title} must contain exactly ten levels.`);
    for (const [index, level] of category.levels.entries()) {
      for (const key of ["title", "amTitle", "topic", "amTopic", "benefit", "amBenefit", "control", "amControl", "evidence", "amEvidence", "risk", "amRisk", "action", "amAction"]) {
        assert(typeof level[key] === "string" && level[key].trim().length > 3, `${category.title} level ${index + 1} is missing ${key}.`);
      }
    }
  }
}

async function applyReplacement() {
  validateContentDefinition();
  const liveCategories = await selectAll("categories");
  liveCategories.sort((left, right) => left.sort_order - right.sort_order || String(left.created_at).localeCompare(String(right.created_at)));
  assert(liveCategories.length > 0 && liveCategories.length <= 5, `Expected between one and five live categories to replace; found ${liveCategories.length}.`);

  const originalCategoryIds = liveCategories.map((row) => row.id);
  const allLevels = await selectAll("category_levels");
  const oldLevels = allLevels.filter((row) => originalCategoryIds.includes(row.category_id));
  const { backup, backupPath } = await buildBackup(liveCategories, oldLevels);
  console.log(`Backup written: ${backupPath}`);
  console.log("Generating and uploading production assets...");
  const assets = await prepareAssets();
  console.log("Assets uploaded. Staging 50 levels and 250 bilingual questions...");

  const workingCategories = [...liveCategories];
  const createdCategoryIds = [];
  const stagedLevels = [];
  const stagedQuestions = [];
  let stagedInserted = false;
  let oldHistoryMutated = false;
  try {
    while (workingCategories.length < contentCategories.length) {
      const index = workingCategories.length;
      const definition = contentCategories[index];
      const id = randomUUID();
      const row = {
        id,
        title: `ATDF staging ${id}`,
        icon_url: "",
        difficulty: "easy",
        is_reward_based: false,
        is_active: false,
        sort_order: 100 + index,
        color_hex: definition.color,
        description: `Staging ${definition.title} content before activation.`,
        card_background_url: "",
        map_background_url: "",
        level_podium_url: ""
      };
      const { data, error } = await supabase.from("categories").insert(row).select().single();
      if (error) throw new Error(`Could not create required fifth category: ${error.message}`);
      workingCategories.push(data);
      createdCategoryIds.push(id);
    }

    const categoryIds = workingCategories.map((row) => row.id);
    for (let categoryIndex = 0; categoryIndex < contentCategories.length; categoryIndex += 1) {
      const definition = contentCategories[categoryIndex];
      const categoryId = workingCategories[categoryIndex].id;
      for (let levelIndex = 0; levelIndex < definition.levels.length; levelIndex += 1) {
        const levelNumber = levelIndex + 1;
        const levelId = randomUUID();
        stagedLevels.push({
          id: levelId,
          category_id: categoryId,
          level_number: 100 + levelNumber,
          title: definition.levels[levelIndex].title,
          difficulty: levelNumber <= 3 ? "easy" : levelNumber <= 7 ? "medium" : "hard",
          question_count: 5,
          time_limit_seconds: levelNumber <= 3 ? 35 : levelNumber <= 7 ? 30 : 25,
          points_per_correct: levelNumber <= 3 ? 10 : levelNumber <= 7 ? 15 : 20,
          is_active: false
        });
        const mediaUrl = assets[definition.slug].levels[levelNumber];
        for (let questionIndex = 0; questionIndex < 5; questionIndex += 1) {
          stagedQuestions.push({
            id: randomUUID(),
            level_id: levelId,
            ...buildQuestion(definition.levels[levelIndex], levelNumber, questionIndex, mediaUrl)
          });
        }
      }
    }

    await insertRows("category_levels", stagedLevels, 50);
    stagedInserted = true;
    await insertRows("questions", stagedQuestions, 100);

    const stagedLevelIds = stagedLevels.map((row) => row.id);
    const { data: stagedRows, error: stagedError } = await supabase
      .from("questions")
      .select("id,level_id,media_url,translations")
      .in("level_id", stagedLevelIds);
    if (stagedError) throw new Error(`Staged validation failed: ${stagedError.message}`);
    assert(stagedRows?.length === 250, `Staged question count is ${stagedRows?.length}; expected 250.`);
    assert(stagedRows.filter((row) => row.media_url).length === 100, "Staged content must contain exactly 100 pictured questions.");
    assert(stagedRows.every((row) => row.translations?.am?.questionText), "Every staged question must contain Amharic text.");

    const { error: hideError } = await supabase.from("categories").update({ is_active: false }).in("id", categoryIds);
    if (hideError) throw new Error(`Could not hide categories during switch: ${hideError.message}`);

    oldHistoryMutated = true;
    const { error: scoreDeleteError } = await supabase.from("score_events").delete().in("category_id", originalCategoryIds);
    if (scoreDeleteError) throw new Error(`Old score cleanup failed: ${scoreDeleteError.message}`);
    const { error: progressDeleteError } = await supabase.from("player_progress").delete().in("category_id", originalCategoryIds);
    if (progressDeleteError) throw new Error(`Old progress cleanup failed: ${progressDeleteError.message}`);

    const oldQuestionIds = backup.questions.map((row) => row.id);
    await deleteByIds("questions", oldQuestionIds);
    await deleteByIds("category_levels", oldLevels.map((row) => row.id));

    for (const [index, row] of stagedLevels.entries()) {
      const levelNumber = (index % 10) + 1;
      const { error } = await supabase
        .from("category_levels")
        .update({ level_number: levelNumber, is_active: true, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw new Error(`Level activation failed: ${error.message}`);
    }
    for (const group of chunks(stagedQuestions.map((row) => row.id), 100)) {
      const { error } = await supabase.from("questions").update({ is_active: true, updated_at: new Date().toISOString() }).in("id", group);
      if (error) throw new Error(`Question activation failed: ${error.message}`);
    }

    const categoryDifficulties = ["medium", "hard", "easy", "medium", "easy"];
    for (let index = 0; index < workingCategories.length; index += 1) {
      const definition = contentCategories[index];
      const asset = assets[definition.slug];
      const { error } = await supabase.from("categories").update({
        title: definition.title,
        icon_url: asset.iconUrl,
        difficulty: categoryDifficulties[index],
        is_reward_based: false,
        is_active: true,
        sort_order: index,
        color_hex: definition.color,
        description: definition.description,
        card_background_url: asset.cardUrl,
        map_background_url: asset.mapUrl,
        level_podium_url: asset.podiumUrl,
        updated_at: new Date().toISOString()
      }).eq("id", workingCategories[index].id);
      if (error) throw new Error(`Category update failed (${definition.title}): ${error.message}`);
    }

    const { error: reconcileError } = await supabase.rpc("reconcile_player_progress", { target_category_ids: categoryIds });
    if (reconcileError && !reconcileError.message.includes("reconcile_player_progress")) {
      throw new Error(`Progress reconciliation failed: ${reconcileError.message}`);
    }

    const report = await verify();
    console.log(JSON.stringify({ success: true, backupPath, report }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    await restoreBackup(
      backup,
      stagedInserted ? stagedLevels.map((row) => row.id) : [],
      createdCategoryIds,
      oldHistoryMutated
    );
    throw error;
  }
}

async function verify() {
  const categories = await selectAll("categories");
  categories.sort((left, right) => left.sort_order - right.sort_order);
  const categoryIds = categories.map((row) => row.id);
  const levels = (await selectAll("category_levels")).filter((row) => categoryIds.includes(row.category_id));
  const levelIds = levels.map((row) => row.id);
  const questions = (await selectAll("questions")).filter((row) => levelIds.includes(row.level_id));
  const levelImageCounts = new Map(levelIds.map((id) => [id, 0]));
  for (const question of questions) {
    if (question.media_url) levelImageCounts.set(question.level_id, (levelImageCounts.get(question.level_id) ?? 0) + 1);
  }
  const report = {
    categoryTitles: categories.map((row) => row.title),
    activeCategories: categories.filter((row) => row.is_active).length,
    levels: levels.length,
    activeLevels: levels.filter((row) => row.is_active).length,
    questions: questions.length,
    activeQuestions: questions.filter((row) => row.is_active).length,
    picturedQuestions: questions.filter((row) => row.media_url).length,
    levelsWithAtLeastTwoPictures: [...levelImageCounts.values()].filter((count) => count >= 2).length,
    amharicQuestions: questions.filter((row) => row.translations?.am?.questionText
      && row.translations?.am?.optionA
      && row.translations?.am?.optionB
      && row.translations?.am?.optionC
      && row.translations?.am?.optionD).length,
    categoryAssetSets: categories.filter((row) => row.icon_url && row.card_background_url && row.map_background_url && row.level_podium_url).length
  };
  const expectedTitles = contentCategories.map((row) => row.title);
  assert(JSON.stringify(report.categoryTitles) === JSON.stringify(expectedTitles), "Live category titles do not match the requested set.");
  assert(report.activeCategories === 5 && report.categoryAssetSets === 5, "All five categories must be active with complete assets.");
  assert(report.levels === 50 && report.activeLevels === 50, "The live database must contain exactly 50 active levels.");
  assert(report.questions === 250 && report.activeQuestions === 250, "The live database must contain exactly 250 active questions.");
  assert(report.picturedQuestions === 100 && report.levelsWithAtLeastTwoPictures === 50, "Every level must contain exactly two pictured questions.");
  assert(report.amharicQuestions === 250, "Every question must have complete Amharic text and options.");
  return report;
}

async function refreshQuestionText() {
  validateContentDefinition();
  const updates = [];
  for (const categoryDefinition of contentCategories) {
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("title", categoryDefinition.title)
      .single();
    if (categoryError) throw new Error(`Could not find ${categoryDefinition.title}: ${categoryError.message}`);
    const { data: levels, error: levelsError } = await supabase
      .from("category_levels")
      .select("id,level_number")
      .eq("category_id", category.id)
      .order("level_number");
    if (levelsError) throw new Error(`Could not read ${categoryDefinition.title} levels: ${levelsError.message}`);
    assert(levels?.length === 10, `${categoryDefinition.title} must have ten live levels before refresh.`);

    for (const levelRow of levels) {
      const levelDefinition = categoryDefinition.levels[levelRow.level_number - 1];
      const { data: questions, error: questionsError } = await supabase
        .from("questions")
        .select("id,media_url,sort_order")
        .eq("level_id", levelRow.id)
        .order("sort_order");
      if (questionsError) throw new Error(`Could not read level ${levelRow.level_number} questions: ${questionsError.message}`);
      assert(questions?.length === 5, `${categoryDefinition.title} level ${levelRow.level_number} must have five questions before refresh.`);
      for (let questionIndex = 0; questionIndex < questions.length; questionIndex += 1) {
        const generated = buildQuestion(
          levelDefinition,
          levelRow.level_number,
          questionIndex,
          questions[questionIndex].media_url || ""
        );
        updates.push({ id: questions[questionIndex].id, values: { ...generated, is_active: true } });
      }
    }
  }

  for (const group of chunks(updates, 25)) {
    await Promise.all(group.map(async ({ id, values }) => {
      const { error } = await supabase.from("questions").update(values).eq("id", id);
      if (error) throw new Error(`Question refresh failed (${id}): ${error.message}`);
    }));
  }
  return verify();
}

const command = process.argv[2] ?? "inspect";
if (command === "inspect") await inspect();
else if (command === "validate") {
  validateContentDefinition();
  const preview = contentCategories.flatMap((category) => category.levels.flatMap((level, levelIndex) =>
    Array.from({ length: 5 }, (_, questionIndex) => buildQuestion(level, levelIndex + 1, questionIndex, "https://example.invalid/visual.svg"))
  ));
  assert(preview.length === 250, "Preview must contain 250 questions.");
  assert(preview.filter((row) => row.media_url).length === 100, "Preview must contain 100 pictured questions.");
  assert(preview.every((row) => row.question_text && row.option_a && row.option_b && row.option_c && row.option_d && row.translations?.am?.questionText), "Every preview question must be complete and bilingual.");
  console.log(JSON.stringify({ categories: 5, levels: 50, questions: preview.length, picturedQuestions: preview.filter((row) => row.media_url).length, amharicQuestions: preview.filter((row) => row.translations?.am?.questionText).length }, null, 2));
}
else if (command === "assets") console.log(JSON.stringify(await prepareAssets(), null, 2));
else if (command === "apply") await applyReplacement();
else if (command === "refresh") console.log(JSON.stringify(await refreshQuestionText(), null, 2));
else if (command === "verify") console.log(JSON.stringify(await verify(), null, 2));
else throw new Error(`Unknown command: ${command}. Use inspect, validate, assets, apply, refresh or verify.`);
