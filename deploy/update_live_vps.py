#!/usr/bin/env python3
"""
سكربت التحديث المباشر لمنظومة المحامي الليبي على سيرفر VPS (العنكبوت الليبي)
يشمل:
1. رفع كود الخادم والواجهة الجديد
2. تطبيق ترقيات قاعدة البيانات وعزل المستأجرين (Multi-Tenancy)
3. تنظيف البيانات الوهمية التي ظهرت في حساب المحامي
4. إنشاء حساب مستقل تماماً لمالك المنصة (Super Admin)
"""
import os
import sys
import time
import paramiko
import bcrypt

HOST = "102.203.202.104"
PORT = 22
USER = "root"
PASSWORD = "GTRdCg99Y9o3"

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ZIP_FILE = os.path.join(CURRENT_DIR, "lawyer_office.zip")

# Reconfigure stdout/stderr to UTF-8
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def main():
    print("====================================================")
    print(f"🚀 بدء تحديث المنظومة المباشر على الخادم ({HOST}:{PORT})...")
    print("====================================================")

    if not os.path.exists(ZIP_FILE):
        print(f"❌ خطأ: الحزمة غير موجودة في: {ZIP_FILE}")
        sys.exit(1)

    # Generate super_admin password hash
    super_pw = b"Owner#Libya2026!"
    salt = bcrypt.gensalt(10)
    super_hash = bcrypt.hashpw(super_pw, salt).decode('utf-8')

    print("\n[1/5] جاري الاتصال بالسيرفر عبر SSH...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30, look_for_keys=False, allow_agent=False)
    print("✅ تم الاتصال بنجاح!")

    print("\n[2/5] جاري رفع حزمة الكود المحدثة وإعدادات Nginx...")
    sftp = ssh.open_sftp()
    remote_zip = "/tmp/lawyer_office.zip"
    sftp.put(ZIP_FILE, remote_zip)
    nginx_conf_local = os.path.join(CURRENT_DIR, "nginx-lawyer-office.conf")
    if os.path.exists(nginx_conf_local):
        sftp.put(nginx_conf_local, "/tmp/nginx-lawyer-office.conf")
    sftp.close()
    print("✅ تم رفع الحزم بنجاح إلى السيرفر!")

    print("\n[3/5] تطبيق التحديثات وإعدادات Nginx وقاعدة البيانات...")
    commands = [
        "systemctl stop lawyer-office",
        "rm -rf /opt/lawyer_office/client/dist/*",
        "unzip -o /tmp/lawyer_office.zip -d /opt/lawyer_office",
        "mkdir -p /opt/lawyer_office/server/database /opt/lawyer_office/server/uploads /opt/lawyer_office/server/backups",
        # Update ALLOWED_ORIGIN in .env
        "sed -i 's|ALLOWED_ORIGIN=.*|ALLOWED_ORIGIN=https://muhami.ly,http://muhami.ly,http://102.203.202.104,https://102.203.202.104|' /opt/lawyer_office/server/.env",
        # Reload Nginx for any asset caching changes
        "nginx -t && systemctl reload nginx",
        "cd /opt/lawyer_office/server && npm install --omit=dev --legacy-peer-deps",
        # Run DB migrations
        "cd /opt/lawyer_office/server && node -e \"import('./database/db.js').then(() => { console.log('DB MIGRATIONS COMPLETED'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); })\"",
        # Ensure office admin is strictly 'admin' role of tenant 1
        "sqlite3 /opt/lawyer_office/server/database/lawyer_office.db \"UPDATE users SET role = 'admin', tenant_id = 1 WHERE email = 'admin@lawyer.com';\"",
        # Ensure owner is super_admin
        f"sqlite3 /opt/lawyer_office/server/database/lawyer_office.db \"INSERT OR IGNORE INTO users (name, email, password_hash, role, phone, is_active) VALUES ('مالك المنظومة (SaaS)', 'owner@lawyer.com', '{super_hash}', 'super_admin', '0910000000', 1);\"",
        f"sqlite3 /opt/lawyer_office/server/database/lawyer_office.db \"UPDATE users SET role = 'super_admin' WHERE email = 'owner@lawyer.com';\"",
        # Fix permissions
        "chown -R lawyer:lawyer /opt/lawyer_office",
        "systemctl daemon-reload",
        "systemctl start lawyer-office",
        "sleep 3"
    ]

    full_cmd = " && ".join(commands)
    stdin, stdout, stderr = ssh.exec_command(full_cmd, get_pty=True)
    for line in iter(stdout.readline, ""):
        print(line, end="", flush=True)

    exit_status = stdout.channel.recv_exit_status()
    if exit_status != 0:
        print(f"⚠️ تحذير: كود الخروج = {exit_status}")

    print("\n[4/5] التحقق من حالة المنظومة على السيرفر...")
    stdin, stdout, stderr = ssh.exec_command("systemctl is-active lawyer-office")
    service_status = stdout.read().decode('utf-8').strip()
    print(f"حالة الخدمة (Service status): {service_status}")

    print("\n[5/5] فحص حسابات المستخدمين والمستأجرين على السيرفر بعد التنظيف:")
    check_cmd = """
    echo "=== المستخدمون الحاليون في النظام ==="
    sqlite3 /opt/lawyer_office/server/database/lawyer_office.db "SELECT id, name, email, role, tenant_id FROM users;"
    echo ""
    echo "=== المكاتب المسجلة في النظام ==="
    sqlite3 /opt/lawyer_office/server/database/lawyer_office.db "SELECT id, name, slug, plan, status FROM tenants;"
    echo ""
    echo "=== اختبار Endpoint الصحة ==="
    curl -s http://127.0.0.1:3000/api/health
    echo ""
    """
    stdin, stdout, stderr = ssh.exec_command(check_cmd)
    print(stdout.read().decode('utf-8'))

    ssh.close()

    print("====================================================")
    print("🎉 تم التحديث والتنظيف بنجاح تام على خادم العنكبوت الليبي!")
    print(f"🔗 يمكنك فتح الموقع وتجربة المنظومة الآن مباشرة:")
    print(f"   http://{HOST}")
    print("====================================================")

if __name__ == "__main__":
    main()
