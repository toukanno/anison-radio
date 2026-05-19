// Curated anison catalogue (metadata only — no copyrighted audio bundled).
// Each track has a deterministic id so likes / playlists survive reloads.
// `audioUrl` is optional: when present HTMLAudioElement plays it, otherwise a
// WebAudio tone is synthesised so the player still feels alive.

export const tracks = [
  { id: "t001", title: "紅蓮華", artist: "LiSA", anime: "鬼滅の刃", duration: 235, year: 2019, tags: ["op", "rock"] },
  { id: "t002", title: "炎",     artist: "LiSA", anime: "劇場版 鬼滅の刃 無限列車編", duration: 277, year: 2020, tags: ["ballad", "ed"] },
  { id: "t003", title: "again",  artist: "YUI",  anime: "鋼の錬金術師 FULLMETAL ALCHEMIST", duration: 232, year: 2009, tags: ["op", "rock"] },
  { id: "t004", title: "シルエット", artist: "KANA-BOON", anime: "NARUTO -ナルト- 疾風伝", duration: 230, year: 2014, tags: ["op", "rock"] },
  { id: "t005", title: "only my railgun", artist: "fripSide", anime: "とある科学の超電磁砲", duration: 250, year: 2009, tags: ["op", "trance"] },
  { id: "t006", title: "残酷な天使のテーゼ", artist: "高橋洋子", anime: "新世紀エヴァンゲリオン", duration: 245, year: 1995, tags: ["op", "classic"] },
  { id: "t007", title: "God knows...", artist: "平野綾", anime: "涼宮ハルヒの憂鬱", duration: 320, year: 2006, tags: ["insert", "rock"] },
  { id: "t008", title: "secret base 〜君がくれたもの〜", artist: "ZONE", anime: "あの日見た花の名前を僕達はまだ知らない。", duration: 295, year: 2011, tags: ["ed", "ballad"] },
  { id: "t009", title: "Pretender", artist: "Official髭男dism", anime: "コンフィデンスマンJP", duration: 325, year: 2019, tags: ["jpop"] },
  { id: "t010", title: "前前前世", artist: "RADWIMPS", anime: "君の名は。", duration: 295, year: 2016, tags: ["movie", "rock"] },
  { id: "t011", title: "Cha-La Head-Cha-La", artist: "影山ヒロノブ", anime: "ドラゴンボールZ", duration: 217, year: 1989, tags: ["op", "classic"] },
  { id: "t012", title: "残響散歌", artist: "Aimer", anime: "鬼滅の刃 遊郭編", duration: 188, year: 2021, tags: ["op", "rock"] },
  { id: "t013", title: "おどるポンポコリン", artist: "B.B.クィーンズ", anime: "ちびまる子ちゃん", duration: 240, year: 1990, tags: ["op", "kids"] },
  { id: "t014", title: "勇気100%", artist: "光GENJI", anime: "忍たま乱太郎", duration: 220, year: 1993, tags: ["op", "classic"] },
  { id: "t015", title: "ようこそジャパリパークへ", artist: "どうぶつビスケッツ×PPP", anime: "けものフレンズ", duration: 230, year: 2017, tags: ["op"] },
  { id: "t016", title: "宿命", artist: "Official髭男dism", anime: "MIX", duration: 252, year: 2019, tags: ["op", "jpop"] },
  { id: "t017", title: "アイドル", artist: "YOASOBI", anime: "推しの子", duration: 199, year: 2023, tags: ["op", "jpop"] },
  { id: "t018", title: "夜に駆ける", artist: "YOASOBI", anime: "—", duration: 261, year: 2019, tags: ["jpop"] },
  { id: "t019", title: "ブルーバード", artist: "いきものがかり", anime: "NARUTO -ナルト- 疾風伝", duration: 222, year: 2008, tags: ["op", "rock"] },
  { id: "t020", title: "ハルジオン", artist: "YOASOBI", anime: "—", duration: 215, year: 2020, tags: ["jpop"] },
  { id: "t021", title: "君の知らない物語", artist: "supercell", anime: "化物語", duration: 252, year: 2009, tags: ["ed", "rock"] },
  { id: "t022", title: "鳥の詩", artist: "Lia", anime: "AIR", duration: 305, year: 2005, tags: ["op", "ballad"] },
  { id: "t023", title: "ハレ晴レユカイ", artist: "平野綾・茅原実里・後藤邑子", anime: "涼宮ハルヒの憂鬱", duration: 230, year: 2006, tags: ["ed"] },
  { id: "t024", title: "Crossing Field", artist: "LiSA", anime: "ソードアート・オンライン", duration: 245, year: 2012, tags: ["op", "rock"] },
  { id: "t025", title: "TRUE LOVE", artist: "藤井フミヤ", anime: "あすなろ白書", duration: 282, year: 1993, tags: ["ballad"] },
  { id: "t026", title: "ガーネット", artist: "奥華子", anime: "時をかける少女", duration: 285, year: 2006, tags: ["ed", "ballad"] },
  { id: "t027", title: "ライオン", artist: "May'n/中島愛", anime: "マクロスF", duration: 244, year: 2008, tags: ["op", "jpop"] },
  { id: "t028", title: "Hacking to the Gate", artist: "いとうかなこ", anime: "STEINS;GATE", duration: 246, year: 2011, tags: ["op", "rock"] },
  { id: "t029", title: "Don't say \"lazy\"", artist: "桜高軽音部", anime: "けいおん!", duration: 246, year: 2009, tags: ["ed", "rock"] },
  { id: "t030", title: "Sorairo Days", artist: "中川翔子", anime: "天元突破グレンラガン", duration: 270, year: 2007, tags: ["op", "rock"] },
];
