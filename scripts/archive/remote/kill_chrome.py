import os
import paramiko
ssh = paramiko.SSHClient()
ssh.load_system_host_keys()

ssh.set_missing_host_key_policy(paramiko.RejectPolicy())

ssh.connect("102.203.202.104", port=22, username=os.environ["DEPLOY_USER"], key_filename=os.environ["DEPLOY_SSH_KEY"], passphrase=os.environ.get("DEPLOY_SSH_KEY_PASSPHRASE"))
stdin, stdout, stderr = ssh.exec_command("killall -9 chrome chrome_crashpad_handler")
print(stdout.read().decode())
ssh.close()
