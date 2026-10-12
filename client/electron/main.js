import { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import dgram from 'dgram';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DISCOVERY_PORT = 41234;
const DISCOVERY_QUERY = 'DISCOVER_LAWYER_SERVER';
app.setAppUserModelId('com.lawyeroffice.desktop');

let mainWindow = null;
let tray = null;

// ─── Tray helpers ──────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '../dist/icons/icon-192.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('منظومة إدارة مكتب المحاماة');

  const menu = Menu.buildFromTemplate([
    {
      label: 'فتح التطبيق',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    { label: 'إنهاء البرنامج', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);

  // Single-click on tray icon restores the window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ─── Show notification IPC ─────────────────────────────────────────────────────
// Works even when the window is hidden/minimized because Notification is a
// system-level API that does NOT require a visible BrowserWindow.
ipcMain.handle('show-notification', (event, payload) => {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) return { success: false };
  let senderUrl;
  try { senderUrl = new URL(event.senderFrame.url); } catch { return { success: false }; }
  const trustedSender = senderUrl.protocol === 'file:' ||
    (!app.isPackaged && senderUrl.origin === 'http://localhost:5173');
  if (!trustedSender) return { success: false };
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow || senderWindow.isDestroyed()) return { success: false };
  if (!Notification.isSupported()) return { success: false };
  if (typeof payload?.title !== 'string' || typeof payload?.body !== 'string') return { success: false };

  const notification = new Notification({
    title: payload.title.slice(0, 150),
    body: payload.body.slice(0, 500),
    icon: path.join(__dirname, '../dist/icons/icon-192.png')
  });

  notification.on('click', () => {
    if (!senderWindow.isDestroyed()) {
      if (senderWindow.isMinimized()) senderWindow.restore();
      senderWindow.show();
      senderWindow.focus();
    }
  });

  notification.show();
  return { success: true };
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'منظومة إدارة مكتب المحاماة',
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0a0f1d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Minimize to tray instead of closing, so background push notifications keep working
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (tray) tray.setToolTip('التطبيق يعمل في الخلفية – انقر لفتحه');
    }
  });

  // Enable F12 to inspect DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  const distHtml = path.join(__dirname, '../dist/index.html');
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      mainWindow.loadFile(distHtml);
    });
  } else {
    mainWindow.loadFile(distHtml);
  }
}

// Handle UDP LAN auto-discovery for office server
ipcMain.handle('discover-server', async (event, timeoutMs = 3500) => {
  return new Promise((resolve) => {
    let clientSocket = null;
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (clientSocket) {
          try { clientSocket.close(); } catch {}
        }
        resolve({ success: false, message: 'لم يتم العثور على خادم تلقائياً ضمن المهلة' });
      }
    }, timeoutMs);

    try {
      clientSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      clientSocket.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          try { clientSocket.close(); } catch {}
          resolve({ success: false, error: err.message });
        }
      });

      clientSocket.on('message', (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data && data.signature === 'lawyer-office-server') {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              try { clientSocket.close(); } catch {}

              const serverIp = (data.ip && data.ip !== '127.0.0.1') ? data.ip : rinfo.address;
              const port = data.port || 3000;
              resolve({
                success: true,
                server: {
                  ...data,
                  ip: serverIp,
                  url: `http://${serverIp}:${port}`
                }
              });
            }
          }
        } catch {
          // ignore non-json packet
        }
      });

      clientSocket.bind(0, () => {
        try {
          clientSocket.setBroadcast(true);
          const message = Buffer.from(DISCOVERY_QUERY);
          // Broadcast to LAN
          clientSocket.send(message, 0, message.length, DISCOVERY_PORT, '255.255.255.255', (err) => {
            if (err) {
              // Also try broadcasting on 127.0.0.1 in case broadcast interface is restricted
              clientSocket.send(message, 0, message.length, DISCOVERY_PORT, '127.0.0.1');
            }
          });
          // Also ping localhost directly
          clientSocket.send(message, 0, message.length, DISCOVERY_PORT, '127.0.0.1');
        } catch (bindErr) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            try { clientSocket.close(); } catch {}
            resolve({ success: false, error: bindErr.message });
          }
        }
      });
    } catch (err) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ success: false, error: err.message });
      }
    }
  });
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

