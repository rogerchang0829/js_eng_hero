"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Heart,
  Languages,
  Music2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";

type Tab = "lab" | "flashcard" | "game" | "outcome";
type GameMode = "2-1" | "2-2" | "2-3" | "3";

interface WordItem {
  id: string;
  word: string;
  definitionZh: string;
  pos: string;
  ipa: string;
  sentence: string;
  definitionEn?: string;
  sentenceZh?: string;
  collocation?: string;
  category?: string;
  level?: string;
  note?: string;
  usage?: string[];
  examples?: string[];
}

interface Stats {
  totalHits: number;
  totalMisses: number;
  totalPracticeSeconds: number;
}

interface GameSettings {
  speed: number;
  spawnMs: number;
  mode: GameMode;
  fontSize: number;
}

interface FallingWord extends WordItem {
  gameId: string;
  x: number;
  y: number;
  lane: number;
  bornAt: number;
  isHit?: boolean;
}

interface HitParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

const BLUE = "#2563eb";
const STARTING_HP = 5;

const PRELOAD_WORDS: Omit<WordItem, "id">[] = [
  { word: "coordinate", definitionZh: "協調", pos: "verb", ipa: "/koʊˈɔrdɪneɪt/", sentence: "Please coordinate with design before release." },
  { word: "deadline", definitionZh: "截止期限", pos: "noun", ipa: "/ˈdedlaɪn/", sentence: "The deadline for this sprint is Friday." },
  { word: "incentive", definitionZh: "獎勵措施", pos: "noun", ipa: "/ɪnˈsentɪv/", sentence: "The company introduced an incentive for referrals." },
  { word: "colleague", definitionZh: "同事", pos: "noun", ipa: "/ˈkɑliɡ/", sentence: "A colleague helped me debug the API." },
  { word: "flexible", definitionZh: "彈性的", pos: "adjective", ipa: "/ˈfleksəb(ə)l/", sentence: "Our team has flexible working hours." },
  { word: "efficiency", definitionZh: "效率", pos: "noun", ipa: "/ɪˈfɪʃənsi/", sentence: "Automation improved our efficiency." },
  { word: "agenda", definitionZh: "議程", pos: "noun", ipa: "/əˈdʒendə/", sentence: "Let's finalize the meeting agenda." },
  { word: "briefing", definitionZh: "簡報會", pos: "noun", ipa: "/ˈbrifɪŋ/", sentence: "We have a client briefing at 10 AM." },
  { word: "proposal", definitionZh: "提案", pos: "noun", ipa: "/prəˈpoʊz(ə)l/", sentence: "Her proposal received positive feedback." },
  { word: "stakeholder", definitionZh: "利害關係人", pos: "noun", ipa: "/ˈsteɪkˌhoʊldər/", sentence: "Keep stakeholders updated weekly." },
  { word: "workflow", definitionZh: "工作流程", pos: "noun", ipa: "/ˈwɝːkfloʊ/", sentence: "We redesigned the workflow for support tickets." },
  { word: "backlog", definitionZh: "待辦清單", pos: "noun", ipa: "/ˈbækˌlɔɡ/", sentence: "The backlog needs grooming before planning." },
  { word: "milestone", definitionZh: "里程碑", pos: "noun", ipa: "/ˈmaɪlˌstoʊn/", sentence: "The beta launch is our next milestone." },
  { word: "roadmap", definitionZh: "路線圖", pos: "noun", ipa: "/ˈroʊdˌmæp/", sentence: "The roadmap covers Q3 priorities." },
  { word: "deliverable", definitionZh: "交付成果", pos: "noun", ipa: "/dɪˈlɪvərəb(ə)l/", sentence: "Please upload each deliverable by noon." },
  { word: "iteration", definitionZh: "迭代", pos: "noun", ipa: "/ˌɪtəˈreɪʃ(ə)n/", sentence: "This feature improved in the second iteration." },
  { word: "retrospective", definitionZh: "回顧會議", pos: "noun", ipa: "/ˌretrəˈspektɪv/", sentence: "The team shared insights in retrospective." },
  { word: "onboarding", definitionZh: "入職培訓", pos: "noun", ipa: "/ˈɑnˌbɔrdɪŋ/", sentence: "We updated onboarding for new engineers." },
  { word: "offboarding", definitionZh: "離職交接", pos: "noun", ipa: "/ˈɔfˌbɔrdɪŋ/", sentence: "Offboarding documents must be completed." },
  { word: "synergy", definitionZh: "協同效應", pos: "noun", ipa: "/ˈsɪnərdʒi/", sentence: "Cross-team synergy accelerated delivery." },
  { word: "compliance", definitionZh: "合規", pos: "noun", ipa: "/kəmˈplaɪəns/", sentence: "All reports must meet compliance rules." },
  { word: "confidential", definitionZh: "機密的", pos: "adjective", ipa: "/ˌkɑnfəˈdenʃ(ə)l/", sentence: "This document is confidential." },
  { word: "escalate", definitionZh: "升級處理", pos: "verb", ipa: "/ˈeskəˌleɪt/", sentence: "Escalate critical incidents immediately." },
  { word: "prioritize", definitionZh: "排定優先順序", pos: "verb", ipa: "/praɪˈɔrəˌtaɪz/", sentence: "We should prioritize customer-facing bugs." },
  { word: "allocate", definitionZh: "分配", pos: "verb", ipa: "/ˈæləˌkeɪt/", sentence: "Allocate more time for QA testing." },
  { word: "budget", definitionZh: "預算", pos: "noun", ipa: "/ˈbʌdʒɪt/", sentence: "The budget was approved this morning." },
  { word: "forecast", definitionZh: "預測", pos: "noun", ipa: "/ˈfɔrˌkæst/", sentence: "Sales forecast looks optimistic." },
  { word: "invoice", definitionZh: "發票", pos: "noun", ipa: "/ˈɪnˌvɔɪs/", sentence: "Please send the invoice today." },
  { word: "reimbursement", definitionZh: "報銷", pos: "noun", ipa: "/ˌriɪmˈbɝsmənt/", sentence: "Travel reimbursement takes seven days." },
  { word: "quarterly", definitionZh: "每季的", pos: "adjective", ipa: "/ˈkwɔrtərli/", sentence: "Quarterly reports are due next week." },
  { word: "brainstorm", definitionZh: "腦力激盪", pos: "verb", ipa: "/ˈbreɪnˌstɔrm/", sentence: "Let's brainstorm campaign ideas." },
  { word: "feedback", definitionZh: "回饋", pos: "noun", ipa: "/ˈfidˌbæk/", sentence: "Client feedback was very constructive." },
  { word: "benchmark", definitionZh: "基準", pos: "noun", ipa: "/ˈbentʃˌmɑrk/", sentence: "We set a benchmark for response time." },
  { word: "turnaround", definitionZh: "完成週期", pos: "noun", ipa: "/ˈtɝnəˌraʊnd/", sentence: "The turnaround time improved by 20%." },
  { word: "optimize", definitionZh: "最佳化", pos: "verb", ipa: "/ˈɑptəˌmaɪz/", sentence: "We need to optimize database queries." },
  { word: "streamline", definitionZh: "簡化流程", pos: "verb", ipa: "/ˈstrimˌlaɪn/", sentence: "The new process streamlines approvals." },
  { word: "handover", definitionZh: "交接", pos: "noun", ipa: "/ˈhændˌoʊvər/", sentence: "The project handover starts tomorrow." },
  { word: "follow-up", definitionZh: "後續追蹤", pos: "noun", ipa: "/ˈfɑloʊ ʌp/", sentence: "I will send a follow-up email." },
  { word: "minutes", definitionZh: "會議記錄", pos: "noun", ipa: "/ˈmɪnɪts/", sentence: "Could you share the meeting minutes?" },
  { word: "negotiate", definitionZh: "協商", pos: "verb", ipa: "/nɪˈɡoʊʃieɪt/", sentence: "They negotiated a better contract." },
  { word: "contract", definitionZh: "合約", pos: "noun", ipa: "/ˈkɑnˌtrækt/", sentence: "The contract expires in June." },
  { word: "renewal", definitionZh: "續約", pos: "noun", ipa: "/rɪˈnuəl/", sentence: "Customer renewal rates are strong." },
  { word: "comprehensive", definitionZh: "全面的", pos: "adjective", ipa: "/ˌkɑmprɪˈhensɪv/", sentence: "We wrote a comprehensive guide." },
  { word: "initiative", definitionZh: "倡議", pos: "noun", ipa: "/ɪˈnɪʃətɪv/", sentence: "This initiative reduces operational risk." },
  { word: "facilitate", definitionZh: "促進", pos: "verb", ipa: "/fəˈsɪləˌteɪt/", sentence: "A clear brief facilitates collaboration." },
  { word: "delegate", definitionZh: "委派", pos: "verb", ipa: "/ˈdelɪɡət/", sentence: "Managers should delegate effectively." },
  { word: "alignment", definitionZh: "一致性", pos: "noun", ipa: "/əˈlaɪnmənt/", sentence: "Team alignment is essential this quarter." },
  { word: "ownership", definitionZh: "責任歸屬", pos: "noun", ipa: "/ˈoʊnərˌʃɪp/", sentence: "Take ownership of your module." },
  { word: "resource", definitionZh: "資源", pos: "noun", ipa: "/ˈriˌsɔrs/", sentence: "We need more resource for support." },
  { word: "reschedule", definitionZh: "改期", pos: "verb", ipa: "/riˈskedʒul/", sentence: "Let's reschedule the client call." },
];

function makeId() {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toWordItems(source: Omit<WordItem, "id">[]): WordItem[] {
  return source.map((item) => ({ ...item, id: makeId() }));
}

function normalizeWordRow(row: Partial<WordItem> & { word?: string; definitionZh?: string }): Omit<WordItem, "id"> | null {
  const word = (row.word || "").trim().toLowerCase();
  if (!word) return null;
  const sentenceRaw = (row.sentence || `Use "${word}" in a sentence.`).trim();
  const mixed = splitMixedLangLine(sentenceRaw);
  return {
    word,
    definitionZh: (row.definitionZh || "（待補中文）").trim(),
    sentence: mixed.en || sentenceRaw,
    pos: (row.pos || "unknown").trim(),
    ipa: (row.ipa || "/.../").trim(),
    definitionEn: row.definitionEn?.trim(),
    sentenceZh: row.sentenceZh?.trim() || mixed.zh,
    collocation: row.collocation?.trim(),
    category: row.category?.trim(),
    level: row.level?.trim(),
    note: row.note?.trim(),
    usage: uniqNormalized((row.usage || []).filter(Boolean)),
    examples: uniqNormalized((row.examples || []).filter(Boolean)),
  };
}

function inferPos(raw: string): string {
  const t = raw.toLowerCase();
  if (t.includes("noun")) return "noun";
  if (t.includes("verb")) return "verb";
  if (t.includes("adjective")) return "adjective";
  if (t.includes("adverb")) return "adverb";
  if (t.includes("pronoun")) return "pronoun";
  if (t.includes("preposition")) return "preposition";
  if (t.includes("conjunction")) return "conjunction";
  if (t.includes("determiner")) return "determiner";
  return "unknown";
}

function splitUsefulLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0 && line !== "-" && line !== "•");
}

function uniqNormalized(lines: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(line);
  }
  return output;
}

function splitMixedLangLine(line: string): { en?: string; zh?: string } {
  const parts = line
    .split(/(?<=[.!?。！？])\s+|[;；]| \- /)
    .map((p) => p.trim())
    .filter(Boolean);
  let en = "";
  let zh = "";
  for (const part of parts.length ? parts : [line]) {
    const hasZh = /[\u4e00-\u9fff]/.test(part);
    const hasEn = /[a-zA-Z]/.test(part);
    if (hasEn && !hasZh && !en) en = part;
    if (hasZh && !zh) zh = part;
    if (hasEn && hasZh && !en) {
      const pureEn = part.replace(/[\u4e00-\u9fff].*$/g, "").trim();
      if (pureEn) en = pureEn;
      if (!zh) zh = part;
    }
  }
  return { en: en || undefined, zh: zh || undefined };
}

function summarizeNoteBullets(lines: string[]): string {
  const picked = uniqNormalized(
    lines.filter((line) => line.length > 8 && !/^[0-9]+[.)]?$/.test(line)).slice(0, 12),
  ).slice(0, 3);
  return picked.map((line) => `• ${line}`).join("\n");
}

function pickFirstChineseLine(lines: string[]): string | undefined {
  return lines.find((line) => /[\u4e00-\u9fff]/.test(line));
}

function pickFirstEnglishLine(lines: string[]): string | undefined {
  return lines.find((line) => /[a-zA-Z]/.test(line) && !/[\u4e00-\u9fff]/.test(line));
}

function enrichFromRichText(rawMeaning: string, rawSentence: string) {
  const meaningLines = uniqNormalized(splitUsefulLines(rawMeaning));
  const sentenceLines = uniqNormalized(splitUsefulLines(rawSentence));
  const all = [...meaningLines, ...sentenceLines];

  const definitionZh = pickFirstChineseLine(all) || pickFirstEnglishLine(all) || "（待補中文）";
  const definitionEn = pickFirstEnglishLine(all);
  const primarySentence = pickFirstEnglishLine(sentenceLines) || pickFirstEnglishLine(all) || "";
  const mixedPair = splitMixedLangLine(primarySentence);
  const sentence = mixedPair.en || primarySentence;
  const sentenceZh = mixedPair.zh || pickFirstChineseLine(sentenceLines);
  const usage = all
    .filter((line) => /常用語|片語|phrase|collocation|•|->|fall prey|submit|accept|draw/i.test(line))
    .slice(0, 5);
  const examples = uniqNormalized(
    sentenceLines
      .filter((line) => /[.!?。！？]/.test(line))
      .map((line) => splitMixedLangLine(line).en || line),
  ).slice(0, 4);
  const noteCandidates = all.filter((line) => line !== definitionZh && line !== definitionEn);

  return {
    definitionZh,
    definitionEn,
    sentence,
    sentenceZh,
    usage,
    examples,
    note: summarizeNoteBullets(noteCandidates),
    pos: inferPos(rawMeaning),
  };
}

function parseReadlangRows(text: string): Omit<WordItem, "id">[] {
  return text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((line) => {
      const cols = line.split("\t");
      const word = (cols[0] || "").trim().toLowerCase();
      const definitionZh = (cols[1] || "（待補中文）").trim();
      const sentence = (cols[2] || cols[3] || `Use "${word}" in a sentence.`).trim();
      return normalizeWordRow({
        word,
        definitionZh,
        sentence,
      });
    })
    .filter((it): it is Omit<WordItem, "id"> => Boolean(it));
}

function parseDelimitedRows(text: string, delimiter: "," | "\t"): Omit<WordItem, "id">[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const keyify = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const headers = lines[0].split(delimiter).map((h) => keyify(h));
  const mapHeader = (name: string) => headers.indexOf(keyify(name));
  const idx = {
    word: [mapHeader("word"), mapHeader("english"), mapHeader("vocab"), mapHeader("wordbank"), mapHeader("workbank")].find((x) => x >= 0) ?? 0,
    definitionZh: [mapHeader("definitionzh"), mapHeader("zh"), mapHeader("chinese"), mapHeader("translation")].find((x) => x >= 0) ?? 1,
    sentence: [mapHeader("sentence"), mapHeader("stentence"), mapHeader("example"), mapHeader("context")].find((x) => x >= 0) ?? 2,
    definitionEn: [mapHeader("definitionen"), mapHeader("definition"), mapHeader("meaning")].find((x) => x >= 0) ?? -1,
    sentenceZh: [mapHeader("sentencezh"), mapHeader("examplezh"), mapHeader("cn_sentence")].find((x) => x >= 0) ?? -1,
    pos: [mapHeader("pos"), mapHeader("partofspeech")].find((x) => x >= 0) ?? -1,
    ipa: [mapHeader("ipa"), mapHeader("phonetic"), mapHeader("pronunciation")].find((x) => x >= 0) ?? -1,
    collocation: [mapHeader("collocation"), mapHeader("phrase")].find((x) => x >= 0) ?? -1,
    category: [mapHeader("category"), mapHeader("topic"), mapHeader("tag")].find((x) => x >= 0) ?? -1,
    level: [mapHeader("level"), mapHeader("cefr"), mapHeader("difficulty")].find((x) => x >= 0) ?? -1,
    note: [mapHeader("note"), mapHeader("memo")].find((x) => x >= 0) ?? -1,
  };

  return lines
    .slice(1)
    .map((line) => line.split(delimiter))
    .map((cols) =>
      normalizeWordRow({
        word: cols[idx.word],
        definitionZh: cols[idx.definitionZh],
        sentence: cols[idx.sentence],
        definitionEn: idx.definitionEn >= 0 ? cols[idx.definitionEn] : undefined,
        sentenceZh: idx.sentenceZh >= 0 ? cols[idx.sentenceZh] : undefined,
        pos: idx.pos >= 0 ? cols[idx.pos] : undefined,
        ipa: idx.ipa >= 0 ? cols[idx.ipa] : undefined,
        collocation: idx.collocation >= 0 ? cols[idx.collocation] : undefined,
        category: idx.category >= 0 ? cols[idx.category] : undefined,
        level: idx.level >= 0 ? cols[idx.level] : undefined,
        note: idx.note >= 0 ? cols[idx.note] : undefined,
      }),
    )
    .filter((it): it is Omit<WordItem, "id"> => Boolean(it));
}

function buildHint(word: string): string {
  if (word.length <= 2) return word;
  const visibleCount = Math.max(2, Math.ceil(word.length / 3));
  const revealed = new Set<number>([0, word.length - 1]);
  for (let idx = 1; revealed.size < visibleCount && idx < word.length - 1; idx += 2) {
    revealed.add(idx);
  }
  return word
    .split("")
    .map((ch, idx) => (revealed.has(idx) || /[^a-zA-Z]/.test(ch) ? ch : "_"))
    .join(" ");
}

function makeCloze(sentence: string, word: string): string {
  if (!sentence || !word) return sentence;
  const matcher = new RegExp(word, "i");
  if (matcher.test(sentence)) return sentence.replace(matcher, "_____");
  return `${sentence} (fill: ${word})`;
}

function secondsToClock(total: number): string {
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function EnglishHeroPage() {
  const [activeTab, setActiveTab] = useState<Tab>("lab");
  const [words, setWords] = useState<WordItem[]>([]);
  const [stats, setStats] = useState<Stats>({ totalHits: 0, totalMisses: 0, totalPracticeSeconds: 0 });
  const [gameSettings, setGameSettings] = useState<GameSettings>({ speed: 0.12, spawnMs: 2200, mode: "2-1", fontSize: 13 });
  const [isHydrated, setIsHydrated] = useState(false);

  const accuracy = useMemo(() => {
    const total = stats.totalHits + stats.totalMisses;
    if (total === 0) return 0;
    return Math.round((stats.totalHits / total) * 100);
  }, [stats.totalHits, stats.totalMisses]);

  useEffect(() => {
    queueMicrotask(() => {
      const savedWordsRaw = localStorage.getItem("eh_v2_words");
      const savedStatsRaw = localStorage.getItem("eh_v2_stats");
      const savedSettingsRaw = localStorage.getItem("eh_v2_game_settings");

      if (savedWordsRaw) {
        setWords(JSON.parse(savedWordsRaw));
      } else {
        setWords(toWordItems(PRELOAD_WORDS));
      }
      if (savedStatsRaw) setStats(JSON.parse(savedStatsRaw));
      if (savedSettingsRaw) {
        setGameSettings((prev) => ({ ...prev, ...JSON.parse(savedSettingsRaw) }));
      }
      setIsHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem("eh_v2_words", JSON.stringify(words));
    localStorage.setItem("eh_v2_stats", JSON.stringify(stats));
    localStorage.setItem("eh_v2_game_settings", JSON.stringify(gameSettings));
  }, [words, stats, gameSettings, isHydrated]);

  useEffect(() => {
    if (activeTab !== "game") return;
    const timer = window.setInterval(() => {
      setStats((prev) => ({ ...prev, totalPracticeSeconds: prev.totalPracticeSeconds + 1 }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeTab]);

  const updateWord = (wordId: string, patch: Partial<WordItem>) => {
    setWords((prev) => prev.map((w) => (w.id === wordId ? { ...w, ...patch } : w)));
  };

  const enrichFromDictionary = async (wordId: string, targetWord: string) => {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(targetWord)}`);
      if (!res.ok) return;
      const data = (await res.json()) as Array<{
        phonetic?: string;
        phonetics?: Array<{ text?: string }>;
        meanings?: Array<{ partOfSpeech?: string }>;
      }>;
      const first = data?.[0];
      const ipa = first?.phonetic || first?.phonetics?.find((p) => p.text)?.text;
      const pos = first?.meanings?.[0]?.partOfSpeech;
      updateWord(wordId, {
        ipa: ipa || "/.../",
        pos: pos || "unknown",
      });
    } catch {
      // Ignore API failures to keep UX smooth.
    }
  };

  const handleAddWord = async (word: string, definitionZh: string, sentence: string) => {
    const cleanWord = word.trim().toLowerCase();
    if (!cleanWord) return;
    const item: WordItem = {
      id: makeId(),
      word: cleanWord,
      definitionZh: definitionZh.trim() || "（待補中文）",
      sentence: sentence.trim() || `I used "${cleanWord}" in a real project.`,
      ipa: "/.../",
      pos: "unknown",
    };
    setWords((prev) => [item, ...prev.filter((x) => x.word !== cleanWord)]);
    await enrichFromDictionary(item.id, item.word);
  };

  const parseExcelFile = async (file: File): Promise<Omit<WordItem, "id">[]> => {
    const XLSX = await import("xlsx");
    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    const keyify = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const pick = (row: Record<string, unknown>, names: string[]) => {
      const entries = Object.entries(row);
      const normalized = names.map((n) => keyify(n));
      const found = entries.find(([k]) => {
        const key = keyify(k);
        return normalized.some((n) => n === key || n.includes(key) || key.includes(n));
      });
      if (found) return String(found[1] ?? "");
      return "";
    };

    return rows
      .map((row) => {
        const vocabText = pick(row, ["word", "english", "vocab", "wordbank", "workbank"]);
        const longDefinition = pick(row, [
          "definitionzh",
          "zh",
          "chinese",
          "translation",
          "partsofspeech",
          "wordclass",
          "partofspeech",
        ]);
        const sentence = pick(row, ["sentence", "stentence", "example", "context"]);
        const posRaw = pick(row, ["pos", "partofspeech", "partsofspeech", "wordclass"]) || longDefinition;
        const rich = enrichFromRichText(longDefinition, sentence);
        return normalizeWordRow({
          word: vocabText,
          definitionZh: rich.definitionZh || longDefinition,
          sentence: rich.sentence || sentence,
          definitionEn: rich.definitionEn || pick(row, ["definitionen", "definition", "meaning"]),
          sentenceZh: rich.sentenceZh || pick(row, ["sentencezh", "examplezh", "cn_sentence"]),
          pos: posRaw ? inferPos(posRaw) : rich.pos,
          ipa: pick(row, ["ipa", "phonetic", "pronunciation"]),
          collocation: pick(row, ["collocation", "phrase"]) || rich.usage?.[0],
          category: pick(row, ["category", "topic", "tag"]),
          level: pick(row, ["level", "cefr", "difficulty"]),
          note: pick(row, ["note", "memo"]) || rich.note,
          usage: rich.usage,
          examples: rich.examples,
        });
      })
      .filter((it): it is Omit<WordItem, "id"> => Boolean(it));
  };

  const handleDropImport = async (file: File) => {
    const lowerName = file.name.toLowerCase();
    let parsed: Omit<WordItem, "id">[] = [];

    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      parsed = await parseExcelFile(file);
    } else if (lowerName.endsWith(".csv")) {
      parsed = parseDelimitedRows(await file.text(), ",");
    } else if (lowerName.endsWith(".tsv")) {
      parsed = parseDelimitedRows(await file.text(), "\t");
    } else if (lowerName.endsWith(".json")) {
      const data = JSON.parse(await file.text()) as Array<Record<string, unknown>>;
      parsed = data
        .map((row) =>
          normalizeWordRow({
            word: String(row.word ?? row.english ?? row.vocab ?? ""),
            definitionZh: String(row.definitionZh ?? row.zh ?? row.chinese ?? row.translation ?? ""),
            sentence: String(row.sentence ?? row.example ?? row.context ?? ""),
            definitionEn: String(row.definitionEn ?? row.definition ?? row.meaning ?? ""),
            sentenceZh: String(row.sentenceZh ?? row.exampleZh ?? ""),
            pos: String(row.pos ?? row.partOfSpeech ?? ""),
            ipa: String(row.ipa ?? row.phonetic ?? ""),
            collocation: String(row.collocation ?? row.phrase ?? ""),
            category: String(row.category ?? row.topic ?? row.tag ?? ""),
            level: String(row.level ?? row.cefr ?? row.difficulty ?? ""),
            note: String(row.note ?? row.memo ?? ""),
          }),
        )
        .filter((it): it is Omit<WordItem, "id"> => Boolean(it));
    } else {
      parsed = parseReadlangRows(await file.text());
    }

    if (parsed.length === 0) return;
    const prepared = toWordItems(parsed);
    const incomingWords = new Set(prepared.map((x) => x.word));
    setWords((prev) => [...prepared, ...prev.filter((x) => !incomingWords.has(x.word))]);
    prepared.forEach((item) => {
      void enrichFromDictionary(item.id, item.word);
    });
    setActiveTab("flashcard");
  };

  return (
    <main className="mx-auto flex h-dvh w-full max-w-xl flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">English Hero</p>
            <h1 className="text-xl font-bold text-slate-900">Office Word Trainer</h1>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Blue #{BLUE.slice(1)}</span>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto pb-24">
        {activeTab === "lab" && (
          <SmartLabView
            words={words}
            onAddWord={handleAddWord}
            onDeleteWord={(id) => setWords((prev) => prev.filter((w) => w.id !== id))}
            onDropImport={handleDropImport}
          />
        )}
        {activeTab === "flashcard" && <FlashcardView words={words} />}
        {activeTab === "game" && (
          <DefenseGameView
            words={words}
            settings={gameSettings}
            onChangeSettings={setGameSettings}
            onHit={() => setStats((prev) => ({ ...prev, totalHits: prev.totalHits + 1 }))}
            onMiss={() => setStats((prev) => ({ ...prev, totalMisses: prev.totalMisses + 1 }))}
          />
        )}
        {activeTab === "outcome" && (
          <OutcomeView
            vocabCount={words.length}
            hits={stats.totalHits}
            seconds={stats.totalPracticeSeconds}
            accuracy={accuracy}
          />
        )}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 mx-auto flex h-20 max-w-xl border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-1 backdrop-blur">
        {[
          { id: "lab" as const, label: "Smart Lab", icon: BookOpenText },
          { id: "flashcard" as const, label: "Flashcard", icon: Languages },
          { id: "game" as const, label: "Defense", icon: Gamepad2 },
          { id: "outcome" as const, label: "Outcome", icon: BarChart3 },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-1 flex-col items-center justify-center rounded-xl transition ${
                isActive ? "text-blue-600" : "text-slate-400"
              }`}
            >
              <Icon size={20} />
              <span className="mt-1 text-[11px] font-semibold">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}

function SmartLabView({
  words,
  onAddWord,
  onDeleteWord,
  onDropImport,
}: {
  words: WordItem[];
  onAddWord: (word: string, definitionZh: string, sentence: string) => Promise<void>;
  onDeleteWord: (id: string) => void;
  onDropImport: (file: File) => Promise<void>;
}) {
  const [newWord, setNewWord] = useState("");
  const [newDefinition, setNewDefinition] = useState("");
  const [newSentence, setNewSentence] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onSubmit = async () => {
    setIsSubmitting(true);
    await onAddWord(newWord, newDefinition, newSentence);
    setNewWord("");
    setNewDefinition("");
    setNewSentence("");
    setIsSubmitting(false);
  };

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const target = files[0];
    const supported = [".txt", ".tsv", ".csv", ".json", ".xlsx", ".xls"];
    const isSupported = supported.some((ext) => target.name.toLowerCase().endsWith(ext));
    if (!isSupported) return;
    await onDropImport(target);
  };

  return (
    <div className="space-y-4 px-4 py-4">
      <section
        className={`rounded-2xl border-2 border-dashed p-5 text-center transition ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDragging(false);
          await importFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="mx-auto mb-2 text-blue-600" />
        <p className="text-sm font-semibold text-slate-800">自訂單字庫 (lib)</p>
        <p className="mt-1 text-xs text-slate-500">支援 .txt / .tsv / .csv / .json / .xlsx</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          選擇檔案匯入
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.tsv,.csv,.json,.xlsx,.xls,text/plain,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={async (e) => importFiles(e.target.files)}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">手動新增單字</h2>
        <div className="grid gap-2">
          <input
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            placeholder="English word"
          />
          <input
            value={newDefinition}
            onChange={(e) => setNewDefinition(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            placeholder="中文定義"
          />
          <textarea
            value={newSentence}
            onChange={(e) => setNewSentence(e.target.value)}
            className="min-h-20 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            placeholder="原文句子（可選）"
          />
          <button
            type="button"
            disabled={isSubmitting || !newWord.trim()}
            onClick={() => void onSubmit()}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus size={16} />
            {isSubmitting ? "加入中..." : "新增到單字庫"}
          </button>
        </div>
      </section>

      <section className="space-y-2">
        {words.map((w) => (
          <article key={w.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-slate-900">{w.word}</p>
                <p className="text-xs text-slate-500">
                  {w.ipa} · {w.pos}
                </p>
                <p className="mt-1 text-sm text-blue-700">{w.definitionZh}</p>
              </div>
              <button
                type="button"
                onClick={() => onDeleteWord(w.id)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function FlashcardView({ words }: { words: WordItem[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const current = words[index];

  useEffect(() => {
    queueMicrotask(() => setIndex((prev) => (words.length === 0 ? 0 : prev % words.length)));
  }, [words.length]);

  if (!current) return <EmptyView title="尚無單字" description="請先到 Smart Lab 匯入或新增單字。" />;

  const shift = (delta: number) => {
    setFlipped(false);
    setIndex((prev) => (prev + delta + words.length) % words.length);
  };

  const speakWord = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(current.word);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const usageLines = (current.usage || [])
    .filter((line) => line && line !== current.definitionZh && line !== current.sentence)
    .slice(0, 4);
  const exampleLines = (current.examples || [])
    .filter((line) => line && line !== current.sentence)
    .slice(0, 3);

  return (
    <div className="px-4 py-6">
      <div className="mx-auto w-full max-w-md [perspective:1200px]">
        <button
          type="button"
          onClick={() => setFlipped((p) => !p)}
          className={`relative block h-[360px] w-full rounded-3xl text-left transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          <div className="absolute inset-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl [backface-visibility:hidden]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Front</p>
            <h2 className="mt-6 text-4xl font-bold tracking-tight text-slate-900">{current.word}</h2>
            <p className="mt-3 text-lg text-blue-700">{current.ipa}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {current.level && <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] text-blue-700">{current.level}</span>}
              {current.category && <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700">{current.category}</span>}
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700">{current.pos}</span>
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">核心義項</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-700">{current.definitionZh}</p>
            </div>
            <p className="mt-5 text-sm text-slate-500">點擊卡片翻面查看用法、例句與筆記</p>
          </div>
          <div className="absolute inset-0 overflow-y-auto rounded-3xl border border-blue-200 bg-blue-600 p-6 text-white shadow-xl [transform:rotateY(180deg)] [backface-visibility:hidden]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">Back</p>
            <div className="mt-3 space-y-3">
              <section className="rounded-xl bg-white/10 p-3">
                <p className="text-xs font-semibold text-blue-100">Meaning</p>
                <p className="mt-1 text-base font-semibold leading-snug text-white">{current.definitionZh}</p>
                {current.definitionEn && <p className="mt-1 text-sm leading-5 text-blue-100">{current.definitionEn}</p>}
              </section>

              <section className="rounded-xl bg-white/10 p-3">
                <p className="text-xs font-semibold text-blue-100">Usage</p>
                {current.collocation && <p className="mt-1 text-sm text-blue-50">搭配詞：{current.collocation}</p>}
                {usageLines.map((line, idx) => (
                  <p key={`${line}_${idx}`} className="mt-1 text-sm leading-5 text-blue-50">
                    • {line}
                  </p>
                ))}
              </section>

              <section className="rounded-xl bg-white/10 p-3">
                <p className="text-xs font-semibold text-blue-100">Examples</p>
                {current.sentence && <p className="mt-1 text-sm leading-6 text-blue-50">&quot;{current.sentence}&quot;</p>}
                {current.sentenceZh && <p className="mt-1 text-sm leading-6 text-blue-100">{current.sentenceZh}</p>}
                {exampleLines.map((line, idx) => (
                  <p key={`${line}_${idx}`} className="mt-1 text-sm leading-5 text-blue-100">
                    {line}
                  </p>
                ))}
              </section>

              {current.note && (
                <section className="rounded-xl bg-white/10 p-3">
                  <p className="text-xs font-semibold text-blue-100">Notes</p>
                  <p className="mt-1 whitespace-pre-line text-xs leading-5 text-blue-100">{current.note}</p>
                </section>
              )}
            </div>
          </div>
        </button>
      </div>

      <div className="mx-auto mt-5 flex max-w-md items-center gap-3">
        <button
          type="button"
          onClick={speakWord}
          className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-700"
          aria-label="播放發音"
        >
          <Volume2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => shift(-1)}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700"
        >
          <ChevronLeft size={16} />
          上一個
        </button>
        <button
          type="button"
          onClick={() => shift(1)}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white"
        >
          下一個
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function DefenseGameView({
  words,
  settings,
  onChangeSettings,
  onHit,
  onMiss,
}: {
  words: WordItem[];
  settings: GameSettings;
  onChangeSettings: (next: GameSettings) => void;
  onHit: () => void;
  onMiss: () => void;
}) {
  const [falling, setFalling] = useState<FallingWord[]>([]);
  const [input, setInput] = useState("");
  const [hp, setHp] = useState(STARTING_HP);
  const [phase, setPhase] = useState<"ready" | "playing" | "over">("ready");
  const [readyText, setReadyText] = useState("Ready");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [sessionHits, setSessionHits] = useState(0);
  const [sessionMisses, setSessionMisses] = useState(0);
  const [particles, setParticles] = useState<HitParticle[]>([]);
  const rafRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmTimerRef = useRef<number | null>(null);
  const beatStepRef = useRef(0);
  const lanes = useMemo(() => [28, 72], []);

  const getAudioContext = () => {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) audioCtxRef.current = new window.AudioContext();
    return audioCtxRef.current;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bgm = new Audio("/audio/defense-bgm.ogg");
    bgm.loop = true;
    bgm.preload = "auto";
    bgm.volume = 0.42;
    bgmAudioRef.current = bgm;

    return () => {
      bgm.pause();
      bgmAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const readyTimer = window.setTimeout(() => setReadyText("Go!"), 700);
    const goTimer = window.setTimeout(() => {
      setPhase("playing");
      inputRef.current?.focus();
    }, 1450);
    return () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(goTimer);
    };
  }, []);

  useEffect(() => {
    if (hp > 0 || phase !== "playing") return;
    const overTimer = window.setTimeout(() => setPhase("over"), 0);
    return () => window.clearTimeout(overTimer);
  }, [hp, phase]);

  useEffect(() => {
    if (!words.length || phase !== "playing" || hp <= 0) return;
    const spawn = window.setInterval(() => {
      const pick = words[Math.floor(Math.random() * words.length)];
      setFalling((prev) => {
        const openLanes = lanes.filter((lane, idx) => !prev.some((item) => item.lane === idx && item.y < 30));
        if (!openLanes.length) return prev;
        const laneIndex = lanes.indexOf(openLanes[Math.floor(Math.random() * openLanes.length)]);
        return [
          ...prev,
          {
            ...pick,
            gameId: makeId(),
            x: lanes[laneIndex],
            y: -12,
            lane: laneIndex,
            bornAt: Date.now(),
          },
        ];
      });
    }, settings.spawnMs);
    return () => window.clearInterval(spawn);
  }, [words, settings.spawnMs, hp, phase, lanes]);

  useEffect(() => {
    if (phase !== "playing") return;
    const tick = () => {
      setFalling((prev) => {
        const moved = prev.map((item) => (item.isHit ? item : { ...item, y: item.y + settings.speed }));
        const alive = moved.filter((item) => item.y < 92);
        const missedCount = moved.filter((item) => !item.isHit).length - alive.filter((item) => !item.isHit).length;
        if (missedCount > 0) {
          Array.from({ length: missedCount }).forEach(() => onMiss());
          setHp((old) => Math.max(0, old - missedCount));
          setSessionMisses((old) => old + missedCount);
        }
        return alive;
      });
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.06,
            life: p.life - 0.025,
          }))
          .filter((p) => p.life > 0),
      );
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [settings.speed, onMiss, phase]);

  useEffect(() => {
    if (!musicEnabled || phase !== "playing" || hp <= 0) {
      bgmAudioRef.current?.pause();
      if (bgmTimerRef.current) window.clearTimeout(bgmTimerRef.current);
      bgmTimerRef.current = null;
      return;
    }

    const playBeat = () => {
      const audioCtx = getAudioContext();
      if (!audioCtx || !musicEnabled || phase !== "playing" || hp <= 0) return;
      const now = audioCtx.currentTime;
      const step = beatStepRef.current;
      const bpm = 136 + (STARTING_HP - hp) * 10;
      const sixteenthMs = Math.round(60000 / bpm / 4);
      const melody = [392, 523.25, 659.25, 783.99, 987.77, 880, 783.99, 659.25, 440, 587.33, 739.99, 987.77, 1174.66, 987.77, 739.99, 587.33];
      const bass = [98, 98, 130.81, 98, 146.83, 146.83, 130.81, 110];
      const note = melody[step % melody.length];

      const playTone = (
        frequency: number,
        start: number,
        duration: number,
        type: OscillatorType,
        volume: number,
        destination: AudioNode = audioCtx.destination,
      ) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(destination);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.start(start);
        osc.stop(start + duration + 0.02);
      };

      const playNoise = (start: number, duration: number, volume: number, brightness = 1) => {
        const noiseLength = Math.floor(audioCtx.sampleRate * duration);
        const buffer = audioCtx.createBuffer(1, noiseLength, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < noiseLength; i += 1) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLength) * brightness;
        }
        const noise = audioCtx.createBufferSource();
        const gain = audioCtx.createGain();
        noise.buffer = buffer;
        noise.connect(gain);
        gain.connect(audioCtx.destination);
        gain.gain.value = volume;
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        noise.start(start);
        noise.stop(start + duration + 0.01);
      };

      const padFilter = audioCtx.createBiquadFilter();
      padFilter.type = "lowpass";
      padFilter.frequency.value = 1250 + (STARTING_HP - hp) * 180;
      padFilter.Q.value = 0.7;
      padFilter.connect(audioCtx.destination);

      if (step % 16 === 0) {
        [0.5, 1, 1.5].forEach((ratio) => playTone(bass[(step / 16) % bass.length] * ratio, now, 0.7, "triangle", 0.012, padFilter));
      }

      playTone(note, now, 0.075, step % 4 === 0 ? "square" : "triangle", step % 4 === 0 ? 0.026 : 0.017);
      if (step % 2 === 1) playTone(note * 1.5, now + 0.035, 0.05, "triangle", 0.012);
      if (step % 4 === 0) playTone(bass[Math.floor(step / 4) % bass.length], now, 0.2, "sawtooth", 0.055);
      if (step % 8 === 0) playTone(44, now, 0.18, "sine", 0.08);
      if (step % 8 === 4) playNoise(now, 0.08, 0.045, 0.85);
      if (step % 2 === 0) playNoise(now + 0.02, 0.035, 0.015, 0.55);

      beatStepRef.current = step + 1;
      bgmTimerRef.current = window.setTimeout(playBeat, sixteenthMs);
    };

    const bgm = bgmAudioRef.current;
    if (bgm) {
      bgm.volume = Math.min(0.58, 0.38 + (STARTING_HP - hp) * 0.035);
      bgm.playbackRate = 1;
      void bgm.play().catch(() => playBeat());
      return () => {
        bgm.pause();
        bgm.playbackRate = 1;
        if (bgmTimerRef.current) window.clearTimeout(bgmTimerRef.current);
        bgmTimerRef.current = null;
      };
    }

    playBeat();
    return () => {
      if (bgmTimerRef.current) window.clearTimeout(bgmTimerRef.current);
      bgmTimerRef.current = null;
    };
  }, [musicEnabled, hp, phase]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const onFocus = () => {
      // Keep input visible when mobile keyboard pops up.
      setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 120);
    };
    el.addEventListener("focus", onFocus);
    return () => el.removeEventListener("focus", onFocus);
  }, []);

  const resetGame = () => {
    setFalling([]);
    setParticles([]);
    setInput("");
    setHp(STARTING_HP);
    setSessionHits(0);
    setSessionMisses(0);
    setReadyText("Ready");
    setPhase("ready");
    const readyTimer = window.setTimeout(() => setReadyText("Go!"), 700);
    window.setTimeout(() => {
      setPhase("playing");
      inputRef.current?.focus();
    }, 1450);
    window.setTimeout(() => window.clearTimeout(readyTimer), 760);
  };

  const speakThen = (word: string, onDone: () => void) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      onDone();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onDone();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    window.setTimeout(finish, Math.min(900, 280 + word.length * 55));
  };

  const playExplosionSound = () => {
    if (!soundEnabled) return;
    const audioCtx = getAudioContext();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    const master = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3600;
    filter.Q.value = 0.45;
    master.gain.value = 0.52;
    filter.connect(master);
    master.connect(audioCtx.destination);

    [659.25, 880, 1174.66, 1567.98].forEach((frequency, step) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.value = frequency;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(filter);
      const start = now + step * 0.045;
      gain.gain.exponentialRampToValueAtTime(0.026, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.start(start);
      osc.stop(start + 0.18);
    });

    const noiseLength = Math.floor(audioCtx.sampleRate * 0.16);
    const buffer = audioCtx.createBuffer(1, noiseLength, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i += 1) {
      const fade = 1 - i / noiseLength;
      data[i] = (Math.random() * 2 - 1) * fade * fade * 0.28;
    }
    const noise = audioCtx.createBufferSource();
    const noiseGain = audioCtx.createGain();
    const sparkleFilter = audioCtx.createBiquadFilter();
    sparkleFilter.type = "bandpass";
    sparkleFilter.frequency.value = 2200;
    sparkleFilter.Q.value = 2.4;
    noise.buffer = buffer;
    noise.connect(sparkleFilter);
    sparkleFilter.connect(noiseGain);
    noiseGain.connect(filter);
    noiseGain.gain.value = 0.0001;
    noiseGain.gain.exponentialRampToValueAtTime(0.018, now + 0.01);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    noise.start(now);
    noise.stop(now + 0.18);
  };

  const playLockSound = () => {
    if (!soundEnabled) return;
    const audioCtx = getAudioContext();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 1046.5;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.14);
  };

  const burstAt = (x: number, y: number) => {
    const colors = ["#00e5ff", "#ffea00", "#ff3df2", "#7cff00", "#ffffff"];
    const burst = Array.from({ length: 36 }).map((_, idx) => {
      const angle = (Math.PI * 2 * idx) / 36;
      const speed = 0.85 + Math.random() * 2.4;
      return {
        id: makeId(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.4,
        life: 1,
        size: 5 + Math.random() * 10,
        color: colors[idx % colors.length],
      };
    });
    setParticles((prev) => [...prev, ...burst]);
  };

  const renderPrompt = (item: WordItem) => {
    if (settings.mode === "2-1") {
      return (
        <>
          <p className="font-semibold tracking-[0.16em] text-cyan-200">{buildHint(item.word)}</p>
          <p className="mt-1 text-[0.8em] text-slate-200">{item.definitionZh}</p>
        </>
      );
    }
    if (settings.mode === "2-2") {
      return <p className="text-[0.9em] text-cyan-100">{item.definitionZh}</p>;
    }
    if (settings.mode === "2-3") {
      return (
        <>
          <p className="font-bold text-cyan-100">{item.word}</p>
          <p className="mt-1 text-[0.8em] text-slate-200">{item.definitionZh}</p>
        </>
      );
    }
    return <p className="text-[0.8em] leading-snug text-cyan-100">{makeCloze(item.sentence, item.word)}</p>;
  };

  const onType = (value: string) => {
    setInput(value);
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;
    const matched = falling.find((item) => !item.isHit && item.word.toLowerCase() === normalized);
    if (!matched) return;
    setFalling((prev) => prev.map((item) => (item.gameId === matched.gameId ? { ...item, isHit: true } : item)));
    setInput("");
    onHit();
    setSessionHits((old) => old + 1);
    playLockSound();
    speakThen(matched.word, () => {
      setFalling((prev) => prev.filter((item) => item.gameId !== matched.gameId));
      burstAt(matched.x, matched.y + 6);
      playExplosionSound();
    });
  };

  if (!words.length) return <EmptyView title="尚無可遊玩單字" description="先在 Smart Lab 建立單字庫，再開始防衛戰。" />;

  const hitRate = sessionHits + sessionMisses === 0 ? 0 : Math.round((sessionHits / (sessionHits + sessionMisses)) * 100);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#050314] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(0,229,255,0.32),transparent_25%),radial-gradient(circle_at_82%_16%,rgba(255,61,242,0.26),transparent_25%),radial-gradient(circle_at_50%_82%,rgba(124,255,0,0.18),transparent_34%),linear-gradient(180deg,rgba(20,12,80,0.4),rgba(3,2,12,0.98))]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(0,229,255,.24)_2px,transparent_2px),linear-gradient(90deg,rgba(255,255,255,.12)_2px,transparent_2px)] [background-size:34px_34px]" />
      <div className="pointer-events-none absolute inset-x-[-20%] top-1/3 h-20 -rotate-6 bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
      <div className="pointer-events-none absolute left-8 top-24 h-10 w-10 rotate-45 border-4 border-yellow-300/70 shadow-[0_0_22px_rgba(250,204,21,0.6)]" />
      <div className="pointer-events-none absolute right-10 top-36 h-12 w-12 rotate-12 border-4 border-fuchsia-400/60 shadow-[0_0_24px_rgba(232,121,249,0.55)]" />
      <div className="absolute left-3 top-3 z-20 flex gap-2">
        <button
          type="button"
          onClick={() => setSoundEnabled((v) => !v)}
          className={`rounded-md border border-white/20 px-2 py-1 text-xs font-semibold shadow-[0_0_14px_rgba(0,229,255,0.25)] ${soundEnabled ? "bg-cyan-500 text-slate-950" : "bg-white/20 text-white"}`}
        >
          {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
        <button
          type="button"
          onClick={() => setMusicEnabled((v) => !v)}
          className={`rounded-md border border-white/20 px-2 py-1 text-xs font-semibold shadow-[0_0_14px_rgba(255,61,242,0.25)] ${musicEnabled ? "bg-fuchsia-400 text-slate-950" : "bg-white/20 text-white"}`}
        >
          {musicEnabled ? <Music2 size={14} /> : <VolumeX size={14} />}
        </button>
      </div>

      <div className="absolute right-3 top-14 z-20 flex flex-col gap-2">
        {[
          { key: "2-1" as const, label: "2-1" },
          { key: "2-2" as const, label: "2-2" },
          { key: "2-3" as const, label: "2-3" },
          { key: "3" as const, label: "M3" },
        ].map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => onChangeSettings({ ...settings, mode: m.key })}
            className={`rounded-md border border-white/20 px-2 py-1 text-xs font-black ${settings.mode === m.key ? "bg-yellow-300 text-slate-950 shadow-[0_0_14px_rgba(250,204,21,0.65)]" : "bg-white/20 text-white"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-12">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-1 text-rose-300">
            {Array.from({ length: STARTING_HP }).map((_, idx) => (
              <Heart key={idx} size={18} fill={idx < hp ? "#fb7185" : "none"} />
            ))}
          </div>
          <p className="text-xs text-slate-300">mode {settings.mode}</p>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {falling.map((item) => (
          <div
            key={item.gameId}
            className="absolute transition-transform duration-75"
            style={{
              left: `${item.x}%`,
              transform: `translate(-50%, ${item.y}vh)`,
            }}
          >
            <div
              className={`relative w-[38vw] max-w-[220px] min-w-[132px] overflow-hidden border-2 px-3 py-2 text-center shadow-[0_0_24px_rgba(34,211,238,0.35)] backdrop-blur ${
                item.isHit
                  ? "scale-105 border-yellow-200 bg-yellow-300/95 text-slate-950 shadow-[0_0_34px_rgba(250,204,21,0.75)] [&_p]:!text-slate-950"
                  : item.lane === 0
                    ? "border-cyan-300/70 bg-[#071833]/90 text-white"
                    : "border-fuchsia-300/70 bg-[#23072f]/90 text-white"
              }`}
              style={{ fontSize: `${settings.fontSize}px`, clipPath: "polygon(8% 0, 100% 0, 92% 100%, 0 100%)" }}
            >
              <span className="pointer-events-none absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rotate-45 bg-white/18" />
              <span className="pointer-events-none absolute right-2 top-2 h-2 w-2 rotate-45 bg-white/70" />
              {renderPrompt(item)}
            </div>
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-12 items-end justify-around opacity-90">
          {Array.from({ length: 13 }).map((_, idx) => (
            <span
              key={idx}
              className="h-0 w-0 border-x-[14px] border-b-[32px] border-x-transparent border-b-cyan-300/70 drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]"
            />
          ))}
        </div>
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="pointer-events-none absolute rotate-45"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}vh`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              backgroundColor: particle.color,
              opacity: particle.life,
              transform: "translate(-50%, -50%)",
              boxShadow: `0 0 10px ${particle.color}`,
            }}
          />
        ))}
      </div>

      <div className="relative z-20 border-t-2 border-cyan-300/35 bg-[#09051d]/92 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-12px_32px_rgba(0,229,255,0.12)] backdrop-blur">
        <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
          <label className="block rounded-md border border-cyan-300/25 bg-slate-950/70 p-2">
            落下速度 {settings.speed.toFixed(3)}
            <input
              type="range"
              min="0.01"
              max="0.22"
              step="0.005"
              value={settings.speed}
              onChange={(e) => onChangeSettings({ ...settings, speed: Number(e.target.value) })}
              className="mt-1 w-full accent-blue-500"
            />
          </label>
          <label className="block rounded-md border border-fuchsia-300/25 bg-slate-950/70 p-2">
            出現頻率 {settings.spawnMs}ms
            <input
              type="range"
              min="1200"
              max="8000"
              step="200"
              value={settings.spawnMs}
              onChange={(e) => onChangeSettings({ ...settings, spawnMs: Number(e.target.value) })}
              className="mt-1 w-full accent-blue-500"
            />
          </label>
          <label className="block rounded-md border border-yellow-300/25 bg-slate-950/70 p-2">
            字體 {settings.fontSize}px
            <input
              type="range"
              min="10"
              max="22"
              step="1"
              value={settings.fontSize}
              onChange={(e) => onChangeSettings({ ...settings, fontSize: Number(e.target.value) })}
              className="mt-1 w-full accent-blue-500"
            />
          </label>
        </div>
        <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
          <span>輸入正確英文即可擊落</span>
          {phase === "over" && (
            <button type="button" onClick={() => resetGame()} className="rounded-md bg-blue-600 px-2 py-1 text-white">
              重新開始
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => onType(e.target.value)}
          disabled={phase !== "playing"}
          placeholder={phase === "over" ? "Game over" : phase === "ready" ? "Ready..." : "type answer..."}
          className="w-full rounded-md border-2 border-cyan-300/60 bg-slate-950 px-4 py-3 text-base font-semibold text-white shadow-[0_0_18px_rgba(0,229,255,0.18)] outline-none focus:ring-2 focus:ring-yellow-300 disabled:opacity-50"
        />
      </div>

      {phase === "ready" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px]">
          <div className="rounded-2xl border border-blue-300/40 bg-slate-900/85 px-8 py-6 text-center">
            <p className="text-4xl font-extrabold tracking-wide text-blue-300">{readyText}</p>
          </div>
        </div>
      )}

      {phase === "over" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="w-[min(88vw,340px)] rounded-2xl border border-red-300/30 bg-slate-900/90 p-6 text-center shadow-2xl">
            <p className="text-3xl font-black text-rose-300">Game Over</p>
            <p className="mt-3 text-sm text-slate-200">Session hits: {sessionHits}</p>
            <p className="text-sm text-slate-200">Hit rate: {hitRate}%</p>
            <button
              type="button"
              onClick={() => resetGame()}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OutcomeView({
  vocabCount,
  hits,
  seconds,
  accuracy,
}: {
  vocabCount: number;
  hits: number;
  seconds: number;
  accuracy: number;
}) {
  return (
    <div className="space-y-4 px-4 py-5">
      <div className="rounded-2xl bg-blue-600 p-5 text-white">
        <p className="text-sm text-blue-100">Outcome Dashboard</p>
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <Sparkles size={20} />
          學習成果總覽
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard title="累積單字量" value={String(vocabCount)} caption="Vocabulary size" />
        <StatCard title="正確擊落次數" value={String(hits)} caption="Defense hits" />
        <StatCard title="練習總時間" value={secondsToClock(seconds)} caption="MM:SS" />
        <StatCard title="準確率" value={`${accuracy}%`} caption="Hits / (Hits + Misses)" />
      </div>
    </div>
  );
}

function StatCard({ title, value, caption }: { title: string; value: string; caption: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{caption}</p>
    </article>
  );
}

function EmptyView({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center text-slate-500">
      <BookOpenText size={34} className="mb-2 text-slate-300" />
      <p className="text-lg font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm">{description}</p>
    </div>
  );
}
