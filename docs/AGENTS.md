# AGENTS.md — ドキュメント

> ルートの [../AGENTS.md](../AGENTS.md) に加えて、このディレクトリ固有のルールです。

## ⚠️ `docs/spec/**` の Markdown は直接編集禁止

Word 原本 `Ren-Kei_システム仕様書_基本設計書_v0.3.docx` から生成しているため、**こちらだけ直すと原本と食い違い、どちらが正しいか分からなくなります。**

これは「内容が正しいから触るな」という意味ではありません。**仕様書 v0.3 はチームで合意した確定仕様ではなく、既存資料からの推測で組み立てた文書です**（詳しくは [spec/README.md](spec/README.md) の「この文書の位置づけ」）。内容への異議は歓迎されます。

内容を変える場合:

1. Word 原本を v0.4 として更新する（人間の作業）
2. 章ごとに再分割して `docs/spec/` を再生成する
3. `docs/design/` と `docs/status/` の影響箇所を更新する

**仕様と実装が食い違っている場合、勝手にどちらかへ寄せないでください。** [status/gap-analysis.md](status/gap-analysis.md) に差分として記録し、人間に判断を仰ぎます。仕様が間違っている可能性も、実装が間違っている可能性も両方あります。

## ディレクトリの役割

| パス | 役割 | 編集 |
| --- | --- | --- |
| `spec/` | 製品仕様書 v0.3（現時点の基準文書） | **✗ Markdown の編集は禁止** |
| `design/` | 横断的な実装設計 | ○ 決定事項の記録として |
| `specs/` | 機能単位の spec（requirements → design → tasks） | ○ フェーズの承認を得てから |
| `rules/` | 開発ルール | ○ 人間の承認を得てから |
| `status/` | 実装状況・ロードマップ | ○ 状況が変わったら更新 |
| `api/` | 旧 API メモ（現行設計は `design/api-functions.md`） | ○ |

`spec/`（単数）が製品仕様書、`specs/`（複数）が作業単位です。紛らわしいので注意してください。

## 決定事項は必ず記録する

未確定事項（TBD）を決めたら、**`design/` の該当文書に決定内容と理由を書きます**。イシューのコメントやチャットの中だけに残った決定は、次の担当者に届きません。

TBD の一覧とどのイシューで決めるかは [status/roadmap.md](status/roadmap.md) の 4 章にあります。決めたらそこの状態も更新してください。

## 書き方

- **日本語で書く。** 既存文書もすべて日本語です
- 事実と推測を区別する。推測なら「〜と考えられます」と書く
- **暫定値には「暫定」と明記する。** 例: Rule Engine の閾値はすべて暫定値で、指導者ヒアリング後に確定します
- 横断設計（`design/`）と機能 spec（`specs/`）で内容を重複させない。**リンクする**
- 相対リンクを使い、リンク先が存在することを確認する
- GitHub イシューへは `../../../issues/<番号>` 形式（`docs/xxx/yyy.md` からの相対）

## リンクの検証

ドキュメントを追加・移動したら、リポジトリルートで次を実行してください。

```bash
python3 - <<'PY'
import os, re, urllib.parse
files = ['README.md', 'AGENTS.md', 'CLAUDE.md']
for root in ('docs', '.claude'):
    for d, _, fs in os.walk(root):
        files += [os.path.join(d, f) for f in fs if f.endswith('.md')]
bad = []
for f in files:
    if not os.path.exists(f): continue
    base = os.path.dirname(f)
    for m in re.finditer(r'\[[^\]]*\]\(([^)]+)\)', open(f, encoding='utf-8').read()):
        link = m.group(1).strip()
        if link.startswith(('http://','https://','#','mailto:')) or '/issues/' in link: continue
        t = urllib.parse.unquote(link.split('#')[0])
        if t and not os.path.exists(os.path.normpath(os.path.join(base, t))):
            bad.append((f, link))
print('OK' if not bad else f'壊れたリンク: {bad}')
PY
```
