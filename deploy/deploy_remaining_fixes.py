"""Backend-only reviewed assistant/push release; private backup staging support."""
import importlib.util
import json
from pathlib import Path
import shlex
import re
import sys
import tarfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('remaining_guard', ROOT / 'deploy/deploy_review_release.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
OUT = ROOT / 'artifacts/remaining-release'
ASSISTANT = ['server/services/mustasharService.js', 'server/services/pushService.js', 'server/domain/subscriptions/accessPolicy.js']
BACKUPS = ['server/database/db.js', 'server/services/backupService.js', 'server/routes/backupRoutes.js', 'server/package.json', 'server/package-lock.json']

def connect():
    ssh = guard.paramiko.SSHClient()
    ssh.load_host_keys(str(ROOT / 'deploy/.ssh-runtime/known_hosts'))
    ssh.set_missing_host_key_policy(guard.paramiko.RejectPolicy())
    ssh.connect('102.203.202.104', port=22, username='root', password=guard.credential(), timeout=25, look_for_keys=False, allow_agent=False)
    return ssh

def main():
    kind, mode = sys.argv[1:3]
    assert kind in ('assistant', 'backups') and mode in ('preflight', 'deploy')
    output = OUT / kind
    output.mkdir(parents=True, exist_ok=True)
    backend = ASSISTANT if kind == 'assistant' else BACKUPS
    ssh = connect()
    try:
        if mode == 'preflight':
            baseline = {}
            with ssh.open_sftp() as sftp:
                for name in list(dict.fromkeys(backend + ['server/database/schema.sql', 'server/package.json', 'server/package-lock.json'])):
                    file = output / 'baseline' / name
                    file.parent.mkdir(parents=True, exist_ok=True)
                    try:
                        sftp.get('/opt/lawyer_office/' + name, str(file))
                        baseline[name] = guard.digest(file.read_bytes())
                    except FileNotFoundError:
                        baseline[name] = None
                # Resolve each relative import against either an approved source
                # in this package or an existing production module before restart.
                for name in backend:
                    if not name.endswith('.js'): continue
                    text = (ROOT / name).read_text(encoding='utf-8')
                    for imported in re.findall(r"(?:from\s*|import\s*)['\"]([^'\"]+)['\"]", text):
                        if not imported.startswith('.'): continue
                        resolved = (ROOT / name).parent.joinpath(imported).resolve()
                        relative = resolved.relative_to(ROOT).as_posix()
                        if relative not in backend:
                            try: sftp.stat('/opt/lawyer_office/' + relative)
                            except FileNotFoundError: raise RuntimeError('Missing imported module: ' + relative)
            assert json.loads(guard.command(ssh, 'curl --fail --silent --max-time 20 https://muhami.ly/api/health'))['status'] == 'ok'
            (output / 'baseline.json').write_text(json.dumps(baseline, indent=2), encoding='utf-8')
            print(json.dumps({'kind': kind, 'preflight': 'ok', 'baseline_files': len(baseline)}))
            return
        baseline = json.loads((output / 'baseline.json').read_text(encoding='utf-8'))
        stamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
        stage = '/tmp/lawyer-' + kind + '-fixes-' + stamp
        sources = {name: ROOT / name for name in backend}
        hashes = {name: guard.digest(file.read_bytes()) for name, file in sources.items()}
        archive = output / ('release-' + stamp + '.tar.gz')
        with tarfile.open(archive, 'w:gz') as bundle:
            for name, file in sources.items(): bundle.add(file, arcname=name)
        guard.command(ssh, 'mkdir -p ' + shlex.quote(stage))
        with ssh.open_sftp() as sftp: sftp.put(str(archive), stage + '/release.tar.gz')
        guard.command(ssh, 'tar -xzf ' + shlex.quote(stage + '/release.tar.gz') + ' -C ' + shlex.quote(stage))
        remote = guard.REMOTE.replace("if not config.get('pricing'):", "if not config.get('no_dependency_change'):")
        remote = remote.replace("if config.get('pricing') else runtime", "if config.get('no_dependency_change') else runtime")
        remote = remote.replace("else 'review-'", "else '" + kind + "-fixes-'")
        # Use strict dependency resolution for the reviewed, Babel/Jest-aligned lock.
        remote = remote.replace(", '--legacy-peer-deps'", '').replace(",'--legacy-peer-deps'", '')
        payload = dict(stage=stage, stamp=stamp, backend=backend, hashes=hashes, baseline=baseline, no_dependency_change=kind == 'assistant', pricing=False, architecture=False)
        result = json.loads(guard.command(ssh, 'python3 -u -c ' + shlex.quote(remote), json.dumps(payload) + '\n', timeout=900).splitlines()[-1])
        (output / 'DEPLOYMENT-RESULT.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(json.dumps(result))
    finally:
        ssh.close()

if __name__ == '__main__': main()
