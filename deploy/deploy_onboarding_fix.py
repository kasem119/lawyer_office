"""Deploy only the reviewed onboarding route, with a code backup and rollback."""
import getpass
import hashlib
import json
import os
from pathlib import Path
import shlex
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
RUNTIME = ROOT / 'deploy' / '.ssh-runtime'
sys.path.insert(0, str(RUNTIME))
import paramiko

HOST = os.environ.get('DEPLOY_HOST', '102.203.202.104')
PORT = int(os.environ.get('DEPLOY_PORT', '22'))
USER = os.environ.get('DEPLOY_USER') or input('Deployment SSH username [root]: ').strip() or 'root'
KEY_FILE = os.environ.get('DEPLOY_SSH_KEY')
KEY_PASSPHRASE = os.environ.get('DEPLOY_SSH_KEY_PASSPHRASE')
PASSWORD = None if KEY_FILE else getpass.getpass('Deployment SSH password (input is hidden): ')
BASE = '/opt/lawyer_office'
RELATIVE = 'server/routes/onboardingRoutes.js'
LOCAL_FILE = ROOT / RELATIVE
EXPECTED = hashlib.sha256(LOCAL_FILE.read_bytes()).hexdigest()
STAMP = time.strftime('%Y%m%d-%H%M%S', time.gmtime())
STAGE = f'/tmp/lawyer-onboarding-{STAMP}'
BACKUP = f'{BASE}/deployment-backups/onboarding-{STAMP}'

ssh = paramiko.SSHClient()
ssh.load_host_keys(str(RUNTIME / 'known_hosts'))
ssh.set_missing_host_key_policy(paramiko.RejectPolicy())


def command(text):
    _, stdout, stderr = ssh.exec_command(text, timeout=90)
    output = stdout.read().decode('utf-8', errors='replace').strip()
    errors = stderr.read().decode('utf-8', errors='replace').strip()
    status = stdout.channel.recv_exit_status()
    if status:
        raise RuntimeError(f'Remote command failed ({status}): {errors or output}')
    return output


def health(url='http://127.0.0.1:3000/api/health'):
    try:
        body = json.loads(command(f'curl --location --fail --silent --max-time 15 {shlex.quote(url)}'))
        return body.get('status') == 'ok'
    except (RuntimeError, json.JSONDecodeError):
        # Service restarts briefly refuse connections; callers retry health.
        return False


def wait_for_health(url='http://127.0.0.1:3000/api/health', attempts=15):
    for _ in range(attempts):
        if health(url):
            return True
        time.sleep(2)
    return False


try:
    ssh.connect(HOST, port=PORT, username=USER, key_filename=KEY_FILE,
                passphrase=KEY_PASSPHRASE, password=PASSWORD, timeout=25,
                look_for_keys=False, allow_agent=False)
    if len(sys.argv) > 1 and sys.argv[1] == 'preflight':
        state = command('systemctl show lawyer-office --property=ActiveState,SubState,ExecMainStatus,ExecMainStartTimestamp')
        listeners = command("ss -ltnp 2>/dev/null | grep -E ':(3000|80|443)\\b' || true")
        recent_service_log = command('journalctl -u lawyer-office -n 25 --no-pager --output=cat 2>/dev/null || true')
        local_ok = health()
        try:
            public_ok = wait_for_health('https://muhami.ly/api/health', attempts=3)
        except Exception:
            public_ok = False
        print(json.dumps({
            'service': state, 'local_api_health': 'ok' if local_ok else 'failed',
            'public_api_health': 'ok' if public_ok else 'failed',
            'listeners': listeners, 'recent_service_log': recent_service_log
        }))
        sys.exit(0)
    if not health():
        raise RuntimeError('Pre-deployment service health check failed')

    remote_path = f'{BASE}/{RELATIVE}'
    prior_hash = command(f'sha256sum {remote_path}').split()[0]
    command(f'mkdir -p {STAGE} {BACKUP}')
    with ssh.open_sftp() as sftp:
        sftp.put(str(LOCAL_FILE), f'{STAGE}/onboardingRoutes.js')

    command(f'node --check {STAGE}/onboardingRoutes.js')
    if command(f'sha256sum {STAGE}/onboardingRoutes.js').split()[0] != EXPECTED:
        raise RuntimeError('Staged onboarding route checksum mismatch')
    if command(f'sha256sum {remote_path}').split()[0] != prior_hash:
        raise RuntimeError('Live onboarding route changed during preflight; deployment cancelled')

    command(f'cp -a {remote_path} {BACKUP}/onboardingRoutes.js')
    changed = False
    try:
        command(f'cp {STAGE}/onboardingRoutes.js {remote_path}')
        changed = True
        command('systemctl restart lawyer-office')
        if not wait_for_health():
            raise RuntimeError('Post-deployment local health check failed')

        if command(f'sha256sum {remote_path}').split()[0] != EXPECTED:
            raise RuntimeError('Live onboarding route checksum mismatch')
        if not wait_for_health('https://muhami.ly/api/health'):
            raise RuntimeError('Public health check failed')
        print(json.dumps({
            'status': 'deployed', 'backup': BACKUP,
            'route_sha256': EXPECTED, 'service': command('systemctl is-active lawyer-office'),
            'local_health': 'ok', 'public_health': 'ok', 'verified_at_utc': STAMP
        }))
    except Exception:
        if changed:
            command('systemctl stop lawyer-office')
            command(f'cp -a {BACKUP}/onboardingRoutes.js {remote_path}')
            command('systemctl start lawyer-office')
            wait_for_health()
            print('Previous route restored after failed verification.', file=sys.stderr)
        raise
    finally:
        command(f'rm -rf {STAGE}')
except Exception as error:
    print(f'Deployment failed: {error}', file=sys.stderr)
    raise
finally:
    ssh.close()
