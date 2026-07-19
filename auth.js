/* =========================================================
   Portfolio共通認証モジュール (Supabase Auth)
   - Googleログイン / メール+パスワード認証(確認メール)
   - 新規登録(利用規約同意) / パスワード再設定
   - ログイン中はアプリデータをアカウントに保存・同期
   使い方: 各ページで supabase-js CDN → auth.js を読み込み、
     PortfolioAuth.init({ appKey:'xxx', storageKey:'xxx' });
   storageKey を省略するとログインUIのみ表示(同期なし)。
   ========================================================= */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://inndpuhwcdqazlhoborx.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_uXhfMDnwHB9Mm-fnWovHSw_LAVwqVFv';
  const TABLE = 'user_app_data';

  let sb = null;
  let cfg = { appKey: null, storageKey: null };
  let currentUser = null;
  let pushTimer = null;
  let syncStatus = 'idle'; // idle | syncing | synced | error

  /* ---------- helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function jpError(msg) {
    msg = String(msg || '');
    if (/Invalid login credentials/i.test(msg)) return 'メールアドレスまたはパスワードが違います';
    if (/Email not confirmed/i.test(msg)) return 'メール認証が完了していません。受信した確認メールのリンクを開いてください';
    if (/already registered/i.test(msg)) return 'このメールアドレスは登録済みです。ログインしてください';
    if (/at least 6 characters/i.test(msg)) return 'パスワードは6文字以上にしてください';
    if (/rate limit/i.test(msg)) return '試行回数が多すぎます。しばらく待ってからお試しください';
    if (/valid email/i.test(msg)) return 'メールアドレスの形式が正しくありません';
    return 'エラー: ' + msg;
  }

  /* ---------- cloud sync ---------- */
  const origSetItem = localStorage.setItem.bind(localStorage);
  const origRemoveItem = localStorage.removeItem.bind(localStorage);

  function hookStorage() {
    localStorage.setItem = function (k, v) {
      origSetItem(k, v);
      if (cfg.storageKey && k === cfg.storageKey && currentUser) schedulePush(v);
    };
    localStorage.removeItem = function (k) {
      origRemoveItem(k);
      if (cfg.storageKey && k === cfg.storageKey && currentUser) schedulePush(null);
    };
  }

  function schedulePush(raw) {
    setSyncStatus('syncing');
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushToCloud(raw), 1200);
  }

  async function pushToCloud(raw) {
    if (!currentUser || !cfg.storageKey) return;
    try {
      const { error } = await sb.from(TABLE).upsert({
        user_id: currentUser.id,
        app: cfg.appKey,
        data: raw, // text (nullはリセット扱い)
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,app' });
      if (error) throw error;
      setSyncStatus('synced');
    } catch (e) {
      console.warn('[auth] push failed', e);
      setSyncStatus('error');
    }
  }

  async function syncFromCloud() {
    if (!currentUser || !cfg.storageKey) return;
    setSyncStatus('syncing');
    try {
      const { data, error } = await sb.from(TABLE).select('data')
        .eq('user_id', currentUser.id).eq('app', cfg.appKey).maybeSingle();
      if (error) throw error;
      const localRaw = localStorage.getItem(cfg.storageKey);
      if (data && data.data != null) {
        if (data.data !== localRaw) {
          // クラウドのデータを反映してアプリを再読込(直近10秒以内の再読込はしない)
          origSetItem(cfg.storageKey, data.data);
          const last = Number(sessionStorage.getItem('pa_reload_ts') || 0);
          if (Date.now() - last > 10000) {
            sessionStorage.setItem('pa_reload_ts', String(Date.now()));
            location.reload();
            return;
          }
        }
        setSyncStatus('synced');
      } else if (localRaw != null) {
        // 初回ログイン: 端末のデータをアカウントへ移行
        await pushToCloud(localRaw);
      } else {
        setSyncStatus('synced');
      }
    } catch (e) {
      console.warn('[auth] sync failed', e);
      setSyncStatus('error');
    }
  }

  function setSyncStatus(s) {
    syncStatus = s;
    const dot = $('paSyncDot');
    const txt = $('paSyncText');
    if (!dot) return;
    const map = {
      idle: ['#bbb', ''],
      syncing: ['#e0b64f', '同期中…'],
      synced: ['#4F7F67', 'アカウントに保存済み'],
      error: ['#c0654f', '同期エラー(通信をご確認ください)']
    };
    dot.style.background = map[s][0];
    if (txt) txt.textContent = map[s][1];
  }

  /* ---------- UI ---------- */
  function injectStyles() {
    const css = `
    .pa-widget { font-family:'Noto Sans JP',-apple-system,sans-serif; z-index:3000; }
    .pa-widget.pa-fixed { position:fixed; top:14px; right:16px; }
    .pa-login-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 18px; border-radius:999px; border:1px solid rgba(79,127,103,.4); background:rgba(255,255,255,.92); color:#4F7F67; font-size:13px; font-weight:600; cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,.06); }
    .pa-login-btn:hover { background:#E5F2EA; }
    .pa-avatar { width:36px; height:36px; border-radius:50%; border:2px solid #4F7F67; background:#4F7F67; color:#fff; font-weight:700; font-size:15px; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,.1); }
    .pa-avatar img { width:100%; height:100%; object-fit:cover; }
    .pa-menu { position:absolute; right:0; top:44px; width:240px; background:#fff; border:1px solid #eee; border-radius:16px; box-shadow:0 12px 30px rgba(0,0,0,.12); padding:14px; display:none; }
    .pa-menu.open { display:block; }
    .pa-menu .pa-mail { font-size:12.5px; color:#666; word-break:break-all; margin-bottom:10px; }
    .pa-sync-row { display:flex; align-items:center; gap:6px; font-size:12px; color:#888; margin-bottom:12px; }
    #paSyncDot { width:8px; height:8px; border-radius:50%; background:#bbb; flex-shrink:0; }
    .pa-menu button { width:100%; }
    .pa-overlay { position:fixed; inset:0; background:rgba(60,70,64,.45); z-index:4000; display:none; align-items:center; justify-content:center; padding:20px; }
    .pa-overlay.open { display:flex; }
    .pa-modal { width:100%; max-width:400px; background:#F7F6F2; border-radius:22px; padding:30px 28px; box-shadow:0 20px 60px rgba(0,0,0,.25); position:relative; max-height:90vh; overflow-y:auto; }
    .pa-modal h3 { margin:0 0 4px; font-size:20px; color:#444; }
    .pa-modal .pa-sub { font-size:12.5px; color:#888; margin:0 0 18px; line-height:1.6; }
    .pa-close { position:absolute; top:14px; right:16px; background:none; border:none; font-size:20px; color:#aaa; cursor:pointer; }
    .pa-field { margin-bottom:12px; }
    .pa-field label { display:block; font-size:12px; color:#777; margin-bottom:5px; font-weight:500; }
    .pa-field input { width:100%; box-sizing:border-box; padding:11px 14px; border:1px solid #ddd; border-radius:12px; background:#fff; font-size:14px; font-family:inherit; color:#444; outline:none; }
    .pa-field input:focus { border-color:#4F7F67; }
    .pa-primary { width:100%; padding:12px; border:none; border-radius:999px; background:#4F7F67; color:#fff; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; transition:.25s; }
    .pa-primary:hover { background:#6b9a82; }
    .pa-primary:disabled { background:#b7c9bf; cursor:default; }
    .pa-google { width:100%; display:flex; align-items:center; justify-content:center; gap:10px; padding:11px; border:1px solid #ddd; border-radius:999px; background:#fff; color:#444; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; margin-bottom:16px; }
    .pa-google:hover { background:#f2f1ec; }
    .pa-divider { display:flex; align-items:center; gap:10px; color:#aaa; font-size:12px; margin:0 0 14px; }
    .pa-divider::before, .pa-divider::after { content:''; flex:1; height:1px; background:#e2e0d8; }
    .pa-links { margin-top:14px; font-size:12.5px; color:#888; text-align:center; line-height:2; }
    .pa-links a { color:#4F7F67; cursor:pointer; text-decoration:underline; }
    .pa-msg { font-size:13px; line-height:1.6; border-radius:12px; padding:10px 14px; margin-bottom:12px; display:none; }
    .pa-msg.err { display:block; background:#f7e8e4; color:#a54a35; }
    .pa-msg.ok { display:block; background:#E5F2EA; color:#3c6852; }
    .pa-terms { display:flex; gap:8px; align-items:flex-start; font-size:12.5px; color:#666; margin:2px 0 14px; line-height:1.6; }
    .pa-terms input { margin-top:3px; accent-color:#4F7F67; }
    .pa-terms a { color:#4F7F67; }
    .pa-logout { padding:9px; border:1px solid rgba(79,127,103,.4); border-radius:999px; background:transparent; color:#4F7F67; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; }
    .pa-logout:hover { background:#E5F2EA; }
    `;
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  const GOOGLE_ICON = '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 42.6 44 37 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';

  function buildWidget() {
    const mount = $('authMount');
    const wrap = document.createElement('div');
    wrap.className = 'pa-widget' + (mount ? '' : ' pa-fixed');
    wrap.style.position = mount ? 'relative' : '';
    wrap.innerHTML = `
      <button class="pa-login-btn" id="paLoginBtn" style="display:none;">ログイン</button>
      <div class="pa-avatar" id="paAvatar" style="display:none;" title="アカウント"></div>
      <div class="pa-menu" id="paMenu">
        <div class="pa-mail" id="paMail"></div>
        <div class="pa-sync-row"><span id="paSyncDot"></span><span id="paSyncText"></span></div>
        <button class="pa-logout" id="paLogoutBtn">ログアウト</button>
      </div>`;
    if (mount) mount.appendChild(wrap); else document.body.appendChild(wrap);

    $('paLoginBtn').addEventListener('click', () => openModal('login'));
    $('paAvatar').addEventListener('click', (e) => { e.stopPropagation(); $('paMenu').classList.toggle('open'); });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) $('paMenu').classList.remove('open'); });
    $('paLogoutBtn').addEventListener('click', async () => {
      await sb.auth.signOut();
      $('paMenu').classList.remove('open');
    });
  }

  function buildModal() {
    const ov = document.createElement('div');
    ov.className = 'pa-overlay';
    ov.id = 'paOverlay';
    ov.innerHTML = `<div class="pa-modal" id="paModal"></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => { if (e.target === ov) closeModal(); });
  }

  function openModal(view) {
    $('paOverlay').classList.add('open');
    renderView(view);
  }
  function closeModal() { $('paOverlay').classList.remove('open'); }

  function msg(type, text) {
    const el = $('paMsg');
    if (!el) return;
    el.className = 'pa-msg ' + type;
    el.textContent = text;
  }

  function renderView(view) {
    const m = $('paModal');
    const closeBtn = '<button class="pa-close" onclick="document.getElementById(\'paOverlay\').classList.remove(\'open\')">✕</button>';
    if (view === 'login') {
      m.innerHTML = `${closeBtn}
        <h3>ログイン</h3>
        <p class="pa-sub">ログインするとデータがアカウントに保存され、他の端末からも利用できます。</p>
        <div class="pa-msg" id="paMsg"></div>
        <button class="pa-google" id="paGoogle">${GOOGLE_ICON} Googleでログイン</button>
        <div class="pa-divider">または</div>
        <div class="pa-field"><label>メールアドレス</label><input type="email" id="paEmail" autocomplete="email"></div>
        <div class="pa-field"><label>パスワード</label><input type="password" id="paPass" autocomplete="current-password"></div>
        <button class="pa-primary" id="paSubmit">メールでログイン</button>
        <div class="pa-links">
          アカウントをお持ちでない方は <a id="paToSignup">新規登録</a><br>
          <a id="paToReset">パスワードを忘れた場合</a>
        </div>`;
      $('paGoogle').addEventListener('click', googleLogin);
      $('paSubmit').addEventListener('click', emailLogin);
      $('paToSignup').addEventListener('click', () => renderView('signup'));
      $('paToReset').addEventListener('click', () => renderView('reset'));
      $('paPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') emailLogin(); });
    } else if (view === 'signup') {
      m.innerHTML = `${closeBtn}
        <h3>新規登録</h3>
        <p class="pa-sub">登録後、確認メールが届きます。メール内のリンクを開くと登録完了です。</p>
        <div class="pa-msg" id="paMsg"></div>
        <button class="pa-google" id="paGoogle">${GOOGLE_ICON} Googleで登録</button>
        <div class="pa-divider">または</div>
        <div class="pa-field"><label>メールアドレス</label><input type="email" id="paEmail" autocomplete="email"></div>
        <div class="pa-field"><label>パスワード(6文字以上)</label><input type="password" id="paPass" autocomplete="new-password"></div>
        <label class="pa-terms"><input type="checkbox" id="paAgree"><span><a href="terms.html" target="_blank" rel="noopener">利用規約・プライバシーポリシー</a>に同意します</span></label>
        <button class="pa-primary" id="paSubmit">確認メールを送信</button>
        <div class="pa-links">すでにアカウントをお持ちの方は <a id="paToLogin">ログイン</a></div>`;
      $('paGoogle').addEventListener('click', () => {
        if (!$('paAgree').checked) { msg('err', '利用規約への同意が必要です'); return; }
        googleLogin();
      });
      $('paSubmit').addEventListener('click', emailSignup);
      $('paToLogin').addEventListener('click', () => renderView('login'));
    } else if (view === 'reset') {
      m.innerHTML = `${closeBtn}
        <h3>パスワード再設定</h3>
        <p class="pa-sub">登録済みのメールアドレスに再設定用のリンクを送ります。</p>
        <div class="pa-msg" id="paMsg"></div>
        <div class="pa-field"><label>メールアドレス</label><input type="email" id="paEmail" autocomplete="email"></div>
        <button class="pa-primary" id="paSubmit">再設定メールを送信</button>
        <div class="pa-links"><a id="paToLogin">ログインに戻る</a></div>`;
      $('paSubmit').addEventListener('click', sendReset);
      $('paToLogin').addEventListener('click', () => renderView('login'));
    } else if (view === 'recovery') {
      m.innerHTML = `${closeBtn}
        <h3>新しいパスワードの設定</h3>
        <p class="pa-sub">新しいパスワードを入力してください。</p>
        <div class="pa-msg" id="paMsg"></div>
        <div class="pa-field"><label>新しいパスワード(6文字以上)</label><input type="password" id="paPass" autocomplete="new-password"></div>
        <button class="pa-primary" id="paSubmit">変更する</button>`;
      $('paSubmit').addEventListener('click', updatePassword);
    }
  }

  /* ---------- auth actions ---------- */
  async function googleLogin() {
    try {
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.href.split('#')[0] }
      });
      if (error) throw error;
    } catch (e) { msg('err', jpError(e.message)); }
  }

  async function emailLogin() {
    const email = $('paEmail').value.trim(), pass = $('paPass').value;
    if (!email || !pass) { msg('err', 'メールアドレスとパスワードを入力してください'); return; }
    $('paSubmit').disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    $('paSubmit').disabled = false;
    if (error) { msg('err', jpError(error.message)); return; }
    closeModal();
  }

  async function emailSignup() {
    const email = $('paEmail').value.trim(), pass = $('paPass').value;
    if (!email || !pass) { msg('err', 'メールアドレスとパスワードを入力してください'); return; }
    if (pass.length < 6) { msg('err', 'パスワードは6文字以上にしてください'); return; }
    if (!$('paAgree').checked) { msg('err', '利用規約への同意が必要です'); return; }
    $('paSubmit').disabled = true;
    const { data, error } = await sb.auth.signUp({
      email, password: pass,
      options: { emailRedirectTo: location.href.split('#')[0] }
    });
    $('paSubmit').disabled = false;
    if (error) { msg('err', jpError(error.message)); return; }
    if (data.session) { closeModal(); return; } // 確認メール不要設定の場合
    msg('ok', '確認メールを送信しました。メール内のリンクを開いて登録を完了してください。(迷惑メールフォルダもご確認ください)');
  }

  async function sendReset() {
    const email = $('paEmail').value.trim();
    if (!email) { msg('err', 'メールアドレスを入力してください'); return; }
    $('paSubmit').disabled = true;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
    $('paSubmit').disabled = false;
    if (error) { msg('err', jpError(error.message)); return; }
    msg('ok', '再設定用のメールを送信しました。メール内のリンクを開き、このページで新しいパスワードを設定してください。');
  }

  async function updatePassword() {
    const pass = $('paPass').value;
    if (pass.length < 6) { msg('err', 'パスワードは6文字以上にしてください'); return; }
    $('paSubmit').disabled = true;
    const { error } = await sb.auth.updateUser({ password: pass });
    $('paSubmit').disabled = false;
    if (error) { msg('err', jpError(error.message)); return; }
    msg('ok', 'パスワードを変更しました。');
    setTimeout(closeModal, 1500);
  }

  /* ---------- state ---------- */
  function updateUI() {
    const loginBtn = $('paLoginBtn'), avatar = $('paAvatar'), mail = $('paMail');
    if (currentUser) {
      loginBtn.style.display = 'none';
      avatar.style.display = 'flex';
      const meta = currentUser.user_metadata || {};
      const name = meta.full_name || meta.name || currentUser.email || '?';
      if (meta.avatar_url) avatar.innerHTML = `<img src="${esc(meta.avatar_url)}" alt="" referrerpolicy="no-referrer">`;
      else avatar.textContent = name.charAt(0).toUpperCase();
      mail.textContent = currentUser.email || name;
    } else {
      loginBtn.style.display = 'inline-flex';
      avatar.style.display = 'none';
      $('paMenu').classList.remove('open');
      setSyncStatus('idle');
    }
  }

  /* ---------- init ---------- */
  function init(options) {
    cfg = Object.assign({ appKey: null, storageKey: null }, options || {});
    if (!cfg.appKey) cfg.appKey = location.pathname.split('/').pop() || 'index';

    if (!window.supabase || !window.supabase.createClient) {
      console.warn('[auth] supabase-js が読み込まれていません');
      return;
    }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    injectStyles();
    buildWidget();
    buildModal();
    hookStorage();

    sb.auth.onAuthStateChange((event, session) => {
      const prevId = currentUser && currentUser.id;
      currentUser = session ? session.user : null;
      updateUI();
      if (event === 'PASSWORD_RECOVERY') { openModal('recovery'); return; }
      if (currentUser && currentUser.id !== prevId) {
        closeModal();
        syncFromCloud();
      }
    });
  }

  window.PortfolioAuth = { init: init, get user() { return currentUser; } };
})();
