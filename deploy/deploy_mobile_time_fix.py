"""Scoped mobile layout/UTC display and twice-daily Libya reminder release."""
import importlib.util
import json
from pathlib import Path
import shlex
import sys
import tarfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('guarded_mobile', ROOT / 'deploy/deploy_review_release.py')
guarded = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guarded)
OUT = ROOT / 'artifacts/mobile-time-release'
BACKEND = ['server/services/reminderCron.js', 'server/services/notificationService.js']

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preflight'
    OUT.mkdir(parents=True, exist_ok=True)
    ssh = guarded.paramiko.SSHClient()
    ssh.load_host_keys(str(ROOT / 'deploy/.ssh-runtime/known_hosts'))
    ssh.set_missing_host_key_policy(guarded.paramiko.RejectPolicy())
    try:
        ssh.connect('102.203.202.104', port=22, username='root', password=guarded.credential(), timeout=25, look_for_keys=False, allow_agent=False)
        if mode == 'preflight':
            fingerprints = {}
            with ssh.open_sftp() as sftp:
                for name in BACKEND + ['client/dist/index.html']:
                    local = OUT / 'baseline' / name
                    local.parent.mkdir(parents=True, exist_ok=True)
                    sftp.get('/opt/lawyer_office/' + name, str(local))
                    fingerprints[name] = guarded.digest(local.read_bytes())
            health = json.loads(guarded.command(ssh, 'curl --fail --silent --max-time 20 https://muhami.ly/api/health'))
            assert health['status'] == 'ok'
            (OUT / 'baseline.json').write_text(json.dumps(fingerprints, indent=2), encoding='utf-8')
            print(json.dumps({'preflight': 'ok', 'files': len(fingerprints), 'health': 'ok'}))
            return
        assert mode == 'deploy', 'Use preflight or deploy'
        baseline = json.loads((OUT / 'baseline.json').read_text(encoding='utf-8'))
        stamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
        stage = '/tmp/lawyer-mobile-time-' + stamp
        sources = {name: ROOT / name for name in BACKEND}
        for file in (ROOT / 'client/dist').rglob('*'):
            if file.is_file():
                name = file.relative_to(ROOT).as_posix()
                assert not any(part.startswith('.') for part in file.relative_to(ROOT / 'client/dist').parts)
                sources[name] = file
        hashes = {name: guarded.digest(file.read_bytes()) for name, file in sources.items()}
        assert 'client/dist/index.html' in hashes
        archive = OUT / ('release-' + stamp + '.tar.gz')
        with tarfile.open(archive, 'w:gz') as bundle:
            for name, file in sources.items(): bundle.add(file, arcname=name)
        guarded.command(ssh, 'mkdir -p ' + shlex.quote(stage))
        with ssh.open_sftp() as sftp: sftp.put(str(archive), stage + '/release.tar.gz')
        guarded.command(ssh, 'tar -xzf ' + shlex.quote(stage + '/release.tar.gz') + ' -C ' + shlex.quote(stage))
        # Keep existing runtime: this release introduces no server dependency.
        remote = guarded.REMOTE.replace("if not config.get('pricing'):", "if not config.get('no_dependency_change'):")
        remote = remote.replace("if config.get('pricing') else runtime", "if config.get('no_dependency_change') else runtime")
        remote = remote.replace("else 'review-'", "else 'mobile-time-'")
        payload = dict(stage=stage, stamp=stamp, backend=BACKEND, hashes=hashes, baseline=baseline, no_dependency_change=True, pricing=False, architecture=False)
        result = json.loads(guarded.command(ssh, 'python3 -u -c ' + shlex.quote(remote), json.dumps(payload) + '\n', timeout=240).splitlines()[-1])
        (OUT / 'DEPLOYMENT-RESULT.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(json.dumps(result))
    finally:
        ssh.close()

if __name__ == '__main__': main()
