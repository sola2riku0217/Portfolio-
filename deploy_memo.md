# GitHub公開手順メモ

リポジトリ: https://github.com/sola2riku0217/Portfolio-(mainブランチ)

## 公開コマンド(いつもの手順)

```bash
cd /Users/ueda/Desktop/Cloude/portfolio
rm -f .git/index.lock .git/HEAD.lock .git/objects/*/tmp_obj_*
git add index.html birth_checklist.html
git commit -m "出産手続きナビを追加"
git push
```

- 2行目はロックファイル削除(git操作が固まる対策)。なくても動く場合はスキップ可
- `git add` は変更したファイル名に合わせて変更(全部あげるなら `git add .`)
- `-m` のコミットメッセージは変更内容に合わせて書き換える

## 公開URL

```
https://sola2riku0217.github.io/Portfolio-/
https://sola2riku0217.github.io/Portfolio-/birth_checklist.html
```

push後、反映まで数分かかることがある。

## 確認コマンド

```bash
git status          # 変更ファイルの確認
git log --oneline   # コミット履歴の確認
```
