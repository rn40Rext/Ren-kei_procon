/**
 * 見た目確認用のダミーデータ（演舞・師匠の教え・門下生の声）。
 * 実データ連携時はこのファイルを Firestore 取得に差し替える。
 * 写真は Wikimedia Commons の阿波踊り実写真（src/data/awaImages.ts）。
 */
import { awaImage } from './awaImages';

export type DanceCategory = '男踊り' | '女踊り' | '鳴り物';

export interface Enbu {
  id: string;
  title: string;
  ren: string; // 所属連・道場
  performer: string;
  role: string; // 連頭 / 師範 / 門下生 など
  category: DanceCategory;
  bpm: number;
  cho: string; // 早調子 / のんびり調子
  duration: string;
  kimeRate: number; // 極め度（%）
  cheers: number;
  description: string;
  image: string;
  isShihan?: boolean;
  tokusen?: boolean;
}

export interface MasterTeaching {
  id: string;
  master: string;
  title: string;
  body: string;
}

export interface MonkaComment {
  id: string;
  name: string;
  ren: string;
  rank: string; // 段位・役職
  text: string;
  claps: number;
}

export const todaysEnbu: Enbu = {
  id: 'e-hero',
  title: '網打ちの構え・地を踏み鳴らす男踊り',
  ren: '徳島本場・娯茶平連 秘伝',
  performer: '大和 晴樹',
  role: '連頭',
  category: '男踊り',
  bpm: 114,
  cho: '早調子',
  duration: '03:42',
  kimeRate: 98,
  cheers: 3410,
  description:
    '腰を落とし、地を踏み鳴らす「網打ちの構え」。膝の柔らかな沈み込みと指先の反りが生む躍動の極意を、二拍子の間で見せる。',
  image: awaImage('男踊り', 0),
  isShihan: true,
  tokusen: true,
};

export const masterEnbu: Enbu[] = [
  {
    id: 'e-m1',
    title: '鳥追笠の千鳥足・流麗な視線誘導',
    ren: '阿波藍花連',
    performer: '藤堂 澄香',
    role: '師範',
    category: '女踊り',
    bpm: 108,
    cho: 'のんびり調子',
    duration: '02:58',
    kimeRate: 96,
    cheers: 2180,
    description: '鳥追笠の角度が生む流麗な視線誘導と、爪先立ちで渡る「千鳥足」の極意。',
    image: awaImage('女踊り', 0),
    isShihan: true,
  },
  {
    id: 'e-m2',
    title: '大太鼓の一打・連を鳴らす鼓動',
    ren: '蜂須賀連 鳴り物方',
    performer: '蔵本 鉄心',
    role: '筆頭',
    category: '鳴り物',
    bpm: 120,
    cho: '早調子',
    duration: '04:10',
    kimeRate: 94,
    cheers: 1760,
    description: '手首の抜きで打ち分ける表拍・裏拍。連全体の呼吸を支える大太鼓の間合い。',
    image: awaImage('鳴り物', 0),
    isShihan: true,
  },
];

export const monkaEnbu: Enbu[] = [
  {
    id: 'e-s1',
    title: '鳴門波足の体重移動と踵の浮き沈み',
    ren: '阿波鳴門道場',
    performer: '一條 蓮',
    role: '中堅',
    category: '男踊り',
    bpm: 110,
    cho: '早調子',
    duration: '01:44',
    kimeRate: 82,
    cheers: 52,
    description: '踵の抜き差しで波を描く足運び。上体のぶれを抑える稽古三か月目の記録。',
    image: awaImage('男踊り', 1),
  },
  {
    id: 'e-s2',
    title: '団扇の返しと肘の高さを揃える',
    ren: '眉山門下',
    performer: '木下 さくら',
    role: '新進',
    category: '女踊り',
    bpm: 106,
    cho: 'のんびり調子',
    duration: '02:03',
    kimeRate: 78,
    cheers: 41,
    description: '手先だけで返さず、肩甲骨から動かす団扇捌き。左右差の矯正に取り組む。',
    image: awaImage('女踊り', 1),
  },
];

export const filterChips = ['すべての連', '早調子', 'のんびり調子', '男踊り', '女踊り', '鳴り物', '初心者歓迎'];

/* ------------------------------------------------------------------ */
/* 交流フィード（旧コミュニティ）— ホームに統合                          */
/* ------------------------------------------------------------------ */
export interface FeedPost {
  id: string;
  title: string;
  author: string;
  authorRen: string; // 所属連 or 未所属
  category: DanceCategory;
  tags: string[];
  kimeRate: number; // 極め度（%）
  claps: number; // 拍手
  comments: number; // 門下生の声
  timeAgo: string;
  image: string;
  duration?: string; // 演舞尺
  description?: string; // 一言メモ
  mine?: boolean; // 自分の投稿
}

/** ログイン中ユーザーの表示名（ダミー） */
export const ME = { name: 'あなた', ren: '傘連・阿波徳島' } as const;

export const feedTags = ['すべて', '#男踊り', '#女踊り', '#鳴り物', '#初心者歓迎', '#足の運び', '#腰落とし', '#二拍子'];

// 自分が投稿した演舞（ダミー）
export const myPosts: FeedPost[] = [
  {
    id: 'me1',
    title: '網打ちの構え、腰の沈み込みを撮ってみた',
    author: ME.name,
    authorRen: ME.ren,
    category: '男踊り',
    tags: ['#男踊り', '#腰落とし'],
    kimeRate: 81,
    claps: 12,
    comments: 3,
    timeAgo: '2日前',
    duration: '01:58',
    description: '腰を「預ける」感覚がまだ掴めていない。膝が固まっている気がする。',
    image: awaImage('男踊り', 2),
    mine: true,
  },
  {
    id: 'me2',
    title: '二拍子の裏で脱力する練習',
    author: ME.name,
    authorRen: ME.ren,
    category: '男踊り',
    tags: ['#男踊り', '#二拍子', '#足の運び'],
    kimeRate: 76,
    claps: 6,
    comments: 1,
    timeAgo: '1週間前',
    duration: '01:12',
    description: '裏拍で息を吐ききると表拍が踏みやすい、と先輩に言われた回。',
    image: awaImage('男踊り', 3),
    mine: true,
  },
];

export const feedPosts: FeedPost[] = [
  {
    id: 'f1',
    title: '網打ちの構えから半歩の踏み込みまで',
    author: '大和 晴樹',
    authorRen: '娯茶平連',
    category: '男踊り',
    tags: ['#男踊り', '#腰落とし', '#二拍子'],
    kimeRate: 96,
    claps: 312,
    comments: 24,
    timeAgo: '2時間前',
    image: awaImage('男踊り', 4),
  },
  {
    id: 'f2',
    title: '鳥追笠を上げる瞬間の視線の流し方',
    author: '藤堂 澄香',
    authorRen: '阿波藍花連',
    category: '女踊り',
    tags: ['#女踊り'],
    kimeRate: 94,
    claps: 268,
    comments: 19,
    timeAgo: '5時間前',
    image: awaImage('女踊り', 2),
  },
  {
    id: 'f3',
    title: '締太鼓、表拍と裏拍の打ち分け稽古',
    author: '蔵本 鉄心',
    authorRen: '蜂須賀連 鳴り物方',
    category: '鳴り物',
    tags: ['#鳴り物', '#二拍子'],
    kimeRate: 90,
    claps: 141,
    comments: 8,
    timeAgo: '昨日',
    image: awaImage('鳴り物', 1),
  },
  {
    id: 'f4',
    title: '鳴門波足、踵の浮き沈みだけを撮ってみた',
    author: '一條 蓮',
    authorRen: '阿波鳴門道場',
    category: '男踊り',
    tags: ['#男踊り', '#足の運び', '#初心者歓迎'],
    kimeRate: 82,
    claps: 57,
    comments: 12,
    timeAgo: '昨日',
    image: awaImage('男踊り', 5),
  },
  {
    id: 'f5',
    title: '団扇の返しと肘の高さ、左右差の矯正',
    author: '木下 さくら',
    authorRen: '眉山門下',
    category: '女踊り',
    tags: ['#女踊り', '#初心者歓迎'],
    kimeRate: 78,
    claps: 44,
    comments: 6,
    timeAgo: '2日前',
    image: awaImage('女踊り', 3),
  },
  {
    id: 'f6',
    title: '腰を「預ける」感覚、まだ掴めていない',
    author: '橘 奏',
    authorRen: '未所属',
    category: '男踊り',
    tags: ['#男踊り', '#腰落とし'],
    kimeRate: 74,
    claps: 33,
    comments: 15,
    timeAgo: '3日前',
    image: awaImage('男踊り', 6),
  },
];

export const masterTeachings: MasterTeaching[] = [
  {
    id: 't1',
    master: '娯茶平連 連頭・大和 晴樹',
    title: '腰は「落とす」のではなく「預ける」',
    body:
      '力んで腰を落とすと膝が固まる。骨盤を真下へ預け、踵の内側で床を感じるだけでよい。二拍子の裏で息を吐き、表で地を踏む。この呼吸が揃えば、上体は自ずと静かになる。',
  },
  {
    id: 't2',
    master: '阿波藍花連 師範・藤堂 澄香',
    title: '指先は反らさず、和紙一枚を挟む心持ち',
    body:
      '女踊りの手は、反らすと硬く見える。中指と薬指の間に和紙を一枚挟む心持ちで、わずかに丸みを残す。笠の縁と指先が一本の線でつながると、視線が自然に流れる。',
  },
];

export const monkaComments: MonkaComment[] = [
  {
    id: 'c1',
    name: '一條 蓮',
    ren: '阿波鳴門道場',
    rank: '中堅・三段',
    text: '踵の沈み込みの深さに見入りました。裏拍での脱力、次の稽古で真似させていただきます。',
    claps: 24,
  },
  {
    id: 'c2',
    name: '木下 さくら',
    ren: '眉山門下',
    rank: '新進',
    text: '指先の反りが美しいです。団扇を持つ手も同じ心持ちで揃えるとよいのでしょうか。',
    claps: 11,
  },
  {
    id: 'c3',
    name: '蔵本 鉄心',
    ren: '蜂須賀連 鳴り物方',
    rank: '筆頭',
    text: '早調子でもここまで間が取れるのは見事。鳴り物としても合わせ甲斐がある演舞です。',
    claps: 38,
  },
];
