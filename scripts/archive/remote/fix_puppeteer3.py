import os
import paramiko

HOST = "102.203.202.104"
PORT = 22
USER = os.environ["DEPLOY_USER"]
KEY_FILE = os.environ["DEPLOY_SSH_KEY"]
ssh = paramiko.SSHClient()
ssh.load_system_host_keys()

ssh.set_missing_host_key_policy(paramiko.RejectPolicy())

ssh.connect(HOST, port=PORT, username=USER, key_filename=KEY_FILE, passphrase=os.environ.get("DEPLOY_SSH_KEY_PASSPHRASE"))

commands = [
    "mkdir -p /opt/lawyer_office/server/.cache",
    "chown -R lawyer:lawyer /opt/lawyer_office/server/.cache",
    "cd /opt/lawyer_office/server && sudo -u lawyer PUPPETEER_CACHE_DIR=/opt/lawyer_office/server/.cache npx puppeteer browsers install chrome",
    "sed -i '/Environment=PORT=3000/a Environment=PUPPETEER_CACHE_DIR=/opt/lawyer_office/server/.cache' /etc/systemd/system/lawyer-office.service",
    "systemctl daemon-reload",
    "systemctl restart lawyer-office"
]

for cmd in commands:
    print(f"Running: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()

ssh.close()
