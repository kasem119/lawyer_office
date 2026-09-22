import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.dirname(__dirname);
const rootDir = path.dirname(serverDir);

const electronExe = path.join(serverDir, 'node_modules', 'electron', 'dist', 'electron.exe');
const trayScript = path.join(serverDir, 'trayApp.js');
const serverScript = path.join(serverDir, 'index.js');
const scriptsDir = __dirname;
const serverVbs = path.join(scriptsDir, 'run-server-hidden.vbs');
const startupDir = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const desktopDir = path.join(process.env.USERPROFILE, 'OneDrive', 'Desktop');

// 1. Create run-server-hidden.vbs
const vbsContent = `Set WshShell = CreateObject("WScript.Shell")\r\nWshShell.CurrentDirectory = "${serverDir}"\r\nWshShell.Run "node index.js", 0, False\r\n`;
fs.writeFileSync(serverVbs, vbsContent, 'ascii');
console.log('[+] Created silent server launcher:', serverVbs);

// Helper to create shortcut via VBScript
function makeShortcut(destLnk, targetPath, args, workDir, desc) {
  const tmpVbs = path.join(scriptsDir, 'temp_shortcut.vbs');
  const code = `
Set ws = CreateObject("WScript.Shell")
Set s = ws.CreateShortcut("${destLnk.replace(/\\/g, '\\\\')}")
s.TargetPath = "${targetPath.replace(/\\/g, '\\\\')}"
s.Arguments = "${args.replace(/"/g, '""').replace(/\\/g, '\\\\')}"
s.WorkingDirectory = "${workDir.replace(/\\/g, '\\\\')}"
s.Description = "${desc}"
s.Save()
`;
  fs.writeFileSync(tmpVbs, code, 'ascii');
  execSync(`cscript //nologo "${tmpVbs}"`);
  try { fs.unlinkSync(tmpVbs); } catch {}
  console.log('[+] Shortcut created:', destLnk);
}

// 2. Startup Shortcuts
makeShortcut(
  path.join(startupDir, 'LawyerOfficeTray.lnk'),
  electronExe,
  `"${trayScript}"`,
  serverDir,
  'Lawyer Office Tray Monitor'
);

makeShortcut(
  path.join(startupDir, 'LawyerOfficeServer.lnk'),
  'wscript.exe',
  `"${serverVbs}"`,
  serverDir,
  'Lawyer Office Server'
);

// 3. Desktop Shortcut for the lawyer!
makeShortcut(
  path.join(desktopDir, 'LawyerOffice_TrayMonitor.lnk'),
  electronExe,
  `"${trayScript}"`,
  serverDir,
  'Lawyer Office Tray Monitor'
);

// 4. Registry HKCU Run
try {
  const regCmdTray = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "LawyerOfficeTray" /t REG_SZ /d "\\"${electronExe}\\" \\"${trayScript}\\"" /f`;
  const regCmdServer = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "LawyerOfficeServer" /t REG_SZ /d "wscript.exe \\"${serverVbs}\\"" /f`;
  execSync(regCmdTray);
  execSync(regCmdServer);
  console.log('[+] Registry Run keys configured successfully.');
} catch (e) {
  console.log('[!] Registry note:', e.message);
}

console.log('✅ ALL_CONFIGURED_SUCCESSFULLY');
