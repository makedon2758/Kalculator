// license.js — activation / validation / updates (Electron, main-process)
'use strict';

const { app, dialog, BrowserWindow } = require('electron');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { spawn } = require('child_process');
const { pipeline, Readable } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);
const { getHWID } = require('./hwid');

// === Your Apps Script URL (Web App, /exec) ===
const BASE = 'https://script.google.com/macros/s/AKfycbxFBPUq-mwvuwpMrbRUS-qGh-2y6HUUHb0hF1qgP0uR9S3aWStE4vOFwpHkTJD5P2nOig/exec';

// Local license store
const STORE = path.join(app.getPath('userData'), 'license.json');
const GRACE_DAYS = 7;



function asBool(v){
  // нормализация mandatory из таблицы: 1/'1'/true -> true
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number')  return v !== 0;
  if (typeof v === 'string')  return v.trim() !== '' && v.trim() !== '0' && v.trim().toLowerCase() !== 'false';
  return false;
}
// fetch helper (Node 18+ имеет глобальный fetch)
const gfetch = (...args) =>
  (typeof fetch === 'function' ? fetch(...args) : import('node-fetch').then(m => m.default(...args)));

// function loadStore(){ try { return JSON.parse(fs.readFileSync(STORE,'utf8')); } catch { return {}; } }
// function saveStore(o){ fs.mkdirSync(path.dirname(STORE), { recursive:true }); fs.writeFileSync(STORE, JSON.stringify(o),'utf8'); }
function loadStore(){ try { return JSON.parse(fs.readFileSync(STORE,'utf8')); } catch { return {}; } }
function saveStore(o){ fs.mkdirSync(path.dirname(STORE), { recursive:true }); fs.writeFileSync(STORE, JSON.stringify(o),'utf8'); }


async function getJSON(url, timeoutMs = 6000){
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await gfetch(url, { signal: controller.signal });
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

async function getPublicIP(){
  try { const j = await getJSON('https://api.ipify.org?format=json', 4000); return j.ip || ''; }
  catch { return ''; }
}

async function downloadWithProgress(url, outPath, onProgress){
  const res = await gfetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers?.get?.('content-length') || 0);
  let loaded = 0;

  const body = res.body;
  const nodeStream = (body && typeof body.on === 'function') ? body : (Readable.fromWeb ? Readable.fromWeb(body) : body);

  if (total && nodeStream.on) {
    nodeStream.on('data', chunk => {
      loaded += chunk.length || 0;
      if (typeof onProgress === 'function') onProgress(loaded, total);
    });
  }
  await streamPipeline(nodeStream, fs.createWriteStream(outPath));
  if (typeof onProgress === 'function') onProgress(total || 1, total || 1);
  return outPath;
}

function cmpVer(a,b){
  const pa=String(a).split('.').map(Number), pb=String(b).split('.').map(Number);
  for (let i=0;i<Math.max(pa.length,pb.length);i++){
    const x=pa[i]||0, y=pb[i]||0;
    if (x!==y) return x>y?1:-1;
  }
  return 0;
}

// === Update HUD (minimizable, not always-on-top) ===
function createUpdateHUD() {
  const win = new BrowserWindow({
    width: 580, height: 200, resizable: false,
    minimizable: true, maximizable: false, movable: true,
    frame: true, alwaysOnTop: false, skipTaskbar: false,
    backgroundColor: '#111827', title: 'Updating…',
    webPreferences: { contextIsolation: true, devTools: false }
  });

  const html = (title, body) => `
    <html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box} body{margin:0;font-family:Segoe UI,Roboto,Arial,sans-serif;background:#111827;color:#e5e7eb}
      .box{padding:16px} h1{font-size:16px;margin:0 0 8px;color:#fff} p{margin:6px 0 0;color:#cbd5e1}
      .bar{height:6px;background:#374151;border-radius:4px;overflow:hidden;margin-top:10px;outline:1px solid #0f172a}
      .fill{height:100%;width:0%;background:#60a5fa;transition:width .15s ease}
      .row{display:flex;justify-content:space-between;align-items:center}.hint{font-size:12px;color:#9ca3af}
    </style></head>
    <body>
      <div class="box">
        <div class="row">
          <h1 id="title">${title}</h1>
          <span class="hint">You can close this window — update continues in background</span>
        </div>
        <div class="bar"><div class="fill" id="f"></div></div>
        <p id="msg">${body}</p>
      </div>
      <script>
        const fill = document.getElementById('f'), msg = document.getElementById('msg'), ttl = document.getElementById('title');
        window.__setProgress = p => { fill.style.width = Math.max(0, Math.min(100, p)) + '%'; };
        window.__setText = t => { msg.textContent = t; };
        window.__setTitle = t => { ttl.textContent = t; };
      </script>
    </body></html>`;
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html('Updating…','Preparing…')));
  win.setMenuBarVisibility(false);
  win.center();

  return {
    win,
    setProgress(p){ try { win.webContents.executeJavaScript(`__setProgress(${p});`); win.setProgressBar(p/100); } catch(_){} },
    setText(t){ try { win.webContents.executeJavaScript(`__setText(${JSON.stringify(t)});`);} catch(_){} },
    setTitle(t){ try { win.webContents.executeJavaScript(`__setTitle(${JSON.stringify(t)});`);} catch(_){} },
    close(){ try { win.close(); } catch(_){} }
  };
}

// --- Activation / validation ---
async function activateOrValidate({ key = '', org = 'DefaultOrg' } = {}) {
  const hwid = getHWID();
  const st = loadStore();
  const k = key && key.trim() ? key.trim() : `TRIAL-${hwid}`;

  // гарантируем поле trialAnchorAt в сторе
  if (!st.trialAnchorAt) st.trialAnchorAt = null;

  // helper: добавляем &anchor=...
  const withAnchor = (url) => {
    const a = st.trialAnchorAt ? encodeURIComponent(st.trialAnchorAt) : '';
    return a ? `${url}&anchor=${a}` : url;
  };

  if (!st.key || st.key !== k) {
    const ip = await getPublicIP();
    let u = `${BASE}?cmd=activate&key=${encodeURIComponent(k)}&hwid=${encodeURIComponent(hwid)}&org=${encodeURIComponent(org)}&machine=${encodeURIComponent(os.hostname())}&user=${encodeURIComponent(os.userInfo().username)}&ip=${encodeURIComponent(ip)}`;
    u = withAnchor(u);
    const r = await getJSON(u);
    if (!r.ok) return { ok:false, reason: r.reason || 'activation_failed' };

    // если это trial и якоря нет — фиксируем «первую дату» локально
    if (r.trialEndsAt && !st.trialAnchorAt) {
      st.trialAnchorAt = new Date().toISOString();
    }
    saveStore({ key: k, hwid, lastOkAt: new Date().toISOString(), trialEndsAt: r.trialEndsAt || null, trialAnchorAt: st.trialAnchorAt });
    return { ok:true, mode: r.trialEndsAt ? 'trial' : 'full', trialEndsAt: r.trialEndsAt || null };
  }

  try {
    let u = `${BASE}?cmd=validate&key=${encodeURIComponent(st.key)}&hwid=${encodeURIComponent(hwid)}`;
    u = withAnchor(u);
    const r = await getJSON(u, 4000);

    if (!r.ok) {
      if (r.reason === 'no_key' && String(st.key).startsWith('TRIAL-')) {
        // таблицу очистили: сбросим ключ локально и переактивируем (re-seed)
        saveStore({});
        return await activateOrValidate({ key: '', org });
      }
      return { ok:false, reason: r.reason || 'denied' };
    }

    // если это trial и якоря ещё не было — зафиксируем локально
    if (r.trialEndsAt && !st.trialAnchorAt) {
      st.trialAnchorAt = new Date().toISOString();
    }

    st.lastOkAt = new Date().toISOString();
    if (r.trialEndsAt) st.trialEndsAt = r.trialEndsAt;
    saveStore(st);
    gfetch(`${BASE}?cmd=heartbeat&key=${encodeURIComponent(st.key)}&hwid=${encodeURIComponent(hwid)}`).catch(()=>{});
    return { ok:true, mode: r.trialEndsAt ? 'trial' : 'full', trialEndsAt: r.trialEndsAt || null };

  } catch {
    const last = st.lastOkAt ? new Date(st.lastOkAt).getTime() : 0;
    if (last && (Date.now() - last) < GRACE_DAYS*24*3600*1000) {
      return { ok:true, mode: st.trialEndsAt ? 'trial' : 'full', trialEndsAt: st.trialEndsAt || null, offline:true };
    }
    return { ok:false, reason:'needs_revalidation' };
  }
}

// --- Check updates ---
async function checkUpdates(currentVersion) {
  try {
    const r = await getJSON(`${BASE}?cmd=latest`, 4000);
    if (r && r.ok && r.version && cmpVer(r.version, currentVersion) > 0) {
      return { version: String(r.version), url: String(r.url||''), mandatory: asBool(r.mandatory), notes: String(r.notes||'') };
    }
  } catch {}
  return null;
}
// --- Enforce or ask for update installation ---
let UPDATE_IN_PROGRESS = false;

async function enforceOrAskUpdate(info) {
  if (!info || !info.url) return true;
  if (UPDATE_IN_PROGRESS)  return false;
  UPDATE_IN_PROGRESS = true;

  const must = asBool(info.mandatory);
  let proceed = must;

  if (!must) {
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Install now', 'Later'],
      defaultId: 0, cancelId: 1,
      message: 'Update available',
      detail: `Version ${info.version}. Install now?`
    });
    proceed = (response === 0);
  }
  if (!proceed) { UPDATE_IN_PROGRESS = false; return true; }

  // HUD
  const hud = createUpdateHUD();
  hud.setTitle('Updating…');
  hud.setText('Downloading installer…');
  hud.setProgress(1);

  // 1) Скачиваем сетап
  const tmpExe = path.join(app.getPath('temp'), `kc-setup-${info.version}.exe`);
  try {
    await downloadWithProgress(info.url, tmpExe, (loaded, total) => {
      const pct = total ? Math.round((loaded/total)*100) : 30;
      hud.setProgress(pct);
      hud.setText(total ? `Downloading… ${pct}%` : 'Downloading…');
    });
  } catch (e) {
    hud.close(); UPDATE_IN_PROGRESS = false;
    dialog.showMessageBoxSync({ type:'error', buttons:['OK'], message:'Failed to download update', detail:String(e) });
    return must ? false : true;
  }

  // 2) Запускаем установку через CMD-раннер (пишем лог в ProgramData)
  hud.setText('Installing update…');
  hud.setProgress(100);

  const currentExe = process.execPath;
  const installDir = path.dirname(currentExe);
  const runnerCmd  = path.join(app.getPath('temp'), 'kc_update_runner.cmd');

  const logDir  = path.join(process.env.ProgramData || 'C:\\ProgramData', 'KalkulatorCiecia');
  try { fs.mkdirSync(logDir, { recursive: true }); } catch {}
  const logFile = path.join(logDir, 'kc_update.log');

  const cmdBody = [
    '@echo off',
    'setlocal ENABLEDELAYEDEXPANSION',
    'set "SETUP=%~1"',
    'set "APP=%~2"',
    'set "DIR=%~3"',
    'set "LOG=%~4"',
    'echo [upd] setup=%SETUP%  >  "%LOG%"',
    'echo [upd] app=%APP%     >> "%LOG%"',
    'echo [upd] dir=%DIR%     >> "%LOG%"',
    'echo [upd] taskkill      >> "%LOG%"',
    'for %%n in ("%APP%","Kalkulator Ciecia.exe","KalkulatorCiecia.exe","electron.exe") do taskkill /F /T /IM %%~nxn >nul 2>nul',
    'echo [upd] wait unlock   >> "%LOG%"',
    'for /L %%i in (1,1,60) do (',
    '  powershell -NoProfile -Command "try{$f=[IO.File]::Open(\'%APP%\',\'Open\',\'ReadWrite\',\'None\');$f.Close();$true}catch{$false}" | findstr /I True >nul && goto :install',
    '  timeout /t 1 /nobreak >nul',
    ')',
    ':install',
    'echo [upd] start setup   >> "%LOG%"',
    // 'start "" /wait "%SETUP%" /S /LOG="%LOG%"',   // без /D= — NSIS знает путь установки
    'start "" /wait "%SETUP%" /LOG="%LOG%"',
    'echo [upd] setup finished errlvl=!ERRORLEVEL! >> "%LOG%"',
    'echo [upd] relaunch      >> "%LOG%"',
    'start "" "%APP%"',
    'exit /b 0'
  ].join('\r\n');

  try { fs.writeFileSync(runnerCmd, cmdBody, 'utf8'); }
  catch (e) {
    hud.close(); UPDATE_IN_PROGRESS = false;
    dialog.showMessageBoxSync({ type:'error', buttons:['OK'], message:'Failed to prepare installer', detail:String(e) });
    return must ? false : true;
  }

    // --- скрытый запуск .cmd через wscript (без окна) + fallback ---
  try {
    const vbsPath = path.join(app.getPath('temp'), 'kc_run_hidden.vbs');
    const vbs = [
      'On Error Resume Next',
      'Set sh = CreateObject("WScript.Shell")',
      'Dim cmd',
      'cmd = """" & WScript.Arguments(0) & """ """ & WScript.Arguments(1) & """ """ & WScript.Arguments(2) & """ """ & WScript.Arguments(3) & """ """ & WScript.Arguments(4) & """"',
      'sh.Run cmd, 0, False'
    ].join('\r\n');
    fs.writeFileSync(vbsPath, vbs, 'utf8');

    // runnerCmd и четыре аргумента передаём как отдельные параметры
    spawn('wscript.exe', [vbsPath, runnerCmd, tmpExe, currentExe, installDir, logFile], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref();

  } catch (e) {
    // Если WSH запрещён — запускаем старым способом (минимизировано)
    try {
      spawn('cmd.exe', ['/c', 'start', '""', '/min', runnerCmd, tmpExe, currentExe, installDir, logFile], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      }).unref();
    } catch (e2) {
      hud.close(); UPDATE_IN_PROGRESS = false;
      dialog.showMessageBoxSync({
        type:'error', buttons:['OK'],
        message:'Failed to start installer',
        detail:String(e2)
      });
      return must ? false : true;
    }
  }

  // Даём пользователю увидеть "Installing…", потом выходим.
  setTimeout(() => { try { hud.close(); } catch(_) {} app.quit(); }, 1200);
  return false;

}



module.exports = { activateOrValidate, checkUpdates, enforceOrAskUpdate };
