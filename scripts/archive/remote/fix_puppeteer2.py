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
    "cd /opt/lawyer_office/server && sudo -u lawyer npx puppeteer browsers install chrome",
    "systemctl restart lawyer-office"
]

for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    with open('cmd_logs.txt', 'ab') as f:
        f.write(stdout.read())
        f.write(stderr.read())

ssh.close()
