Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\Z10\OneDrive\Desktop\lawyer_office\server"
WshShell.Run "node index.js", 0, False
