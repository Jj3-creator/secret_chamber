/**
 * thai.ts — a custom 2048-word Thai wordlist for BIP-39-style mnemonics.
 * ==========================================================================
 *
 * IMPORTANT: BIP-39 has no official Thai wordlist (only English, Japanese,
 * Korean, Spanish, Chinese Simplified/Traditional, French, Italian, Czech,
 * Portuguese). This list is NOT one of those official lists — it's built
 * for this app only, so it does NOT need external interoperability with
 * other BIP-39 tools/wallets (this app never claims that compatibility;
 * the 12-word phrase is only ever consumed by this app's own crypto.ts).
 *
 * The BIP-39 algorithm doesn't care what the words *are* — it only needs
 * an array of exactly 2048 distinct strings; each 11-bit chunk of
 * entropy+checksum indexes into this array. So instead of hand-picking
 * 2048 individual Thai words (hard to do well, easy to accidentally
 * duplicate or pick confusing/rare vocabulary), this list is the
 * cross-product of two small, easy-to-review lists:
 *
 *   64 common concrete nouns  ×  32 common adjectives  =  2048
 *
 * e.g. "แมว" (cat) + "แดง" (red) -> "แมวแดง" ("red cat"), matching normal
 * Thai noun-then-adjective word order. Reviewing 96 words for quality,
 * duplicates, and ambiguity is far more tractable than reviewing 2048 —
 * and the cross-product construction makes duplicate compound entries
 * mathematically impossible as long as each source list has no duplicates
 * within itself (checked below, and by the test suite).
 *
 * This has NOT had a linguistic review by a native-speaker outside this
 * session — treat it as a reasonable first pass, not a final, audited
 * wordlist, before relying on it for real users' passphrases.
 */

// 64 common, concrete nouns — animals, nature, everyday objects, food.
// Deliberately simple/short words, avoiding rare vocabulary or words that
// look/sound very similar to each other.
const NOUNS: string[] = [
  // animals (16)
  'แมว', 'หมา', 'นก', 'ปลา', 'ม้า', 'วัว', 'หมู', 'ไก่',
  'เป็ด', 'กบ', 'ผึ้ง', 'ผีเสื้อ', 'เสือ', 'ช้าง', 'ลิง', 'กระต่าย',
  // nature (16)
  'ภูเขา', 'แม่น้ำ', 'ทะเล', 'ป่า', 'ดาว', 'พระจันทร์', 'พระอาทิตย์', 'เมฆ',
  'ฝน', 'ลม', 'หิน', 'ทราย', 'ต้นไม้', 'ดอกไม้', 'ใบไม้', 'น้ำแข็ง',
  // everyday objects (16)
  'โต๊ะ', 'เก้าอี้', 'ประตู', 'หน้าต่าง', 'กระเป๋า', 'รองเท้า', 'หมวก', 'แว่นตา',
  'นาฬิกา', 'กระจก', 'ร่ม', 'เทียน', 'กุญแจ', 'กล่อง', 'ถ้วย', 'จาน',
  // food (16)
  'ข้าว', 'ขนม', 'น้ำผึ้ง', 'เกลือ', 'มะม่วง', 'กล้วย', 'ส้ม', 'แตงโม',
  'มะพร้าว', 'พริก', 'หอม', 'กระเทียม', 'ไข่', 'นม', 'ชา', 'กาแฟ',
];

// 32 common adjectives — colors + basic descriptive qualities. No overlap
// with NOUNS (double-checked; also verified programmatically by the tests).
const ADJECTIVES: string[] = [
  // colors (8)
  'แดง', 'เขียว', 'เหลือง', 'ฟ้า', 'ดำ', 'ขาว', 'ม่วง', 'น้ำตาล',
  // qualities (24)
  'ใหญ่', 'เล็ก', 'สูง', 'ต่ำ', 'ยาว', 'สั้น', 'หนัก', 'เบา',
  'ร้อน', 'เย็น', 'หวาน', 'เปรี้ยว', 'เผ็ด', 'เค็ม', 'นุ่ม', 'แข็ง',
  'สะอาด', 'สกปรก', 'สว่าง', 'มืด', 'เร็ว', 'ช้า', 'ใหม่', 'เก่า',
];

if (NOUNS.length !== 64) throw new Error(`thai wordlist: expected 64 nouns, got ${NOUNS.length}`);
if (ADJECTIVES.length !== 32) throw new Error(`thai wordlist: expected 32 adjectives, got ${ADJECTIVES.length}`);

/** 64 x 32 = 2048 unique compound words, e.g. "แมวแดง" (noun + adjective). */
export const THAI_WORDLIST: string[] = NOUNS.flatMap((noun) => ADJECTIVES.map((adj) => noun + adj));

if (THAI_WORDLIST.length !== 2048) {
  throw new Error(`thai wordlist: expected 2048 entries, got ${THAI_WORDLIST.length}`);
}
if (new Set(THAI_WORDLIST).size !== 2048) {
  throw new Error('thai wordlist: contains duplicate entries');
}

export const __internal = { NOUNS, ADJECTIVES };
