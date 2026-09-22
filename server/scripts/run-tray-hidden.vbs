Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\Z10\OneDrive\Desktop\lawyer_office\server"
WshShell.Run "cmd /c npx electron trayApp.js", 0, False