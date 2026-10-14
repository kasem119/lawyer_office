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

check_script = """
import { generatePDF } from './services/exportService.js';
(async () => {
  try {
    const buf = await generatePDF('<h1>Test</h1>');
    console.log('SUCCESS, PDF size:', buf.length);
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
"""

commands = [
    f"cat << 'EOF' > /opt/lawyer_office/server/test_pdf.mjs\n{check_script}\nEOF",
    "cd /opt/lawyer_office/server && sudo -u lawyer PUPPETEER_CACHE_DIR=/opt/lawyer_office/server/.cache node test_pdf.mjs"
]

for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    print("Stdout:", stdout.read().decode('utf-8'))
    print("Stderr:", stderr.read().decode('utf-8'))

ssh.close()
