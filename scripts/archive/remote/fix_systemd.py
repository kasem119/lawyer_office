import os
import paramiko
ssh = paramiko.SSHClient()
ssh.load_system_host_keys()

ssh.set_missing_host_key_policy(paramiko.RejectPolicy())

ssh.connect("102.203.202.104", port=22, username=os.environ["DEPLOY_USER"], key_filename=os.environ["DEPLOY_SSH_KEY"], passphrase=os.environ.get("DEPLOY_SSH_KEY_PASSPHRASE"))

commands = [
    "sed -i '/PrivateTmp=true/d' /etc/systemd/system/lawyer-office.service",
    "sed -i '/ProtectSystem=strict/d' /etc/systemd/system/lawyer-office.service",
    "sed -i '/NoNewPrivileges=true/d' /etc/systemd/system/lawyer-office.service",
    "systemctl daemon-reload",
    "systemctl restart lawyer-office"
]

for cmd in commands:
    print(f"Running: {cmd}")
    ssh.exec_command(cmd)[1].channel.recv_exit_status()

ssh.close()
