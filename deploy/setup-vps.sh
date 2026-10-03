#!/usr/bin/env bash
# =============================================================================
# سكربت إعداد خادم Ubuntu VPS لمنظومة مكتب المحاماة
# يُشغَّل على الخادم (كـ root أو عبر sudo): sudo bash setup-vps.sh
# =============================================================================
set -euo pipefail

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "الاستخدام: sudo bash setup-vps.sh <دومينك> مثال: sudo bash setup-vps.sh office.myfirm.com"
  exit 1
fi

APP_DIR="/opt/lawyer_office"
APP_USER="lawyer"

echo "===================================================="
echo " خادم منظومة مكتب المحاماة — إعداد VPS (دومين: $DOMAIN)"
echo "===================================================="

# --- 1) تحديث النظام والحزم الأساسية ---
echo "[1/9] تحديث النظام..."
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git ufw fail2ban nginx sqlite3 unzip

# --- 2) Node.js 22 LTS ---
if ! command -v node > /dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  echo "[2/9] تثبيت Node.js 22 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# --- 3) مستخدم خدمة بصلاحيات محدودة ---
echo "[3/9] إنشاء مستخدم الخدمة ($APP_USER)..."
id -u "$APP_USER" > /dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"

# --- 4) جدار الحماية ---
echo "[4/9] إعداد جدار الحماية UFW (22/80/443 فقط)..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
yes | ufw enable

# --- 5) fail2ban ضد محاولات الاختراق ---
echo "[5/9] تفعيل fail2ban..."
systemctl enable --now fail2ban

# --- 6) استخراج التطبيق ---
echo "[6/9] تجهيز مجلد التطبيق..."
mkdir -p "$APP_DIR"
if [ -f /tmp/lawyer_office.zip ]; then
  unzip -o /tmp/lawyer_office.zip -d "$APP_DIR"
  chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
fi
cd "$APP_DIR/server"

# --- 7) اعتماديات الخادم وبناء الواجهة ---
echo "[7/9] تثبيت اعتماديات الخادم..."
sudo -u "$APP_USER" npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# (الواجهة تُبنى محلياً وتُرفع جاهزة في مجلد client/dist)

# --- 8) متغيرات البيئة ---
echo "[8/9] إعداد ملف البيئة..."
if [ ! -f .env ]; then
  JWT_SECRET=$(openssl rand -hex 48)
  JWT_REFRESH_SECRET=$(openssl rand -hex 48)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  cat > .env <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
EOF
  chown "$APP_USER":"$APP_USER" .env
  chmod 600 .env
  echo "  → تم توليد مفاتيح سرية جديدة قوية (احفظ نسخة منها في مكان آمن)"
fi

# --- 9) خدمة systemd ---
echo "[9/9] تثبيت خدمة systemd..."
sed "s/APP_USER_PLACEHOLDER/$APP_USER/" "$(dirname "$0")/lawyer-office.service" > /etc/systemd/system/lawyer-office.service 2>/dev/null \
  || cp "$(dirname "$0")/lawyer-office.service" /etc/systemd/system/lawyer-office.service
systemctl daemon-reload
systemctl enable --now lawyer-office
sleep 3
systemctl --no-pager status lawyer-office | head -12

# --- 10) Nginx + SSL ---
echo "إعداد Nginx..."
sed "s/office.example.com/$DOMAIN/g" "$(dirname "$0")/nginx-lawyer-office.conf" \
  > /etc/nginx/sites-available/lawyer-office
ln -sf /etc/nginx/sites-available/lawyer-office /etc/nginx/sites-enabled/lawyer-office
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "===================================================="
echo " الخطوة الأخيرة — إصدار شهادة SSL:"
echo "   apt-get install -y certbot python3-certbot-nginx"
echo "   certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN"
echo ""
echo " ثم: curl -k https://$DOMAIN/api/health  ← يجب أن يرجع JSON"
echo "===================================================="
