#!/usr/bin/env python3
"""
=============================================================================
منظومة مكتب المحاماة - أداة النشر المباشر على السيرفر (Deploy Tool)
Lawyer Office Management System - Live VPS Deployment Tool
Server: muhami.ly (102.203.202.104)
=============================================================================
"""

import argparse
import getpass
import hashlib
import json
import os
import shutil
import ssl
import subprocess
import sys
import tarfile
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# Configure UTF-8 for console output
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Paths
ROOT_DIR = Path(__file__).resolve().parent.parent
DEPLOY_DIR = ROOT_DIR / "deploy"
RUNTIME_DIR = DEPLOY_DIR / ".ssh-runtime"
CONFIG_FILE = DEPLOY_DIR / ".deploy-config.json"
KNOWN_HOSTS_FILE = RUNTIME_DIR / "known_hosts"

# Include runtime in sys.path for paramiko
if RUNTIME_DIR.exists():
    sys.path.insert(0, str(RUNTIME_DIR))

try:
    import paramiko
except ImportError:
    print("❌ خطأ: مكتبة paramiko غير مثبتة. جاري البحث في .ssh-runtime...")
    sys.exit(1)


# Defaults
DEFAULT_HOST = "102.203.202.104"
DEFAULT_PORT = 22
DEFAULT_USER = "root"
REMOTE_APP_DIR = "/opt/lawyer_office"
HEALTH_URL_PUBLIC = "https://muhami.ly/api/health"
HEALTH_URL_LOCAL = "http://127.0.0.1:3000/api/health"


def load_saved_config():
    """Load config from .deploy-config.json if available."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_config(cfg):
    """Save persistent non-secret connection config."""
    try:
        to_save = {
            "host": cfg.get("host", DEFAULT_HOST),
            "port": cfg.get("port", DEFAULT_PORT),
            "user": cfg.get("user", DEFAULT_USER),
            "key_file": cfg.get("key_file"),
        }
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(to_save, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"⚠️ يتعذر حفظ ملف الإعدادات: {e}")


def get_connection_settings(args):
    """Resolve connection settings from args -> env -> saved config -> interactive prompt."""
    saved = load_saved_config()

    host = args.host or os.environ.get("DEPLOY_HOST") or saved.get("host") or DEFAULT_HOST
    port = int(args.port or os.environ.get("DEPLOY_PORT") or saved.get("port") or DEFAULT_PORT)
    user = args.user or os.environ.get("DEPLOY_USER") or saved.get("user") or DEFAULT_USER
    key_file = args.key or os.environ.get("DEPLOY_SSH_KEY") or saved.get("key_file")
    passphrase = os.environ.get("DEPLOY_SSH_KEY_PASSPHRASE")
    password = args.password or os.environ.get("DEPLOY_PASSWORD")

    # If no key given, look for standard SSH keys in ~/.ssh
    if not key_file and not password:
        home_ssh = Path.home() / ".ssh"
        for candidate in [home_ssh / "id_ed25519", home_ssh / "id_rsa"]:
            if candidate.exists():
                key_file = str(candidate)
                break

    # If neither key nor password is provided, prompt user
    if not key_file and not password:
        if sys.stdin.isatty():
            print(f"\n📡 إعدادات الاتصال بالسيرفر ({host}):")
            print(f"   المستخدم: {user}")
            print("   لم يتم العثور على مفتاح SSH، يرجى إدخال كلمة المرور (أو اضغط Enter إذا كنت تستخدم مفتاح آخر):")
            pwd = getpass.getpass("🔑 كلمة مرور SSH (الإدخال مخفي): ")
            if pwd:
                password = pwd
            else:
                key_input = input("📁 مسار ملف المفتاح الخاص (مثال: C:\\Users\\user\\.ssh\\id_rsa): ").strip()
                if key_input and os.path.exists(key_input):
                    key_file = key_input

    settings = {
        "host": host,
        "port": port,
        "user": user,
        "key_file": key_file,
        "passphrase": passphrase,
        "password": password,
    }

    if args.save_config:
        save_config(settings)

    return settings


def create_ssh_client(settings):
    """Establish authenticated SSH connection to server."""
    ssh = paramiko.SSHClient()

    if KNOWN_HOSTS_FILE.exists():
        try:
            ssh.load_host_keys(str(KNOWN_HOSTS_FILE))
        except Exception:
            pass

    # Accept host key if not known yet
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    connect_kwargs = {
        "hostname": settings["host"],
        "port": settings["port"],
        "username": settings["user"],
        "timeout": 30,
        "look_for_keys": False,
        "allow_agent": False,
    }

    if settings["key_file"] and os.path.exists(settings["key_file"]):
        connect_kwargs["key_filename"] = settings["key_file"]
        if settings["passphrase"]:
            connect_kwargs["passphrase"] = settings["passphrase"]
    elif settings["password"]:
        connect_kwargs["password"] = settings["password"]
    else:
        # Fallback to standard agent/keys
        connect_kwargs["look_for_keys"] = True
        connect_kwargs["allow_agent"] = True

    try:
        ssh.connect(**connect_kwargs)
        return ssh
    except Exception as e:
        print(f"❌ فشل الاتصال بالسيرفر ({settings['host']}:{settings['port']}): {e}")
        print("💡 نصيحة: تأكد من كلمة المرور أو صحة مسار مفتاح SSH.")
        sys.exit(1)


def run_remote_command(ssh, cmd, show_output=True, check=True):
    """Execute command on remote server via SSH."""
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=120, get_pty=True)
    out_lines = []
    for line in iter(stdout.readline, ""):
        out_lines.append(line)
        if show_output:
            print(line, end="", flush=True)

    status = stdout.channel.recv_exit_status()
    output_str = "".join(out_lines).strip()

    if check and status != 0:
        raise RuntimeError(f"Command failed with exit status {status}: {cmd}")

    return status, output_str


def check_health(timeout=10):
    """Check live health endpoint via HTTPS."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(
        HEALTH_URL_PUBLIC,
        headers={"User-Agent": "DeployCLI/1.0", "Cache-Control": "no-cache"}
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as res:
            if res.status == 200:
                body = json.loads(res.read().decode())
                return body.get("status") == "ok"
    except Exception:
        return False
    return False


def wait_for_health(max_attempts=12, interval=3):
    """Poll health endpoint until server responds ok."""
    print("⏳ جاري التحقق من عمل المنظومة بعد التحديث...")
    for i in range(max_attempts):
        time.sleep(interval)
        if check_health():
            return True
        print(f"  ... محاولة {i+1}/{max_attempts}")
    return False


def build_frontend():
    """Build Vite frontend locally."""
    print("\n📦 [1] بناء الواجهة الأمامية (Vite Client)...")
    client_dir = ROOT_DIR / "client"
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"

    res = subprocess.run([npm_cmd, "run", "build"], cwd=client_dir)
    if res.returncode != 0:
        print("❌ فشل بناء الواجهة الأمامية!")
        sys.exit(1)

    dist_index = client_dir / "dist" / "index.html"
    if not dist_index.exists():
        print(f"❌ لم يتم العثور على {dist_index}")
        sys.exit(1)

    print("✅ تم بناء الواجهة الأمامية بنجاح!")


def package_frontend(archive_path):
    """Create tar.gz of client/dist."""
    dist_dir = ROOT_DIR / "client" / "dist"
    print(f"📦 جاري ضغط ملفات الواجهة الأمامية -> {archive_path.name}...")
    with tarfile.open(archive_path, "w:gz") as tar:
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                full_path = Path(root) / file
                rel_path = full_path.relative_to(dist_dir)
                tar.add(full_path, arcname=f"dist/{rel_path.as_posix()}")


def package_backend(archive_path):
    """Create tar.gz of server files (excluding db, logs, node_modules)."""
    server_dir = ROOT_DIR / "server"
    print(f"📦 جاري ضغط ملفات السيرفر الخلفي -> {archive_path.name}...")

    include_root_files = ["package.json", "package-lock.json", "config.js", "index.js"]
    include_dirs = ["database", "routes", "middleware", "services", "templates", "scripts"]

    with tarfile.open(archive_path, "w:gz") as tar:
        # Add root server files
        for fname in include_root_files:
            fpath = server_dir / fname
            if fpath.exists():
                tar.add(fpath, arcname=f"server/{fname}")

        # Add subdirectories
        for sdir in include_dirs:
            full_sdir = server_dir / sdir
            if full_sdir.exists():
                for root, dirs, files in os.walk(full_sdir):
                    for file in files:
                        if file.endswith((".db", ".db-wal", ".db-shm", ".sqlite")):
                            continue
                        full_fpath = Path(root) / file
                        rel = full_fpath.relative_to(server_dir)
                        tar.add(full_fpath, arcname=f"server/{rel.as_posix()}")


def deploy_frontend(ssh, stamp):
    """Deploy frontend files only."""
    archive_path = RUNTIME_DIR / f"frontend-{stamp}.tar.gz"
    package_frontend(archive_path)

    remote_tar = f"/tmp/frontend-{stamp}.tar.gz"
    stage_dir = f"/tmp/stage-frontend-{stamp}"
    backup_dir = f"{REMOTE_APP_DIR}/deployment-backups/frontend-{stamp}"

    print(f"\n⬆️ رفع حزمة الواجهة الأمامية إلى السيرفر ({round(archive_path.stat().st_size / 1024, 1)} KB)...")
    sftp = ssh.open_sftp()
    sftp.put(str(archive_path), remote_tar)
    sftp.close()

    print("🔄 تطبيق تحديثات الواجهة الأمامية على السيرفر...")
    cmds = [
        f"mkdir -p {stage_dir} {REMOTE_APP_DIR}/deployment-backups",
        f"tar -xzf {remote_tar} -C {stage_dir}",
        # Backup existing dist
        f"if [ -d {REMOTE_APP_DIR}/client/dist ]; then cp -r {REMOTE_APP_DIR}/client/dist {backup_dir}; fi",
        # Copy new files
        f"mkdir -p {REMOTE_APP_DIR}/client/dist",
        f"cp -r {stage_dir}/dist/* {REMOTE_APP_DIR}/client/dist/",
        f"chown -R lawyer:lawyer {REMOTE_APP_DIR}/client/dist",
        f"rm -rf {stage_dir} {remote_tar}",
        "nginx -t && systemctl reload nginx",
    ]
    run_remote_command(ssh, " && ".join(cmds), show_output=True)

    # Clean local archive
    if archive_path.exists():
        archive_path.unlink()

    print("✅ تم تحديث الواجهة الأمامية بنجاح!")


def deploy_backend(ssh, stamp):
    """Deploy backend files and run migrations."""
    archive_path = RUNTIME_DIR / f"server-{stamp}.tar.gz"
    package_backend(archive_path)

    remote_tar = f"/tmp/server-{stamp}.tar.gz"
    stage_dir = f"/tmp/stage-server-{stamp}"
    backup_dir = f"{REMOTE_APP_DIR}/deployment-backups/server-{stamp}"

    print(f"\n⬆️ رفع حزمة السيرفر الخلفي ({round(archive_path.stat().st_size / 1024, 1)} KB)...")
    sftp = ssh.open_sftp()
    sftp.put(str(archive_path), remote_tar)
    sftp.close()

    print("🔄 تطبيق تحديثات السيرفر وقاعدة البيانات...")
    cmds = [
        f"mkdir -p {stage_dir} {REMOTE_APP_DIR}/deployment-backups",
        f"tar -xzf {remote_tar} -C {stage_dir}",
        # Backup existing server (excluding heavy dirs)
        f"mkdir -p {backup_dir}",
        f"rsync -a --exclude 'node_modules' --exclude 'uploads' --exclude 'backups' --exclude '*.db*' {REMOTE_APP_DIR}/server/ {backup_dir}/",
        # Copy updated server files
        f"cp -r {stage_dir}/server/* {REMOTE_APP_DIR}/server/",
        # Ensure directories exist
        f"mkdir -p {REMOTE_APP_DIR}/server/database {REMOTE_APP_DIR}/server/uploads {REMOTE_APP_DIR}/server/backups",
        # Install packages if package.json was updated
        f"cd {REMOTE_APP_DIR}/server && npm install --omit=dev --legacy-peer-deps",
        # Run DB migrations
        f"cd {REMOTE_APP_DIR}/server && node -e \"import('./database/db.js').then(() => {{ console.log('✅ DB Schema & Migrations Applied'); process.exit(0); }}).catch(e => {{ console.error(e); process.exit(1); }})\"",
        # Set ownership
        f"chown -R lawyer:lawyer {REMOTE_APP_DIR}/server",
        f"rm -rf {stage_dir} {remote_tar}",
        # Restart service
        "systemctl daemon-reload",
        "systemctl restart lawyer-office",
    ]
    run_remote_command(ssh, " && ".join(cmds), show_output=True)

    # Clean local archive
    if archive_path.exists():
        archive_path.unlink()

    print("✅ تم تحديث السيرفر وقاعدة البيانات بنجاح!")


def show_server_status(ssh):
    """Display comprehensive status of VPS and lawyer-office service."""
    print("\n====================================================")
    print("📊 حالة السيرفر والمنظومة (VPS Status)")
    print("====================================================")
    status_cmds = [
        "echo '🔹 [1] حالة خدمة المنظومة (lawyer-office):'",
        "systemctl status lawyer-office --no-pager -l || true",
        "echo '\n🔹 [2] استهلاك الذاكرة (RAM):'",
        "free -h",
        "echo '\n🔹 [3] مساحة القرص الصلب (Disk):'",
        "df -h /",
        "echo '\n🔹 [4] وقت تشغيل السيرفر (Uptime):'",
        "uptime",
        "echo '\n🔹 [5] فحص فحص الصحة المحلي:'",
        "curl -s http://127.0.0.1:3000/api/health || echo 'Health check failed locally'",
    ]
    run_remote_command(ssh, " && ".join(status_cmds), show_output=True, check=False)
    print("====================================================\n")


def show_server_logs(ssh, lines=50):
    """Fetch recent journalctl logs for lawyer-office."""
    print(f"\n📜 آخر {lines} سطر من سجلات المنظومة (Server Logs):")
    print("====================================================")
    cmd = f"journalctl -u lawyer-office -n {lines} --no-pager"
    run_remote_command(ssh, cmd, show_output=True, check=False)
    print("====================================================\n")


def restart_service(ssh):
    """Restart lawyer-office systemd service."""
    print("\n🔄 جاري إعادة تشغيل خدمة المنظومة على السيرفر...")
    cmds = [
        "systemctl daemon-reload",
        "systemctl restart lawyer-office",
        "sleep 2",
        "systemctl is-active lawyer-office",
    ]
    run_remote_command(ssh, " && ".join(cmds), show_output=True)
    if wait_for_health():
        print("🎉 تمت إعادة التشغيل والمنظومة تعمل بشكل طبيعي!")
    else:
        print("⚠️ المنظومة لم تستجب لفحص الصحة بسرعة، تحقق من السجلات.")


def main():
    parser = argparse.ArgumentParser(description="أداة نشر منظومة مكتب المحاماة على السيرفر")
    parser.add_argument("--mode", choices=["all", "frontend", "backend", "status", "logs", "restart"], default=None,
                        help="نوع العملية (all: كامل، frontend: الواجهة، backend: السيرفر، status: الحالة، logs: السجلات، restart: إعادة تشغيل)")
    parser.add_argument("--host", default=None, help=f"عنوان IP أو الدومين (الافتراضي: {DEFAULT_HOST})")
    parser.add_argument("--port", type=int, default=None, help="منفذ SSH (الافتراضي: 22)")
    parser.add_argument("--user", default=None, help="مستخدم SSH (الافتراضي: root)")
    parser.add_argument("--key", default=None, help="مسار ملف SSH Private Key")
    parser.add_argument("--password", default=None, help="كلمة مرور SSH")
    parser.add_argument("--skip-build", action="store_true", help="تخطي خطوة بناء الواجهة الأمامية")
    parser.add_argument("--save-config", action="store_true", help="حفظ إعدادات الاتصال محلياً")
    parser.add_argument("--lines", type=int, default=50, help="عدد أسطر السجلات لعرضها في وضع logs")

    args = parser.parse_args()

    # Interactive mode selection if run without mode
    mode = args.mode
    if not mode:
        if sys.stdin.isatty():
            print("==============================================================")
            print("  ⚖️ منظومة مكتب المحاماة - أداة النشر المباشر على السيرفر")
            print("  🌐 الموقع: https://muhami.ly | السيرفر: 102.203.202.104")
            print("==============================================================")
            print("  [1] نشر كامل (Full Deploy: الواجهة الأمامية + السيرفر)")
            print("  [2] نشر الواجهة فقط (Frontend Only - سريع)")
            print("  [3] نشر السيرفر فقط (Backend & Database - سريع)")
            print("  [4] فحص حالة السيرفر (Server Status)")
            print("  [5] عرض سجلات المنظومة (Server Logs)")
            print("  [6] إعادة تشغيل خدمة المنظومة (Restart Service)")
            print("  [0] خروج (Exit)")
            print("==============================================================")
            choice = input("👉 اختر رقم العملية [الافتراضي: 1]: ").strip()
            mode_map = {
                "": "all",
                "1": "all",
                "2": "frontend",
                "3": "backend",
                "4": "status",
                "5": "logs",
                "6": "restart",
                "0": "exit",
            }
            mode = mode_map.get(choice, "all")
            if mode == "exit":
                print("تم الإلغاء.")
                sys.exit(0)
        else:
            mode = "all"

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    settings = get_connection_settings(args)

    print(f"\n🚀 الاتصال بالسيرفر {settings['user']}@{settings['host']}:{settings['port']}...")
    ssh = create_ssh_client(settings)
    print("✅ تم الاتصال بالسيرفر بنجاح!")

    try:
        if mode == "status":
            show_server_status(ssh)

        elif mode == "logs":
            show_server_logs(ssh, lines=args.lines)

        elif mode == "restart":
            restart_service(ssh)

        elif mode == "frontend":
            if not args.skip_build:
                build_frontend()
            deploy_frontend(ssh, stamp)
            if wait_for_health():
                print(f"\n🎉 مبارك! تم نشر الواجهة بنجاح على: {HEALTH_URL_PUBLIC}")
            else:
                print("\n⚠️ تم الرفع ولكن فحص الصحة لم يستجب، تحقق من السجلات.")

        elif mode == "backend":
            deploy_backend(ssh, stamp)
            if wait_for_health():
                print(f"\n🎉 مبارك! تم تحديث السيرفر بنجاح على: {HEALTH_URL_PUBLIC}")
            else:
                print("\n⚠️ تم الرفع ولكن فحص الصحة لم يستجب، تحقق من السجلات.")

        elif mode == "all":
            if not args.skip_build:
                build_frontend()
            deploy_frontend(ssh, stamp)
            deploy_backend(ssh, stamp)

            if wait_for_health():
                print("\n==============================================================")
                print("🎉 مبارك! تم نشر جميع التحديثات بنجاح تام على السيرفر!")
                print(f"🔗 رابط المنظومة المباشر: https://muhami.ly")
                print(f"⏰ وقت النشر الموثق: {stamp}")
                print("==============================================================")
            else:
                print("\n⚠️ انتهى النشر ولكن فحص الصحة لم يستجب، يمكنك تشغيل logs للفحص.")

    finally:
        ssh.close()


if __name__ == "__main__":
    main()
