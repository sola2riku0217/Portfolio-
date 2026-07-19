# 認証機能 Supabase設定メモ(初回のみ)

コード側は全アプリ実装済み。以下をSupabaseコンソールで設定すると動作します。
プロジェクト: https://supabase.com/dashboard → いいね・コメントで使用中のプロジェクト(inndpuhwcdqazlhoborx)

## 1. データ保存テーブルの作成

SQL Editor で以下を実行:

```sql
create table if not exists public.user_app_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  app text not null,
  data text,
  updated_at timestamptz not null default now(),
  primary key (user_id, app)
);

alter table public.user_app_data enable row level security;

create policy "select own" on public.user_app_data
  for select using (auth.uid() = user_id);
create policy "insert own" on public.user_app_data
  for insert with check (auth.uid() = user_id);
create policy "update own" on public.user_app_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own" on public.user_app_data
  for delete using (auth.uid() = user_id);
```

RLS(行レベルセキュリティ)により、各ユーザーは自分のデータしか読み書きできません。

## 2. URL設定

Authentication → URL Configuration:

- Site URL: `https://sola2riku0217.github.io/Portfolio-/`
- Redirect URLs に追加: `https://sola2riku0217.github.io/Portfolio-/*`

(ローカルで試す場合は `http://localhost:*` も追加)

## 3. Googleログインの有効化

1. https://console.cloud.google.com/ → プロジェクト作成(既存でも可)
2. APIとサービス → OAuth同意画面 → External で作成(アプリ名・メールを入力)
3. APIとサービス → 認証情報 → 認証情報を作成 → OAuthクライアントID → 「ウェブアプリケーション」
   - 承認済みのリダイレクトURI: `https://inndpuhwcdqazlhoborx.supabase.co/auth/v1/callback`
4. 発行された「クライアントID」「クライアントシークレット」をコピー
5. Supabase → Authentication → Sign In / Providers → Google を有効化し、上記2つを貼り付けて Save

## 4. メール認証(確認メール)

Authentication → Sign In / Providers → Email:

- 「Confirm email」がON(デフォルト)であることを確認 → 新規登録時に確認メールが送られる
- メール文面は Authentication → Emails(Templates) で日本語化可能(任意)

※Supabase標準のメール送信は 1時間あたり数通の制限あり。本格運用時はSMTP(Resend等)の設定を推奨。

## 5. 公開

```bash
cd /Users/ueda/Desktop/Cloude/portfolio
rm -f .git/index.lock .git/HEAD.lock .git/objects/*/tmp_obj_*
git add .
git commit -m "全アプリにGoogle/メール認証とアカウント同期を追加"
git push
```

## 動作の仕組み(メモ)

- 全ページ共通の `auth.js` がログインボタン/アカウントメニュー/認証モーダルを表示
- 未ログイン: 従来どおり端末(localStorage)に保存
- ログイン中: 保存のたびに `user_app_data` にアップロード(1.2秒デバウンス)。ページを開くとクラウドのデータを取得し、端末と異なれば反映して再読込
- 初ログイン時: 端末にあるデータをアカウントへ自動移行
- 新規登録には利用規約(terms.html)への同意が必須
- パスワード再設定: ログイン画面の「パスワードを忘れた場合」→ メールのリンク → 開いたページで新パスワード入力

## 対象アプリと保存キー

| アプリ | appKey | localStorageキー |
|---|---|---|
| ライフプランシミュレーター | lifeplan_sim | lifePlanSimDataV3 |
| 家事分担トラッカー | housework_tracker | houseworkTrackerData_v1 |
| 家計管理アプリ | budget_tracker | budgetTrackerData_v1 |
| 出産手続きナビ | birth_checklist | birthChecklist_v1 |
| トップページ | index | (同期なし・ログインUIのみ) |
