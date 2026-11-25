import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  ImageUp,
  Keyboard,
  QrCode,
  X,
} from 'lucide-react';
import { TranslationBundle } from '../i18n/translations';
import { QueueToken } from '../types/qlite';

interface QrCheckInScannerModalProps {
  locationName: string;
  counterName: string;
  t: TranslationBundle;
  onCheckIn: (rawQrOrCode: string) => Promise<{ token: QueueToken; alreadyInProgress: boolean }>;
  onClose: () => void;
}

export function QrCheckInScannerModal({
  locationName,
  counterName,
  t,
  onCheckIn,
  onClose,
}: QrCheckInScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const lastScannedRef = useRef<string>('');

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [checkedInResult, setCheckedInResult] = useState<{
    token: QueueToken;
    alreadyInProgress: boolean;
  } | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const processPayload = useCallback(
    async (raw: string) => {
      if (processingRef.current || !raw.trim()) return;
      processingRef.current = true;
      setBusy(true);
      setScanError(null);
      setCheckedInResult(null);
      try {
        const res = await onCheckIn(raw.trim());
        setCheckedInResult(res);
        setManualInput('');
        stopCamera();
      } catch (err) {
        setScanError(err instanceof Error ? err.message : 'Unable to check in token.');
      } finally {
        setBusy(false);
        processingRef.current = false;
      }
    },
    [onCheckIn, stopCamera]
  );

  const scanFrameLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code && code.data && code.data !== lastScannedRef.current) {
          lastScannedRef.current = code.data;
          void processPayload(code.data);
          return;
        }
      }
    }

    rafRef.current = requestAnimationFrame(scanFrameLoop);
  }, [processPayload]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScanError(null);
    lastScannedRef.current = '';

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera API is unavailable on this browser. Upload a QR image or enter the token code below.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      rafRef.current = requestAnimationFrame(scanFrameLoop);
    } catch (err) {
      stopCamera();
      const msg = err instanceof Error ? err.message : '';
      setCameraError(
        msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('permission')
          ? 'Camera permission denied. Allow camera access or upload a QR screenshot / enter the token code below.'
          : 'No camera detected. You can upload a QR image or type the visitor token code below.'
      );
    }
  }, [scanFrameLoop, stopCamera]);

  // Start camera automatically when modal opens; always clean up tracks on unmount
  useEffect(() => {
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setScanError(null);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setScanError('Unable to read image.');
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);
        if (!decoded?.data) {
          setScanError('No QR code detected in the selected image.');
          return;
        }
        void processPayload(decoded.data);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setScanError('Unable to load image file.');
    };
    img.src = url;
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    lastScannedRef.current = '';
    void processPayload(manualInput);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scanner-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h2 id="qr-scanner-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-blue-700" />
              <span>{t.staff.qrModalTitle}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {locationName} · {counterName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="Close QR scanner"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <p className="text-xs text-slate-600">{t.staff.qrModalSubtitle}</p>

          {/* Checked-in Confirmation Banner */}
          {checkedInResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-emerald-950">
                    {checkedInResult.alreadyInProgress
                      ? `${checkedInResult.token.tokenCode} Already Checked In`
                      : `${checkedInResult.token.tokenCode} Checked In — In Progress`}
                  </p>
                  <p className="text-xs text-emerald-800">
                    {checkedInResult.token.holderLabel} · {checkedInResult.token.serviceName} · Counter:{' '}
                    <span className="font-semibold">{checkedInResult.token.counterName || counterName}</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCheckedInResult(null);
                    lastScannedRef.current = '';
                    void startCamera();
                  }}
                  className="px-3.5 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800"
                >
                  Scan Next Visitor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-lg bg-white border border-emerald-200 text-emerald-900 text-xs font-semibold hover:bg-emerald-100"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {scanError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{scanError}</span>
            </div>
          )}

          {/* Camera Preview Viewport */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-200">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {cameraActive ? (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 rounded-2xl border-2 border-blue-400/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.42)]" />
              </div>
            ) : (
              <div className="p-6 text-center space-y-2 max-w-xs">
                <CameraOff className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  {cameraError || 'Camera preview is paused.'}
                </p>
              </div>
            )}
          </div>

          {/* Camera & Image Upload Controls */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => (cameraActive ? stopCamera() : void startCamera())}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
            >
              {cameraActive ? (
                <>
                  <CameraOff className="w-4 h-4 text-slate-600" />
                  <span>Stop Camera</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 text-blue-700" />
                  <span>Start Camera</span>
                </>
              )}
            </button>

            <label className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 inline-flex items-center justify-center gap-1.5 cursor-pointer">
              <ImageUp className="w-4 h-4 text-blue-700" />
              <span>Scan QR Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="sr-only"
              />
            </label>
          </div>

          {/* Manual / Handheld Scanner Fallback */}
          <form onSubmit={handleManualSubmit} className="pt-2 border-t border-slate-100 space-y-2">
            <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-slate-500" />
              <span>Or Enter Token Code / QR Payload</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="e.g. T-001 or pasted QR data"
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-mono"
              />
              <button
                type="submit"
                disabled={busy || !manualInput.trim()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 whitespace-nowrap"
              >
                {busy ? 'Checking In...' : 'Check In'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
