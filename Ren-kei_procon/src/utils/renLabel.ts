/**
 * 師匠の教え(指導者コメント)の名前の下に出す肩書きを作る。
 * 連の管理者を「連長」と呼ぶ。連の名前が分かれば「○○連の連長」、
 * 分からなければ(連が削除された・読み込み前など)従来どおり「師匠の教え」にする。
 */
export function instructorLabel(renName: string | null | undefined): string {
  const name = renName?.trim();
  return name ? `${name}の連長` : '師匠の教え';
}
