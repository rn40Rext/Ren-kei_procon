/**
 * ダミーデータ用の阿波踊り写真。
 * すべて Wikimedia Commons の実写真（生成画像ではない）。
 * ライセンス表記が必要な場合は各ファイルページを参照：
 *   https://commons.wikimedia.org/wiki/File:<ファイル名>
 */

const HOST = 'https://upload.wikimedia.org/wikipedia/commons/thumb';
const W = 1280;

/** ハッシュ2階層とファイル名（%エンコード済み）から Commons のサムネ URL を組み立てる */
const wm = (dir: string, file: string) => `${HOST}/${dir}/${file}/${W}px-${file}`;

/** 男踊り（法被・奴凧・力強い所作） */
export const otokoOdori: string[] = [
  wm('f/f1', 'Awa_dance_team_Tensui-Ren_Yakkodako_dance._Aug._13%2C_2016._Tokushima_City.A.jpg'),
  wm('0/0c', 'Awa_dance_team_Tensui-Ren_Yakkodako_dance._Aug._13%2C_2016._Tokushima_City.B.jpg'),
  wm('9/94', 'Awa-odori_2008_Tokushima.jpg'),
  wm('e/e0', 'Awaodori.jpg'),
];

/** 女踊り（編笠・浴衣・下駄） */
export const onnaOdori: string[] = [
  wm('6/6c', 'Awa_Odori_performed_by_women_wearing_light_green_Kimono_2015-08-12.jpg'),
  wm('3/39', 'Danseuses_Awa_Odori_2007.jpg'),
  wm('8/8b', 'Awaodori-4-Modifier.jpg'),
  wm('7/7c', '2009-09-22_Hatsudai_Awa-Odori.jpg'),
];

/** 鳴り物・総踊り・群舞 */
export const narimono: string[] = [
  wm('7/79', 'Awa_Odori_Tokushima_City_so-odori_02.jpg'),
  wm('6/6a', 'Awa_Odori_Tokushima_City_so-odori.jpg'),
  wm('b/bf', 'Awa_dance_team_Muso-Ren._Aug._13%2C_2016._Tokushima_City.jpg'),
  wm('3/3c', 'Awa_dance_team_Suikyo-Ren._Aug._13%2C_2016._Tokushima_City.jpg'),
];

/** 汎用（道踊り・祭りの全景） */
export const awaGeneral: string[] = [
  wm('7/75', 'Awa_Odori_Dance.jpg'),
  wm('b/bb', 'Awa_Dance_at_Hirokoji_Summer_Festival_2017_-_1.jpg'),
  wm('6/60', 'Awa_Dance_at_Hirokoji_Summer_Festival_2017_-_2.jpg'),
  wm('7/7f', 'AWAODORI_danses_de_rue.jpg'),
  wm('4/4f', 'Awa_Odori-1.jpg'),
  wm('5/51', 'Awa_Odori_2007.JPG'),
  wm('d/df', 'Awa-odori_in_Naruto_City.jpg'),
  wm('3/33', 'Awa_Odori_Matsuri07.jpg'),
  wm('7/7f', 'Awa_odori_25_001.jpg'),
];

type Cat = '男踊り' | '女踊り' | '鳴り物';

/** 型と連番から阿波踊り写真を1枚返す（重複しにくいよう連番で分散） */
export function awaImage(category: Cat, i = 0): string {
  const base =
    category === '男踊り' ? otokoOdori : category === '女踊り' ? onnaOdori : narimono;
  const pool = [...base, ...awaGeneral];
  return pool[i % pool.length];
}

/** 汎用写真を1枚 */
export function generalImage(i = 0): string {
  return awaGeneral[i % awaGeneral.length];
}
