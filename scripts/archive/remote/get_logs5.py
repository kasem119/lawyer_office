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

stdin, stdout, stderr = ssh.exec_command("journalctl -u lawyer-office -n 50 --no-pager")
with open('vps_logs_pdf_latest.txt', 'wb') as f:
    f.write(stdout.read())
ssh.close()
