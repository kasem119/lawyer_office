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
    "apt-get update",
    "apt-get install -y wget gnupg ca-certificates libgconf-2-4 libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 libnss3",
    "cd /opt/lawyer_office/server && sudo -u lawyer npx puppeteer browsers install chrome",
    "systemctl restart lawyer-office"
]

for cmd in commands:
    print(f"Running: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    print("Stdout:", stdout.read().decode('utf-8'))
    print("Stderr:", stderr.read().decode('utf-8'))

ssh.close()
