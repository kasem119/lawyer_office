import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svc = new Service({
  name: 'LawyerOfficeServer',
  description: 'خدمة خادم منظومة مكتب المحاماة - Lawyer Office Management Server',
  script: path.join(__dirname, 'index.js'),
  workingDirectory: __dirname,
  wait: 2,
  grow: 0.25,
  maxRestarts: 10,
  abortOnError: false,
  env: [
    {
      name: 'NODE_ENV',
      value: 'production'
    },
    {
      name: 'HOST',
      value: '0.0.0.0'
    },
    {
      name: 'PORT',
      value: '3000'
    }
  ],
  nodeOptions: [
    '--harmony'
  ]
});

const action = process.argv[2] || 'status';

if (action === 'install') {
  svc.on('install', () => {
    svc.start();
    console.log('====================================================');
    console.log('✅ تم تثبيت خدمة خادم مكتب المحاماة بنجاح!');
    console.log('🚀 تم تشغيل الخدمة في خلفية ويندوز تلقائياً.');
    console.log('🌐 الخادم يستمع الآن على المنفذ 3000 لجميع أجهزة المكتب.');
    console.log('====================================================');
  });

  svc.on('alreadyinstalled', () => {
    console.log('⚠️ خدمة خادم مكتب المحاماة مثبتة بالفعل في ويندوز.');
    console.log('جاري بدء تشغيل الخدمة...');
    svc.start();
  });

  svc.on('invalidinstallation', () => {
    console.error('❌ تعذر تثبيت الخدمة. تأكد من تشغيل موجه الأوامر بصلاحيات المسؤول (Run as Administrator).');
  });

  svc.on('error', (err) => {
    console.error('❌ حدث خطأ أثناء إعداد الخدمة:', err);
  });

  svc.install();
} else if (action === 'uninstall') {
  svc.on('uninstall', () => {
    console.log('====================================================');
    console.log('✅ تم إلغاء تثبيت خدمة خادم مكتب المحاماة وإيقافها بنجاح.');
    console.log('====================================================');
  });

  svc.on('error', (err) => {
    console.error('❌ حدث خطأ أثناء إزالة الخدمة:', err);
  });

  svc.uninstall();
} else if (action === 'start') {
  svc.on('start', () => {
    console.log('🟢 تم بدء تشغيل خدمة خادم مكتب المحاماة.');
  });
  svc.start();
} else if (action === 'stop') {
  svc.on('stop', () => {
    console.log('🔴 تم إيقاف خدمة خادم مكتب المحاماة.');
  });
  svc.stop();
} else if (action === 'restart') {
  svc.on('stop', () => {
    svc.start();
    console.log('🔄 تمت إعادة تشغيل خدمة خادم مكتب المحاماة.');
  });
  svc.stop();
} else {
  console.log('⚖️ إدارة خدمة خادم مكتب المحاماة (Windows Service):');
  console.log('  node windowsService.js install    - تثبيت الخدمة وتشغيلها تلقائياً مع ويندوز');
  console.log('  node windowsService.js uninstall  - إلغاء تثبيت الخدمة');
  console.log('  node windowsService.js start      - بدء تشغيل الخدمة');
  console.log('  node windowsService.js stop       - إيقاف الخدمة');
  console.log('  node windowsService.js restart    - إعادة تشغيل الخدمة');
}
