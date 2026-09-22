' VBScript to launch Lawyer Office Tray Monitor silently
Set WshShell = CreateObject(WScript.Shell)
Set fso = CreateObject(Scripting.FileSystemObject)
currentDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))

WshShell.CurrentDirectory = currentDir
WshShell.Run cmd /c npm run tray, 0, False
