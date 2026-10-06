import React, { useState, useRef, useCallback } from 'react';
import { Camera, Trash2, FileText, Loader2, RotateCw } from 'lucide-react';
import Button from '../Shared/Button';
import { apiFetch } from '../../api/client';
import { PDFDocument } from 'pdf-lib';

/**
 * تصوير مستندات ورقية بكاميرا الهاتف ودمجها في ملف PDF واحد يُرفع على القضية.
 * يعتمد على input capture="environment" — بضغطة واحدة تفتح كاميرا الهاتف مباشرة.
 * يعمل على: كاميرا الهاتف (أندرويد/آيفون)، الماسح الضوئي كملف عادي من الكمبيوتر،
 * وأي بيئة فيها getUserMedia (عبر وضع المعاينة الحي).
 */
export default function CameraDocumentUpload({ caseId, onUploaded }) {
  const [shots, setShots] = useState([]); // { url, dataUrl, rotation }
  const [docName, setDocName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [liveMode, setLiveMode] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  React.useEffect(() => stopStream, [stopStream]);

  const startLiveCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
        audio: false
      });
      streamRef.current = stream;
      setLiveMode(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setError('تعذر فتح الكاميرا المباشرة. استخدم زر التصوير العادي أو أضف صوراً من المعرض.');
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setShots((prev) => [...prev, { dataUrl, rotation: 0 }]);
  };

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: next } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      setError('تعذر تبديل الكاميرا.');
    }
  };

  // التقاط عبر input capture (يفتح كاميرا النظام مباشرة على الهاتف)
  const handleCaptureInput = (e) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    e.target.value = '';
  };

  const addFiles = (files) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) {
      setError('يرجى اختيار صور فقط (JPG/PNG).');
      return;
    }
    setError('');
    images.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setShots((prev) => [...prev, { dataUrl: reader.result, rotation: 0 }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeShot = (idx) => setShots((prev) => prev.filter((_, i) => i !== idx));
  const rotateShot = (idx) =>
    setShots((prev) => prev.map((s, i) => (i === idx ? { ...s, rotation: (s.rotation + 90) % 360 } : s)));

  const loadImageElement = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const applyRotation = (img, rotation) => {
    const { width, height } = img;
    const canvas = document.createElement('canvas');
    if (rotation === 90 || rotation === 270) {
      canvas.width = height;
      canvas.height = width;
    } else {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -width / 2, -height / 2);
    return canvas;
  };

  // تحسين لطيف للقراءة: رفع التباين قليلاً مع الحفاظ على ألوان الأختام الرسمية
  const enhanceForReading = (canvasEl) => {
    try {
      const ctx = canvasEl.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
      const d = imageData.data;
      // منحنى تباين خفيف: يفتّح الخلفية ويغمّق النص دون فقدان الألوان
      const contrast = 1.18;
      const brightness = -14;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, Math.max(0, d[i] * contrast + brightness));
        d[i + 1] = Math.min(255, Math.max(0, d[i + 1] * contrast + brightness));
        d[i + 2] = Math.min(255, Math.max(0, d[i + 2] * contrast + brightness));
      }
      ctx.putImageData(imageData, 0, 0);
    } catch {
      // تجاهل أي خطأ في التحسين — الصورة الأصلية تبقى صالحة
    }
  };

  const buildPdf = async () => {
    const pdfDoc = await PDFDocument.create();
    for (const shot of shots) {
      const img = await loadImageElement(shot.dataUrl);
      const rotated = applyRotation(img, shot.rotation);
      enhanceForReading(rotated);
      const jpegDataUrl = rotated.toDataURL('image/jpeg', 0.85);
      const embedded = await pdfDoc.embedJpg(jpegDataUrl);
      // صفحة بمقاس الصورة نفسه
      const page = pdfDoc.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
    }
    return pdfDoc.save();
  };

  const handleSubmit = async () => {
    if (!caseId) {
      setError('يرجى اختيار القضية المرتبطة بالمستند أولاً.');
      return;
    }
    if (shots.length === 0) {
      setError('التقط صورة واحدة على الأقل.');
      return;
    }
    setError('');

    try {
      setUploading(true);
      let pdfBytes = null;
      if (shots.length > 0) {
        setProcessing(true);
        pdfBytes = await buildPdf();
        setProcessing(false);
      }

      const safeName = (docName.trim() || `مستند مصور ${new Date().toLocaleDateString('ar')}`).replace(/[\\/:*?"<>|]/g, '-');
      const formData = new FormData();
      formData.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), `${safeName}.pdf`);
      formData.append('case_id', caseId);

      const res = await apiFetch('/documents/upload', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'فشل رفع المستند');

      setShots([]);
      setDocName('');
      if (onUploaded) onUploaded();
    } catch (err) {
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {error && (
        <div style={{ background: 'rgba(244,63,94,0.2)', color: 'var(--error)', padding: '10px', borderRadius: '6px', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {!liveMode ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {/* التصوير المباشر بالنظام — يفتح كاميرا الهاتف مباشرة */}
          <label
            htmlFor="camera-capture-input"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--primary)',
              color: '#0b1120',
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '0.92rem'
            }}
          >
            <Camera size={18} />
            📷 تصوير مستند
          </label>
          <input
            id="camera-capture-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCaptureInput}
            style={{ display: 'none' }}
          />

          {/* إضافة صور من المعرض / الماسح الضوئي */}
          <label
            htmlFor="gallery-add-input"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-item)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.92rem'
            }}
          >
            <FileText size={18} color="var(--primary)" />
            إضافة صور من المعرض
          </label>
          <input
            id="gallery-add-input"
            type="file"
            accept="image/*"
            multiple
            onChange={handleCaptureInput}
            style={{ display: 'none' }}
          />

          {/* كاميرا حية داخل التطبيق (اختياري) */}
          <button
            type="button"
            onClick={startLiveCamera}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: '1px dashed var(--border-color)',
              color: 'var(--text-muted)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            كاميرا حية داخل الشاشة
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: '100%', maxHeight: '45vh', borderRadius: 'var(--radius-md)', background: '#000', objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Button type="button" onClick={captureFrame}>📸 التقاط</Button>
            <Button type="button" variant="secondary" onClick={flipCamera}>🔄 تبديل الكاميرا</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                stopStream();
                setLiveMode(false);
              }}
            >
              إنهاء الكاميرا
            </Button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* معرض اللقطات */}
      {shots.length > 0 && (
        <>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {shots.length} صفحة — يتم دمجها في ملف PDF واحد بالترتيب الظاهر
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {shots.map((shot, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  width: '96px',
                  height: '120px',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)'
                }}
              >
                <img
                  src={shot.dataUrl}
                  alt={`صفحة ${idx + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: `rotate(${shot.rotation}deg)`
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    background: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    fontSize: '0.7rem',
                    padding: '1px 6px',
                    borderRadius: '4px'
                  }}
                >
                  {idx + 1}
                </div>
                <button
                  type="button"
                  title="تدوير"
                  onClick={() => rotateShot(idx)}
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    background: 'rgba(0,0,0,0.65)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '4px',
                    padding: '3px',
                    cursor: 'pointer',
                    display: 'flex'
                  }}
                >
                  <RotateCw size={13} />
                </button>
                <button
                  type="button"
                  title="حذف"
                  onClick={() => removeShot(idx)}
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    left: 4,
                    background: 'rgba(220,38,38,0.85)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '4px',
                    padding: '3px',
                    cursor: 'pointer',
                    display: 'flex'
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
          اسم المستند (اختياري)
        </label>
        <input
          type="text"
          className="form-input"
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
          placeholder="مثال: عقد البيع الأصلي — صفحة 1-3"
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
        {(processing || uploading) && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <Loader2 size={14} className="animate-spin" />
            {processing ? 'جاري إنشاء PDF...' : 'جاري الرفع...'}
          </span>
        )}
        <Button onClick={handleSubmit} disabled={shots.length === 0 || processing || uploading}>
          {uploading ? 'جاري الرفع...' : 'رفع كمستند PDF'}
        </Button>
      </div>
    </div>
  );
}
