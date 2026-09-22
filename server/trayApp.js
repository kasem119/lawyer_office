import { app, Tray, Menu, shell, Notification, nativeImage, clipboard } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { exec } from 'child_process';
import { PORT } from './config.js';
import { getLocalIpAddresses, getPrimaryLocalIp } from './services/discoveryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tray = null;
let serverStatus = 'checking'; // 'online' | 'offline' | 'checking'
let previousStatus = null;

const onlineIconPath = path.join(__dirname, 'tray-online.png');
const offlineIconPath = path.join(__dirname, 'tray-offline.png');

// Load real PNG icons
function getTrayIcon(isOnline) {
  const iconPath = isOnline ? onlineIconPath : offlineIconPath;
  const icon = nativeImage.createFromPath(iconPath);
  return icon.resize({ width: 18, height: 18 });
}

// Check server status
function checkServerHealth(callback) {
  const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
    const newStatus = res.statusCode === 200 ? 'online' : 'offline';
    handleStatusChange(newStatus);
    if (callback) callback(newStatus);
  });

  req.on('error', () => {
    handleStatusChange('offline');
    if (callback) callback('offline');
  });

  req.setTimeout(2500, () => {
    req.destroy();
  });
}

function handleStatusChange(newStatus) {
  const changed = serverStatus !== newStatus;
  serverStatus = newStatus;

  if (tray) {
    tray.setImage(getTrayIcon(serverStatus === 'online'));
    tray.setToolTip(
      serverStatus === 'online'
        ? 'خادم مكتب المحاماة: متصل ويعمل 🟢'
        : 'خادم مكتب المحاماة: متوقف 🔴'
    );
  }

  updateTrayMenu();

  // Notify lawyer ONLY when transitioning from offline to online (never spam on offline)
  if (changed && previousStatus === 'offline' && serverStatus === 'online' && Notification.isSupported()) {
    new Notification({
      title: 'خادم منظومة مكتب المحاماة',
      body: `🟢 الخادم متصل وجاهز للعمل! جميع أجهزة المكتب يمكنها الاتصال الآن.`
    }).show();
  }

  previousStatus = serverStatus;
}

function updateTrayMenu() {
  if (!tray) return;

  const primaryIp = getPrimaryLocalIp();
  const allIps = getLocalIpAddresses();
  const isOnline = serverStatus === 'online';
  const serverUrl = `http://${primaryIp}:${PORT}`;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '⚖️ منظومة إدارة مكتب المحاماة',
      enabled: false
    },
    {
      label: isOnline ? '🟢 حالة الخادم: متصل ويعمل بنجاح' : '🔴 حالة الخادم: متوقف أو غير متاح',
      enabled: false
    },
    {
      label: `📡 المنفذ: ${PORT}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: '🌐 عنوان السيرفر للأجهزة:',
      submenu: [
        {
          label: `📋 نسخ الرابط: ${serverUrl}`,
          click: () => {
            clipboard.writeText(serverUrl);
            if (Notification.isSupported()) {
              new Notification({
                title: 'تم نسخ الرابط',
                body: `تم نسخ ${serverUrl} إلى الحافظة. أرسله للمحامين لفتح المنظومة.`
              }).show();
            }
          }
        },
        ...(allIps.map(item => ({
          label: `[${item.interface}] http://${item.ip}:${PORT}`,
          click: () => {
            const url = `http://${item.ip}:${PORT}`;
            clipboard.writeText(url);
            shell.openExternal(url);
          }
        })))
      ]
    },
    {
      label: '🚀 فتح المنظومة في المتصفح',
      click: () => {
        shell.openExternal(`http://localhost:${PORT}`);
      }
    },
    { type: 'separator' },
    {
      label: '⚙️ التحكم في الخادم (Server Controls)',
      submenu: [
        {
          label: '▶️ بدء تشغيل الخادم (Start Server)',
          enabled: !isOnline,
          click: () => {
            startServerInBackground();
          }
        },
        {
          label: '🔄 إعادة تشغيل الخادم (Restart Server)',
          click: () => {
            stopServer();
            setTimeout(startServerInBackground, 1500);
          }
        },
        {
          label: '⏹️ إيقاف الخادم (Stop Server)',
          enabled: isOnline,
          click: () => {
            stopServer();
          }
        }
      ]
    },
    {
      label: '💾 أخذ نسخة احتياطية فورية الآن',
      click: () => {
        exec('node -e "import(\'./services/backupService.js\').then(m => m.runBackup())"', { cwd: __dirname }, (err) => {
          if (Notification.isSupported()) {
            new Notification({
              title: 'النسخ الاحتياطي',
              body: err ? `❌ تعذر إتمام النسخ: ${err.message}` : `✅ تم إنشاء نسخة احتياطية بنجاح!`
            }).show();
          }
        });
      }
    },
    {
      label: '📁 فتح مجلد النسخ الاحتياطية (Backups)',
      click: () => {
        shell.openPath(path.join(__dirname, 'backups'));
      }
    },
    {
      label: '📁 فتح مجلد المستندات (Uploads)',
      click: () => {
        shell.openPath(path.join(__dirname, 'uploads'));
      }
    },
    { type: 'separator' },
    {
      label: '🔄 فحص الحالة الآن',
      click: () => {
        checkServerHealth((status) => {
          if (Notification.isSupported()) {
            new Notification({
              title: 'فحص حالة الخادم',
              body: status === 'online' ? '🟢 الخادم يعمل وجاهز للاتصال' : '🔴 الخادم متوقف حالياً'
            }).show();
          }
        });
      }
    },
    { type: 'separator' },
    {
      label: '❌ إغلاق الأيقونة (Exit)',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function startServerInBackground() {
  const vbsPath = path.join(__dirname, 'scripts', 'run-server-hidden.vbs');
  exec(`wscript.exe "${vbsPath}"`, { cwd: __dirname }, (err) => {
    if (err) {
      // Fallback: spawn node directly
      exec('cmd.exe /c node index.js', { cwd: __dirname, windowsHide: true });
    }
    setTimeout(checkServerHealth, 2500);
  });
}

function stopServer() {
  exec('taskkill /f /im node.exe', () => {
    setTimeout(checkServerHealth, 1500);
  });
}

app.whenReady().then(() => {
  app.dock?.hide();

  // Enable launch on Windows startup
  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true
    });
  } catch {}

  const initialIcon = getTrayIcon(false);
  tray = new Tray(initialIcon);

  tray.on('double-click', () => {
    shell.openExternal(`http://localhost:${PORT}`);
  });

  tray.on('click', () => {
    tray.popUpContextMenu();
  });

  // Initial health check: if offline on boot, start server automatically!
  checkServerHealth((status) => {
    if (status === 'offline') {
      startServerInBackground();
    }
  });

  // Periodic health check every 8 seconds
  setInterval(checkServerHealth, 8000);
});

