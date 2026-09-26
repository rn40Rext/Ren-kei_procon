/**
 * 見た目確認用のダミーデータ（連へのお誘い＝リクエスト機能）。
 * 連長クラスの利用者が、連に所属していない踊り手の投稿を見て「連に招く」流れ。
 * 実データ連携時は Firestore 取得・書き込みに差し替える。
 */
import type { DanceCategory } from './mockEnbu';
import { awaImage } from './awaImages';

export interface FreeDancer {
  id: string;
  name: string;
  area: string; // 活動地域
  category: DanceCategory;
  kimeRate: number; // 極め度（%）
  years: string; // 踊り歴
  enbuTitle: string; // 直近の投稿演舞
  note: string; // 本人の一言
  image: string;
  seekingRen: boolean; // 連を探している
}

export type InviteStatus = '返答待ち' | '承諾' | '辞退';

export interface Invitation {
  id: string;
  dancerName: string;
  dancerArea: string;
  message: string;
  sentAt: string; // 表示用の相対時刻
  status: InviteStatus;
}

// 連に所属していない踊り手（連長が投稿を見て招待できる相手）
export const freeDancers: FreeDancer[] = [
  {
    id: 'fd1',
    name: '橘 奏',
    area: '徳島市・国府町',
    category: '男踊り',
    kimeRate: 88,
    years: '踊り歴 4年',
    enbuTitle: '腰の沈みと足裏の押し出し',
    note: '大学で個人稽古中。本場の連で揉まれたいです。',
    image: awaImage('男踊り', 8),
    seekingRen: true,
  },
  {
    id: 'fd2',
    name: '宮武 ひなた',
    area: '鳴門市',
    category: '女踊り',
    kimeRate: 84,
    years: '踊り歴 6年',
    enbuTitle: '鳥追笠の角度と半歩の運び',
    note: '以前は学生連。社会人になって所属先を探しています。',
    image: awaImage('女踊り', 6),
    seekingRen: true,
  },
  {
    id: 'fd3',
    name: '大西 樹',
    area: '阿南市',
    category: '鳴り物',
    kimeRate: 79,
    years: '踊り歴 2年',
    enbuTitle: '締太鼓の裏拍を置く稽古',
    note: '鉦から入って締太鼓へ。鳴り物方を募集している連を探しています。',
    image: awaImage('鳴り物', 3),
    seekingRen: false,
  },
  {
    id: 'fd4',
    name: '森下 あかり',
    area: '徳島市・佐古',
    category: '女踊り',
    kimeRate: 91,
    years: '踊り歴 9年',
    enbuTitle: '指先の丸みと視線の流し方',
    note: '転勤で徳島へ。踊りは続けたいので受け入れ先を探しています。',
    image: awaImage('女踊り', 7),
    seekingRen: true,
  },
];

// すでに送ったお誘い
export const sentInvitations: Invitation[] = [
  {
    id: 'inv1',
    dancerName: '一條 蓮',
    dancerArea: '板野郡',
    message: '演舞を拝見しました。うちの連の稽古に一度いらっしゃいませんか。男踊りの層を厚くしたいと思っています。',
    sentAt: '3日前',
    status: '承諾',
  },
  {
    id: 'inv2',
    dancerName: '木下 さくら',
    dancerArea: '徳島市・八万',
    message: '女踊りの手の使い方が丁寧で目に留まりました。次の合同稽古にお誘いします。',
    sentAt: '1日前',
    status: '返答待ち',
  },
  {
    id: 'inv3',
    dancerName: '藤川 悠',
    dancerArea: '小松島市',
    message: '鳴り物方を探しています。締太鼓の間合いが良かったので声を掛けました。',
    sentAt: '5日前',
    status: '辞退',
  },
];
