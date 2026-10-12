import re

with open('client/src/components/Cases/CaseDetails.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("apiFetch(/cases//status", "apiFetch(`/cases/${caseId}/status`")
content = content.replace("apiFetch(/cases//notes", "apiFetch(`/cases/${caseId}/notes`")

with open('client/src/components/Cases/CaseDetails.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

