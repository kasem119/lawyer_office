import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import dgram from 'dgram';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DISCOVERY_PORT = 41234;
const DISCOVERY_QUERY = 'DISCOVER_LAWYER_SERVER';

function createWindow() {
  const win = new BrowserWindow({
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

  win.once('ready-to-show', () => {
    win.show();
  });

  // Enable F12 to inspect DevTools
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  const distHtml = path.join(__dirname, '../dist/index.html');
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev) {
    win.loadURL('http://localhost:5173').catch(() => {
      win.loadFile(distHtml);
    });
  } else {
    win.loadFile(distHtml);
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
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

