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
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
mkdir -p /etc/needrestart/conf.d
echo '$nrconf{restart} = "a";' > /etc/needrestart/conf.d/50local.conf 2>/dev/null || true
apt-get update -y
apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" curl git ufw fail2ban nginx sqlite3 unzip

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
ufw --force enable

# --- 5) fail2ban ضد محاولات الاختراق ---
echo "[5/9] تفعيل fail2ban..."
systemctl enable --now fail2ban

# --- 6) استخراج التطبيق ---
echo "[6/9] تجهيز مجلد التطبيق..."
mkdir -p "$APP_DIR"
if [ -f /tmp/lawyer_office.zip ]; then
  unzip -o /tmp/lawyer_office.zip -d "$APP_DIR" || [ $? -le 1 ]
fi
mkdir -p "$APP_DIR/server/database" "$APP_DIR/server/uploads" "$APP_DIR/server/backups"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
chmod -R u+rwX "$APP_DIR"
cd "$APP_DIR/server"

# --- 7) اعتماديات الخادم ---
echo "[7/9] تثبيت اعتماديات الخادم..."
sudo -u "$APP_USER" npm install --omit=dev --legacy-peer-deps

# (الواجهة تُبنى محلياً وتُرفع جاهزة في مجلد client/dist)

# --- 8) متغيرات البيئة ---
echo "[8/9] إعداد ملف البيئة..."
if [ ! -f .env ]; then
  JWT_SECRET=$(openssl rand -hex 48)
  JWT_REFRESH_SECRET=$(openssl rand -hex 48)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  COOKIE_SECRET=$(openssl rand -hex 32)
  if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    ORIGIN_URL="http://$DOMAIN"
  else
    ORIGIN_URL="https://$DOMAIN"
  fi
  cat > .env <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
ALLOWED_ORIGIN=$ORIGIN_URL
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
COOKIE_SECRET=$COOKIE_SECRET
EOF
  chown "$APP_USER":"$APP_USER" .env
  chmod 600 .env
  echo "  → تم توليد مفاتيح سرية جديدة قوية (احفظ نسخة منها في مكان آمن)"
fi

# --- 9) خدمة systemd ---
echo "[9/9] تثبيت خدمة systemd..."
cp "/tmp/lawyer-office.service" /etc/systemd/system/lawyer-office.service
systemctl daemon-reload
systemctl enable --now lawyer-office
sleep 3
systemctl --no-pager status lawyer-office | head -12

# --- 10) Nginx ---
echo "إعداد Nginx..."
sed "s/office.example.com/$DOMAIN/g" "/tmp/nginx-lawyer-office.conf" \
  > /etc/nginx/sites-available/lawyer-office
ln -sf /etc/nginx/sites-available/lawyer-office /etc/nginx/sites-enabled/lawyer-office
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "===================================================="
if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "✅ تم إعداد وتشغيل المنظومة بنجاح عبر الـ IP مباشرة!"
  echo "🔗 يمكنك فتح المنظومة وتجربتها الآن عبر المتصفح:"
  echo "   http://$DOMAIN"
  echo ""
  echo "📌 عند حجز دومين لاحقاً، نفذ الأمر التالي لتفعيل HTTPS:"
  echo "   certbot --nginx -d your-domain.com"
else
  echo "إصدار شهادة أمان SSL للدومين $DOMAIN..."
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" || true
  echo "✅ تم إعداد وتشغيل المنظومة بنجاح!"
  echo "🔗 الرابط الآمن: https://$DOMAIN"
fi
echo "===================================================="
