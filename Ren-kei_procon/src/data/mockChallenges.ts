/**
 * 見た目確認用のダミーデータ（チャレンジ）。
 * 連の年長クラス・ベテランが「この型を踊ってみよう」とお題を出し、
 * 踊りのコツ・アドバイスを添える。タップで詳細（アドバイス一覧）へ。
 */
import type { DanceCategory } from './mockEnbu';
import { awaImage } from './awaImages';

export interface ChallengeAdvice {
  id: string;
  point: string; // 見出し（一言のコツ）
  detail: string; // 具体的な説明
}

export interface Challenge {
  id: string;
  title: string; // お題のタイトル
  move: string; // 対象の型・所作
  poster: string; // 出題者（ベテラン）
  posterRole: string; // 役職・踊り歴
  posterRen: string;
  category: DanceCategory;
  difficulty: '初級' | '中級' | '上級';
  focus: string; // どこを見てほしいか
  image: string;
  participants: number; // 挑戦した人数
  advice: ChallengeAdvice[];
}

export const challenges: Challenge[] = [
  {
    id: 'ch1',
    title: '鳥追笠の千鳥足を渡ってみよう',
    move: '女踊り・千鳥足',
    poster: '藤堂 澄香',
    posterRole: '娯茶平連 指導方・踊り歴 28年',
    posterRen: '娯茶平連',
    category: '女踊り',
    difficulty: '中級',
    focus: '爪先立ちのまま、腰の高さを変えずに半歩ずつ体を送れているか。',
    image: awaImage('女踊り', 5),
    participants: 34,
    advice: [
      {
        id: 'a1',
        point: '踵から入らない',
        detail: '爪先の外側から静かに着地し、踵は最後に添えるだけ。踵で衝撃を受けると波が途切れます。',
      },
      {
        id: 'a2',
        point: '視線は笠の縁の先へ',
        detail: '足元を見ると腰が浮きます。三歩先の床を見るつもりで顎を軽く引くと、上体が静まります。',
      },
      {
        id: 'a3',
        point: '半歩を怖がらない',
        detail: '大きく踏み出さず、体を半分ずつ送る。連の隊列でぶつからない幅がちょうど良い歩幅です。',
      },
    ],
  },
  {
    id: 'ch2',
    title: '網打ちの構えから踏み込んでみよう',
    move: '男踊り・網打ち',
    poster: '大和 晴樹',
    posterRole: '娯茶平連 連頭・踊り歴 32年',
    posterRen: '娯茶平連',
    category: '男踊り',
    difficulty: '上級',
    focus: '腰を落とすのではなく「預ける」感覚で、膝が固まっていないか。',
    image: awaImage('男踊り', 7),
    participants: 21,
    advice: [
      {
        id: 'a1',
        point: '骨盤を真下へ預ける',
        detail: '力んで落とすと膝がロックします。上から吊られた糸が緩むように、真下へ体重を任せます。',
      },
      {
        id: 'a2',
        point: '裏拍で吐き、表拍で踏む',
        detail: '二拍子の裏で息を吐ききると、表拍で自然に地を踏めます。呼吸が揃えば上体は静かになります。',
      },
      {
        id: 'a3',
        point: '指先は反らさず伸ばす',
        detail: '網を打つ手は、反らすと硬く見えます。中指の先まで“伸ばす”意識で、手のひらは軽く開く程度に。',
      },
    ],
  },
  {
    id: 'ch3',
    title: '締太鼓の裏拍を置いてみよう',
    move: '鳴り物・締太鼓',
    poster: '蔵本 鉄心',
    posterRole: '蜂須賀連 鳴り物筆頭・踊り歴 26年',
    posterRen: '蜂須賀連',
    category: '鳴り物',
    difficulty: '中級',
    focus: '表拍を強く叩きすぎず、裏拍を「置く」ように打ち分けられているか。',
    image: awaImage('鳴り物', 2),
    participants: 12,
    advice: [
      {
        id: 'a1',
        point: '手首の抜きで打ち分ける',
        detail: '腕全体で振らず、手首を返した反動だけで打つ。表は落とす、裏は置く、と力の質を変えます。',
      },
      {
        id: 'a2',
        point: '連の足音に合わせる',
        detail: '自分の拍ではなく、踊り手の踵が床に着く音に裏拍を重ねると、連全体の呼吸が合います。',
      },
    ],
  },
];

export function challengeById(id?: string): Challenge {
  return challenges.find((c) => c.id === id) ?? challenges[0];
}

export const DIFFICULTY_TONE: Record<Challenge['difficulty'], 'gold' | 'outline' | 'aka'> = {
  初級: 'outline',
  中級: 'gold',
  上級: 'aka',
};
