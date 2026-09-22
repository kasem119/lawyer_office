$code = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class LockerSearch {
    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    static extern int RmStartSession(out uint pSessionHandle, int dwSessionFlags, string strSessionKey);

    [DllImport("rstrtmgr.dll")]
    static extern int RmEndSession(uint pSessionHandle);

    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    static extern int RmRegisterResources(uint pSessionHandle, uint nFiles, string[] rgsFilenames, uint nApplications, [In] uint[] rgApplications, uint nServices, string[] rgsServiceNames);

    [DllImport("rstrtmgr.dll")]
    static extern int RmGetList(uint pSessionHandle, out uint pnProcInfoNeeded, ref uint pnProcInfo, [In, Out] RM_PROCESS_INFO[] rgAffectedApps, ref uint lpdwRebootReasons);

    [StructLayout(LayoutKind.Sequential)]
    struct RM_UNIQUE_PROCESS {
        public int dwProcessId;
        public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct RM_PROCESS_INFO {
        public RM_UNIQUE_PROCESS Process;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string strAppName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
        public string strServiceShortName;
        public int ApplicationType;
        public uint AppStatus;
        public uint TSSessionId;
        [MarshalAs(UnmanagedType.Bool)]
        public bool bRestartable;
    }

    public static int[] GetLockingProcesses(string filePath) {
        uint handle;
        string key = Guid.NewGuid().ToString();
        int res = RmStartSession(out handle, 0, key);
        if (res != 0) return new int[0];
        try {
            string[] files = new string[] { filePath };
            res = RmRegisterResources(handle, (uint)files.Length, files, 0, null, 0, null);
            if (res != 0) return new int[0];
            uint procNeeded = 0;
            uint procCount = 0;
            uint reasons = 0;
            res = RmGetList(handle, out procNeeded, ref procCount, null, ref reasons);
            if (res == 234) { // ERROR_MORE_DATA
                RM_PROCESS_INFO[] procs = new RM_PROCESS_INFO[procNeeded];
                procCount = procNeeded;
                res = RmGetList(handle, out procNeeded, ref procCount, procs, ref reasons);
                if (res == 0) {
                    int[] result = new int[procCount];
                    for (int i = 0; i < procCount; i++) {
                        result[i] = procs[i].Process.dwProcessId;
                    }
                    return result;
                }
            }
            return new int[0];
        } finally {
            RmEndSession(handle);
        }
    }
}
'@

Add-Type -TypeDefinition $code
$target = "C:\Users\Z10\OneDrive\Desktop\lawyer_office\client\release\win-unpacked\resources\app.asar"
$pids = [LockerSearch]::GetLockingProcesses($target)
Write-Host "Locking PIDs found: $($pids.Count)"
foreach ($id in $pids) {
    try {
        $p = Get-Process -Id $id
        Write-Host "PID: $id Name: $($p.ProcessName) Path: $($p.Path)"
        Stop-Process -Id $id -Force
        Write-Host "Killed process $id"
    } catch {
        Write-Host "Could not inspect or kill PID $id"
    }
}
