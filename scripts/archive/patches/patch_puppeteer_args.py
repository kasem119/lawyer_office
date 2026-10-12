import re

with open('server/services/exportService.js', 'r', encoding='utf-8') as f:
    content = f.read()

args_str = """args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-web-security',
      '--disable-dev-shm-usage',
      '--disable-crash-reporter',
      '--no-zygote',
      '--single-process'
    ]"""

content = re.sub(
    r"args:\s*\[[^\]]+\]",
    args_str,
    content
)

content = content.replace("headless: 'new'", "headless: true")

with open('server/services/exportService.js', 'w', encoding='utf-8') as f:
    f.write(content)

