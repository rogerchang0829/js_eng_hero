import fs from "node:fs/promises";
import * as XLSX from "../../node_modules/xlsx/xlsx.mjs";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const inputPath = "../../WORDBANK_New_2026Apr.xlsx";
const outputPath = "./WORDBANK_New_2026Apr_Cleanup_Preview.xlsx";
const officialOutputPath = "./WORDBANK_Official_103.xlsx";
const reviewOutputPath = "./WORDBANK_Review_58.xlsx";
const sourceSheetName = "word bank_all";

const sourceFile = await fs.readFile(inputPath);
const original = XLSX.read(sourceFile, { type: "buffer" });
const worksheet = original.Sheets[sourceSheetName];
if (!worksheet) throw new Error(`Missing sheet: ${sourceSheetName}`);

const sourceRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
const columns = Object.keys(sourceRows[0] || {});
const meaningColumn = columns.find((key) => key.toLowerCase().includes("parts of speech")) || columns[4];
const sentenceColumn = columns.find((key) => key.toLowerCase().includes("stentence")) || columns[5];

function text(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").trim();
}

function excelLiteral(value) {
  return typeof value === "string" && value.startsWith("=") ? `'${value}` : value;
}

function lines(value) {
  return text(value)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function unique(values) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const key = value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

function inferPos(raw) {
  const match = raw.toLowerCase().match(/\b(adjective|adj\.?|noun|n\.?|verb|v\.?|adverb|adv\.?|preposition|prep\.?|conjunction|conj\.?)\b/);
  if (!match) return "";
  const value = match[1].replace(".", "");
  return {
    adj: "adjective",
    n: "noun",
    v: "verb",
    adv: "adverb",
    prep: "preposition",
    conj: "conjunction",
  }[value] || value;
}

function escapePattern(word) {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordPatterns(word) {
  const normalized = word.toLowerCase();
  const forms = new Set([normalized]);
  if (normalized.endsWith("y") && normalized.length > 3) forms.add(`${normalized.slice(0, -1)}ies`);
  if (normalized.endsWith("e")) {
    forms.add(`${normalized}d`);
    forms.add(`${normalized.slice(0, -1)}ing`);
  } else {
    forms.add(`${normalized}ed`);
    forms.add(`${normalized}ing`);
  }
  forms.add(`${normalized}s`);
  const exact = new RegExp(`\\b${escapePattern(normalized)}\\b`, "i");
  const variant = new RegExp(`\\b(?:${Array.from(forms).map(escapePattern).join("|")})\\b`, "i");
  return { exact, variant };
}

function looksLikeSentence(line) {
  const wordCount = line.split(/\s+/).length;
  return wordCount >= 4 && !/^(adj|adv|n|v|noun|verb|definition|\[\s*[uc]\s*\])\.?$/i.test(line) && !/:$/.test(line);
}

function stripMeaningPrefix(line, word) {
  return line
    .replace(/^\s*(?:\(?[a-z0-9]+\)?[.)]?\s*)?(?:\[(?:adj|adv|n|v)\]\s*)?/i, "")
    .replace(new RegExp(`^${escapePattern(word)}\\s*`, "i"), "")
    .replace(/^(?:adjective|adj\.?|noun|n\.?|verb|v\.?|adverb|adv\.?)\s*[:.]?\s*/i, "")
    .replace(/^[:：.]\s*/, "")
    .replace(/[;；]\s*$/, "")
    .trim();
}

function chooseMeaning(word, meaningLines) {
  const chinese = meaningLines.filter((line) => /[\u4e00-\u9fff]/.test(line));
  const preferred = chinese.find(
    (line) => !/常用語|例[:：]|→|->|這個字|不是|心理陰影|感到|一直|當他|她|我/.test(line) && line.length < 80,
  );
  return preferred ? stripMeaningPrefix(preferred, word) : "";
}

function chooseExample(word, sentenceLines) {
  const { exact, variant } = wordPatterns(word);
  const english = sentenceLines.filter((line) => /[A-Za-z]/.test(line) && !/^[A-Z]{1,4}$/.test(line));
  const exactLine = english.find((line) => exact.test(line) && looksLikeSentence(line));
  if (exactLine) return { line: exactLine, variantOnly: false };
  const variantLine = english.find((line) => variant.test(line) && looksLikeSentence(line));
  if (variantLine) return { line: variantLine, variantOnly: true };
  return { line: "", variantOnly: false };
}

function pairedChinese(example, sentenceLines) {
  if (!example) return "";
  const index = sentenceLines.indexOf(example);
  const next = sentenceLines[index + 1] || "";
  return /[\u4e00-\u9fff]/.test(next) ? next : "";
}

function qualityIssues(row) {
  const issues = [];
  if (/[\u4e00-\u9fff]/.test(row.exampleEn)) issues.push("例句混有中文，需拆分");
  if (/常用|通常|例[:：]|用在|means|definition/i.test(row.exampleEn)) issues.push("主要例句疑似說明文字");
  if (/…|\[\s*[CUS]\s*\]|\(SUBSTANCE|\(U\/?C\)|\(plural|past & past/i.test(row.meaningZh)) issues.push("核心義項仍含字典標記");
  if (row.meaningZh.length > 30) issues.push("核心義項過長");
  return issues;
}

const termsCount = new Map();
for (const row of sourceRows) {
  const word = text(row["work bank"]).toLowerCase();
  if (word) termsCount.set(word, (termsCount.get(word) || 0) + 1);
}
const occurrence = new Map();

const candidates = sourceRows.flatMap((row, index) => {
  const word = text(row["work bank"]).toLowerCase();
  if (!word) return [];
  const senseNo = (occurrence.get(word) || 0) + 1;
  occurrence.set(word, senseNo);
  const meaningLines = lines(row[meaningColumn]);
  const sentenceLines = lines(row[sentenceColumn]);
  const pos = inferPos(meaningLines.slice(0, 4).join(" "));
  const meaningZh = chooseMeaning(word, meaningLines);
  const selectedExample = chooseExample(word, sentenceLines);
  const exampleEn = selectedExample.line;
  const exampleZh = pairedChinese(exampleEn, sentenceLines);
  const collocations = unique(
    meaningLines
      .filter((line) => /常用語|collocation|\(phr\.?\)|\bphrase\b/i.test(line))
      .map((line) => line.replace(/^常用語[:：]\s*/i, "").trim()),
  ).slice(0, 3);
  const issues = [];
  if ((termsCount.get(word) || 0) > 1) issues.push("同字多列：確認是否為不同義項");
  if (!pos) issues.push("詞性待確認");
  if (!meaningZh) issues.push("缺核心中文義項");
  if (!exampleEn) issues.push("缺可出題例句");
  if (selectedExample.variantOnly) issues.push("例句使用字形變化");
  if (meaningLines.length >= 8) issues.push("原始意義過長，需拆義項");
  if (sentenceLines.length >= 8) issues.push("例句過多，需挑主句");
  const ready = Boolean(pos && meaningZh && exampleEn) && issues.length === 0;
  return [
    {
      status: ready ? "可匯入候選" : "待人工確認",
      sourceRow: index + 2,
      word,
      senseNo,
      ipa: text(row.IPA),
      pos,
      meaningZh,
      exampleEn,
      exampleZh,
      collocations: collocations.join(" | "),
      issues: issues.join("；"),
      rawMeaning: text(row[meaningColumn]),
      rawExamples: text(row[sentenceColumn]),
    },
  ];
});

const reviewRows = candidates.filter((row) => row.status === "待人工確認");
const readyRows = candidates.filter((row) => row.status === "可匯入候選");
const officialRows = readyRows.filter((row) => qualityIssues(row).length === 0);
const qualityReviewRows = readyRows
  .filter((row) => qualityIssues(row).length > 0)
  .map((row) => ({ ...row, qualityIssues: qualityIssues(row).join("；") }));
const duplicateTerms = Array.from(termsCount.entries()).filter(([, count]) => count > 1);
const missingMeaning = candidates.filter((row) => !row.meaningZh).length;
const missingExample = candidates.filter((row) => !row.exampleEn).length;
const missingPos = candidates.filter((row) => !row.pos).length;

const book = Workbook.create();
const summary = book.worksheets.add("清洗摘要");
const cleaned = book.worksheets.add("清洗候選");
const review = book.worksheets.add("待人工確認");
const source = book.worksheets.add("原始內容對照");
const excluded = book.worksheets.add("其他工作表");

summary.showGridLines = false;
summary.getRange("A1:G1").merge();
summary.getRange("A1").values = [["WORDBANK 清洗預覽"]];
summary.getRange("A1:G1").format = {
  fill: "#1D4ED8",
  font: { bold: true, color: "#FFFFFF", size: 18 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
summary.getRange("A1:G1").format.rowHeight = 34;
summary.getRange("A3:B10").values = [
  ["項目", "數量"],
  ["來源資料列", sourceRows.length],
  ["可辨識主詞彙列", candidates.length],
  ["不重複主詞彙", termsCount.size],
  ["重複詞組", duplicateTerms.length],
  ["可匯入候選列", readyRows.length],
  ["待人工確認列", reviewRows.length],
  ["未匯入工作表", original.SheetNames.length - 1],
];
summary.getRange("A3:B3").format = { fill: "#DBEAFE", font: { bold: true, color: "#1E3A8A" } };
summary.getRange("A3:B10").format.borders = { style: "continuous", color: "#CBD5E1" };
summary.getRange("D3:E7").values = [
  ["常見問題", "數量"],
  ["缺核心中文義項", missingMeaning],
  ["缺可出題例句", missingExample],
  ["詞性待確認", missingPos],
  ["同字多列", duplicateTerms.length],
];
summary.getRange("D3:E3").format = { fill: "#FEF3C7", font: { bold: true, color: "#92400E" } };
summary.getRange("D3:E7").format.borders = { style: "continuous", color: "#CBD5E1" };
summary.getRange("A13:G17").values = [
  ["建議確認流程", "", "", "", "", "", ""],
  ["1", "先查看「待人工確認」：補核心義項、指定可出題例句、確認多義詞。", "", "", "", "", ""],
  ["2", "確認完成後，「清洗候選」可作為新 app 字庫輸入格式的基礎。", "", "", "", "", ""],
  ["3", "原始內容未刪除，完整保留於「原始內容對照」方便核對。", "", "", "", "", ""],
  ["備註", "目前學習紀錄屬測試資料，正式建立新字庫時可重新開始統計。", "", "", "", "", ""],
];
summary.getRange("A13:G13").merge();
summary.getRange("A13:G13").format = { fill: "#E0F2FE", font: { bold: true, color: "#075985" } };
for (const rowNumber of [14, 15, 16, 17]) summary.getRange(`B${rowNumber}:G${rowNumber}`).merge();
summary.getRange("A14:G17").format = { wrapText: true, verticalAlignment: "center" };
summary.getRange("A:A").format.columnWidth = 22;
summary.getRange("B:B").format.columnWidth = 20;
summary.getRange("D:D").format.columnWidth = 25;
summary.getRange("E:E").format.columnWidth = 14;
summary.getRange("B14:G17").format.columnWidth = 21;

const cleanHeaders = [
  "狀態",
  "來源列",
  "word",
  "sense",
  "IPA",
  "詞性",
  "核心中文義項",
  "主要例句（可供遊戲）",
  "例句中文",
  "搭配詞",
  "需確認事項",
];
const cleanValues = candidates.map((row) => [
  row.status,
  row.sourceRow,
  row.word,
  row.senseNo,
  row.ipa,
  row.pos,
  row.meaningZh,
  row.exampleEn,
  row.exampleZh,
  row.collocations,
  row.issues,
].map(excelLiteral));
cleaned.getRangeByIndexes(0, 0, cleanValues.length + 1, cleanHeaders.length).values = [cleanHeaders, ...cleanValues];
cleaned.tables.add(`A1:K${cleanValues.length + 1}`, true, "CleanCandidates");
cleaned.freezePanes.freezeRows(1);
cleaned.showGridLines = false;
cleaned.getRange("A1:K1").format = { fill: "#1D4ED8", font: { bold: true, color: "#FFFFFF" } };
cleaned.getRange(`A2:K${cleanValues.length + 1}`).format = { wrapText: true, verticalAlignment: "top" };
for (const [column, width] of [["A", 16], ["B", 10], ["C", 18], ["D", 8], ["E", 22], ["F", 15], ["G", 30], ["H", 52], ["I", 36], ["J", 34], ["K", 40]]) {
  cleaned.getRange(`${column}:${column}`).format.columnWidth = width;
}

const reviewHeaders = ["狀態", "來源列", "word", "sense", "詞性", "核心中文義項", "主要例句", "需確認事項"];
const reviewValues = reviewRows.map((row) => [
  row.status,
  row.sourceRow,
  row.word,
  row.senseNo,
  row.pos,
  row.meaningZh,
  row.exampleEn,
  row.issues,
].map(excelLiteral));
review.getRangeByIndexes(0, 0, reviewValues.length + 1, reviewHeaders.length).values = [reviewHeaders, ...reviewValues];
review.tables.add(`A1:H${reviewValues.length + 1}`, true, "ReviewQueue");
review.freezePanes.freezeRows(1);
review.showGridLines = false;
review.getRange("A1:H1").format = { fill: "#B45309", font: { bold: true, color: "#FFFFFF" } };
review.getRange(`A2:H${reviewValues.length + 1}`).format = { wrapText: true, verticalAlignment: "top" };
for (const [column, width] of [["A", 16], ["B", 10], ["C", 20], ["D", 8], ["E", 15], ["F", 32], ["G", 56], ["H", 48]]) {
  review.getRange(`${column}:${column}`).format.columnWidth = width;
}

const rawHeaders = ["來源列", "word", "IPA", "原始意義/詞性欄", "原始例句欄"];
const rawValues = candidates.map((row) => [row.sourceRow, row.word, row.ipa, row.rawMeaning, row.rawExamples].map(excelLiteral));
source.getRangeByIndexes(0, 0, rawValues.length + 1, rawHeaders.length).values = [rawHeaders, ...rawValues];
source.tables.add(`A1:E${rawValues.length + 1}`, true, "RawImportedSource");
source.freezePanes.freezeRows(1);
source.showGridLines = false;
source.getRange("A1:E1").format = { fill: "#334155", font: { bold: true, color: "#FFFFFF" } };
source.getRange(`A2:E${rawValues.length + 1}`).format = { wrapText: true, verticalAlignment: "top" };
for (const [column, width] of [["A", 10], ["B", 20], ["C", 24], ["D", 68], ["E", 78]]) {
  source.getRange(`${column}:${column}`).format.columnWidth = width;
}

const excludedValues = original.SheetNames.map((name, index) => {
  const sheet = original.Sheets[name];
  const range = sheet["!ref"] || "";
  return [name, range, index === 0 ? "目前 app 匯入來源" : "目前 app 不匯入；另行評估片語/文法模組用途"];
});
excluded.getRangeByIndexes(0, 0, excludedValues.length + 1, 3).values = [["工作表", "使用範圍", "處理說明"], ...excludedValues];
excluded.tables.add(`A1:C${excludedValues.length + 1}`, true, "ExcludedSheets");
excluded.showGridLines = false;
excluded.getRange("A1:C1").format = { fill: "#0F766E", font: { bold: true, color: "#FFFFFF" } };
excluded.getRange("A:C").format = { wrapText: true, verticalAlignment: "top" };
excluded.getRange("A:A").format.columnWidth = 24;
excluded.getRange("B:B").format.columnWidth = 18;
excluded.getRange("C:C").format.columnWidth = 54;

const summaryCheck = await book.inspect({ kind: "table", range: "清洗摘要!A1:G17", include: "values,formulas", tableMaxRows: 20, tableMaxCols: 8 });
console.log(summaryCheck.ndjson);
const errorScan = await book.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 30 },
  summary: "formula errors",
});
console.log(errorScan.ndjson);
for (const [sheetName, range, filename] of [
  ["清洗摘要", "A1:G17", "cleanup_summary_preview.png"],
  ["清洗候選", "A1:K10", "cleanup_candidates_preview.png"],
  ["待人工確認", "A1:H10", "cleanup_review_preview.png"],
  ["原始內容對照", "A1:E6", "cleanup_source_preview.png"],
  ["其他工作表", "A1:C8", "cleanup_sheets_preview.png"],
]) {
  const preview = await book.render({ sheetName, range, scale: 1.2, format: "png" });
  await fs.writeFile(`./${filename}`, new Uint8Array(await preview.arrayBuffer()));
}
const exportFile = await SpreadsheetFile.exportXlsx(book);
await exportFile.save(outputPath);

const officialBook = Workbook.create();
const approvedSheet = officialBook.worksheets.add("Approved");
const officialHeaders = [
  "datasetType",
  "senseId",
  "word",
  "ipa",
  "pos",
  "definitionZh",
  "sentence",
  "sentenceZh",
  "collocation",
  "reviewStatus",
  "gameModesReady",
  "sourceRow",
];
const officialValues = officialRows.map((row) =>
  [
    "english-hero-official-v1",
    `${row.word}-${row.pos}-${row.senseNo}`,
    row.word,
    row.ipa,
    row.pos,
    row.meaningZh,
    row.exampleEn,
    row.exampleZh,
    row.collocations,
    "approved",
    "2-1|2-2|2-3|3",
    row.sourceRow,
  ].map(excelLiteral),
);
approvedSheet.getRangeByIndexes(0, 0, officialValues.length + 1, officialHeaders.length).values = [officialHeaders, ...officialValues];
approvedSheet.tables.add(`A1:L${officialValues.length + 1}`, true, "ApprovedWords");
approvedSheet.freezePanes.freezeRows(1);
approvedSheet.showGridLines = false;
approvedSheet.getRange("A1:L1").format = { fill: "#166534", font: { bold: true, color: "#FFFFFF" } };
approvedSheet.getRange(`A2:L${officialValues.length + 1}`).format = { wrapText: true, verticalAlignment: "top" };
for (const [column, width] of [["A", 24], ["B", 28], ["C", 18], ["D", 22], ["E", 15], ["F", 30], ["G", 55], ["H", 34], ["I", 32], ["J", 16], ["K", 22], ["L", 10]]) {
  approvedSheet.getRange(`${column}:${column}`).format.columnWidth = width;
}
const officialNotes = officialBook.worksheets.add("匯入說明");
officialNotes.getRange("A1:D1").merge();
officialNotes.getRange("A1").values = [["English Hero 正式初版字庫"]];
officialNotes.getRange("A1:D1").format = { fill: "#166534", font: { bold: true, color: "#FFFFFF", size: 16 } };
officialNotes.getRange("A3:B7").values = [
  ["項目", "說明"],
  ["核准義項數", officialRows.length],
  ["資料來源", "WORDBANK_New_2026Apr.xlsx / word bank_all"],
  ["匯入行為", "app 將辨識 english-hero-official-v1，取代測試字庫並重設學習統計"],
  ["遊戲條件", "僅使用已核准且具有可出題例句之資料"],
];
officialNotes.getRange("A3:B3").format = { fill: "#DCFCE7", font: { bold: true, color: "#166534" } };
officialNotes.getRange("A3:B7").format = { wrapText: true, verticalAlignment: "top" };
officialNotes.getRange("A:A").format.columnWidth = 22;
officialNotes.getRange("B:B").format.columnWidth = 86;
const officialErrorScan = await officialBook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 30 },
  summary: "official formula errors",
});
console.log(officialErrorScan.ndjson);
for (const [sheetName, range, filename] of [
  ["Approved", "A1:L10", "official_preview.png"],
  ["匯入說明", "A1:D7", "official_notes_preview.png"],
]) {
  const preview = await officialBook.render({ sheetName, range, scale: 1.2, format: "png" });
  await fs.writeFile(`./${filename}`, new Uint8Array(await preview.arrayBuffer()));
}
const officialExport = await SpreadsheetFile.exportXlsx(officialBook);
await officialExport.save(officialOutputPath);

const reviewBook = Workbook.create();
const qualitySheet = reviewBook.worksheets.add("Review_58");
const qualityHeaders = ["sourceRow", "word", "sense", "ipa", "pos", "meaningZh", "sentence", "sentenceZh", "collocation", "qualityIssues"];
const qualityValues = qualityReviewRows.map((row) =>
  [row.sourceRow, row.word, row.senseNo, row.ipa, row.pos, row.meaningZh, row.exampleEn, row.exampleZh, row.collocations, row.qualityIssues].map(excelLiteral),
);
qualitySheet.getRangeByIndexes(0, 0, qualityValues.length + 1, qualityHeaders.length).values = [qualityHeaders, ...qualityValues];
qualitySheet.tables.add(`A1:J${qualityValues.length + 1}`, true, "QualityReview58");
qualitySheet.freezePanes.freezeRows(1);
qualitySheet.showGridLines = false;
qualitySheet.getRange("A1:J1").format = { fill: "#B45309", font: { bold: true, color: "#FFFFFF" } };
qualitySheet.getRange(`A2:J${qualityValues.length + 1}`).format = { wrapText: true, verticalAlignment: "top" };
for (const [column, width] of [["A", 12], ["B", 20], ["C", 8], ["D", 22], ["E", 15], ["F", 34], ["G", 58], ["H", 36], ["I", 34], ["J", 44]]) {
  qualitySheet.getRange(`${column}:${column}`).format.columnWidth = width;
}
const reviewErrorScan = await reviewBook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 30 },
  summary: "review formula errors",
});
console.log(reviewErrorScan.ndjson);
const reviewPreview = await reviewBook.render({ sheetName: "Review_58", range: "A1:J10", scale: 1.2, format: "png" });
await fs.writeFile("./review_58_preview.png", new Uint8Array(await reviewPreview.arrayBuffer()));
const reviewExport = await SpreadsheetFile.exportXlsx(reviewBook);
await reviewExport.save(reviewOutputPath);

console.log(
  JSON.stringify({
    outputPath,
    officialOutputPath,
    reviewOutputPath,
    candidateRows: candidates.length,
    readyRows: readyRows.length,
    officialRows: officialRows.length,
    qualityReviewRows: qualityReviewRows.length,
    reviewRows: reviewRows.length,
  }),
);
