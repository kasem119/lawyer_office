#!/usr/bin/env python3
"""
سكربت النشر التلقائي لمنظومة مكتب المحاماة على سيرفر العنكبوت الليبي
تشغيل: python deploy/deploy_to_vps.py
"""
import os
import sys
import time
import paramiko

HOST = "102.203.202.104"
PORT = 22
USER = "root"
PASSWORD = "GTRdCg99Y9o3"

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ZIP_FILE = os.path.join(CURRENT_DIR, "lawyer_office.zip")
SETUP_SH = os.path.join(CURRENT_DIR, "setup-vps.sh")
NGINX_CONF = os.path.join(CURRENT_DIR, "nginx-lawyer-office.conf")
SERVICE_FILE = os.path.join(CURRENT_DIR, "lawyer-office.service")

# Reconfigure stdout/stderr to UTF-8 on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def main():
    print("====================================================")
    print(f"🚀 بدء نشر منظومة مكتب المحاماة على السيرفر ({HOST}:{PORT})...")
    print("====================================================")

    if not os.path.exists(ZIP_FILE):
        print(f"❌ خطأ: لم يتم العثور على حزمة النشر: {ZIP_FILE}")
        sys.exit(1)

    print("\n[1/3] جاري الاتصال بالسيرفر عبر SSH...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30, look_for_keys=False, allow_agent=False)
        print("✅ تم الاتصال بالسيرفر بنجاح!")
    except Exception as e:
        print(f"❌ فشل الاتصال بالسيرفر: {e}")
        print("يرجى التأكد من اكتمال تجهيز السيرفر من طرف العنكبوت الليبي.")
        sys.exit(1)

    print("\n[2/3] جاري رفع ملفات المنظومة وإعدادات السيرفر عبر SFTP...")
    sftp = ssh.open_sftp()
    
    files_to_upload = [
        (ZIP_FILE, "/tmp/lawyer_office.zip"),
        (SETUP_SH, "/tmp/setup-vps.sh"),
        (NGINX_CONF, "/tmp/nginx-lawyer-office.conf"),
        (SERVICE_FILE, "/tmp/lawyer-office.service")
    ]

    for local_path, remote_path in files_to_upload:
        size_mb = round(os.path.getsize(local_path) / (1024 * 1024), 2)
        print(f"  ⬆️ رفع: {os.path.basename(local_path)} ({size_mb} MB) -> {remote_path}...")
        sftp.put(local_path, remote_path)
    
    sftp.close()
    print("✅ تم رفع جميع الملفات بنجاح!")

    print("\n[3/3] جاري تشغيل سكربت الإعداد التلقائي على السيرفر (قد يستغرق 1-2 دقيقة)...")
    cmd = f"bash /tmp/setup-vps.sh {HOST}"
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)

    for line in iter(stdout.readline, ""):
        print(line, end="", flush=True)

    status = stdout.channel.recv_exit_status()
    ssh.close()

    if status == 0:
        print("\n====================================================")
        print("🎉 مبارك! تم تثبيت وتشغيل المنظومة بنجاح تام!")
        print(f"🔗 يمكنك فتح المنظومة وتجربتها الآن عبر المتصفح:")
        print(f"   http://{HOST}")
        print("====================================================")
    else:
        print(f"\n⚠️ انتهى السكربت مع كود خروج: {status}")

if __name__ == "__main__":
    main()
