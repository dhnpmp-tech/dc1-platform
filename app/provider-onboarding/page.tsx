'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const GPU_OPTIONS = [
  'RTX 4090',
  'RTX 4080',
  'RTX 4070 Ti',
  'RTX 4060 Ti',
  'RTX 3090',
  'RTX 3080',
  'RTX 3070',
  'RTX 3060',
  'A100',
  'Other',
];

function detectOS(): 'windows' | 'mac' | 'linux' {
  if (typeof navigator === 'undefined') return 'windows';
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'windows';
  if (ua.includes('Mac')) return 'mac';
  return 'linux';
}

function detectOSString(): string {
  if (typeof navigator === 'undefined') return 'Windows';
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'Mac';
  return 'Linux';
}

export default function ProviderOnboarding() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gpuModel, setGpuModel] = useState('');
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);
  const [hwCheckDone, setHwCheckDone] = useState(false);
  const [hwCheckResult, setHwCheckResult] = useState<{ passed: boolean; gpu: string; error?: string } | null>(null);
  const [runMode, setRunMode] = useState<'always-on' | 'manual' | 'scheduled'>('always-on');
  const [schedStart, setSchedStart] = useState('23:00');
  const [schedEnd, setSchedEnd] = useState('07:00');
  const [apiKey, setApiKey] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [connectionTimeout, setConnectionTimeout] = useState(false);
  const [detectedOS, setDetectedOS] = useState<'windows' | 'mac' | 'linux'>('windows');
  const pollStartRef = useRef<number | null>(null);

  // Detect OS on mount
  useEffect(() => {
    setDetectedOS(detectOS());
  }, []);

  // Step 2: real GPU detection via WebGPU API (falls back to basic check)
  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;

    async function detectGPU() {
      try {
        // Try WebGPU first (Chrome 113+, Edge 113+)
        if ('gpu' in navigator) {
          const gpu = (navigator as any).gpu;
          const adapter = await gpu.requestAdapter();
          if (adapter) {
            const info = await adapter.requestAdapterInfo?.() || {};
            const name = info.device || info.description || 'GPU detected via WebGPU';
            if (!cancelled) {
              setHwCheckResult({ passed: true, gpu: name });
              setHwCheckDone(true);
            }
            return;
          }
        }
        // Try WebGL fallback
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          const renderer = debugInfo
            ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
            : gl.getParameter(gl.RENDERER);
          const isNvidia = /nvidia|geforce|rtx|gtx|quadro|tesla/i.test(renderer);
          const isAmd = /amd|radeon/i.test(renderer);
          const isDedicated = isNvidia || isAmd || /a100|h100|v100/i.test(renderer);

          if (!cancelled) {
            if (isDedicated) {
              setHwCheckResult({ passed: true, gpu: renderer });
            } else {
              // Could be integrated GPU or software renderer
              setHwCheckResult({
                passed: false,
                gpu: renderer,
                error: `Detected "${renderer}" — DC1 requires a dedicated NVIDIA GPU with 8GB+ VRAM. If you have one, your browser may not be reporting it correctly. You can still proceed and the daemon will verify on install.`,
              });
            }
            setHwCheckDone(true);
          }
          return;
        }
        // No GPU API available
        if (!cancelled) {
          setHwCheckResult({
            passed: false,
            gpu: 'Unknown',
            error: 'Could not detect your GPU from the browser. This is normal — the daemon will verify your hardware during installation.',
          });
          setHwCheckDone(true);
        }
      } catch {
        if (!cancelled) {
          setHwCheckResult({
            passed: false,
            gpu: 'Unknown',
            error: 'GPU detection failed. The daemon will verify your hardware during installation.',
          });
          setHwCheckDone(true);
        }
      }
    }

    detectGPU();
    return () => { cancelled = true; };
  }, [step]);

  // Step 4: poll for connection with 5-minute timeout
  useEffect(() => {
    if (step !== 4 || !apiKey) return;
    pollStartRef.current = Date.now();
    setConnectionTimeout(false);

    const interval = setInterval(async () => {
      // Check for 5-minute timeout
      if (pollStartRef.current && Date.now() - pollStartRef.current > 5 * 60 * 1000) {
        setConnectionTimeout(true);
        clearInterval(interval);
        return;
      }
      try {
        const res = await fetch(`/api/providers/status/${apiKey}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'online' || data.status === 'connected') {
            setConnected(true);
            clearInterval(interval);
          }
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, apiKey]);

  const canContinueStep1 = name.trim() && email.trim() && gpuModel && consent1 && consent2;

  const handleDownload = async () => {
    setDownloading(true);
    setRegisterError(null);
    try {
      const os = detectOSString();
      const res = await fetch('/api/providers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          gpu_model: gpuModel,
          os,
          run_mode: runMode,
          scheduled_start: runMode === 'scheduled' ? schedStart : undefined,
          scheduled_end: runMode === 'scheduled' ? schedEnd : undefined,
        }),
      });

      if (res.status === 409) {
        setRegisterError('duplicate');
        setDownloading(false);
        return;
      }
      if (!res.ok) {
        setRegisterError('server');
        setDownloading(false);
        return;
      }

      const data = await res.json();
      const key = data.api_key;
      setApiKey(key);

      // Download the correct installer for detected OS
      const platform = detectedOS === 'windows' ? 'windows' : detectedOS === 'mac' ? 'mac' : 'linux';
      window.location.href = `/api/providers/download?key=${key}&platform=${platform}`;
      setStep(4);
    } catch {
      setRegisterError('server');
      setDownloading(false);
    }
  };

  const osLabels: Record<string, { label: string; platform: string; icon: string }> = {
    windows: { label: 'Windows', platform: 'windows', icon: '🪟' },
    mac: { label: 'macOS', platform: 'mac', icon: '🍎' },
    linux: { label: 'Linux', platform: 'linux', icon: '🐧' },
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">
          Become a <span className="text-[#FFD700]">DC1 Provider</span>
        </h1>
        <p className="text-gray-400 mb-10">Earn SAR by sharing your GPU compute power.</p>

        {/* Progress */}
        <div className="flex gap-2 mb-10">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-1 flex-1 rounded ${s <= step ? 'bg-[#FFD700]' : 'bg-gray-700'}`} />
          ))}
        </div>

        {/* Step 1 */}
        <div className={`mb-8 ${step < 1 ? 'hidden' : ''}`}>
          <h2 className="text-xl font-semibold mb-4">1. Identity &amp; Consent</h2>
          <div className="space-y-4">
            <input
              type="text" placeholder="Your name" value={name}
              onChange={e => setName(e.target.value)}
              disabled={step > 1}
              className="w-full bg-[#252525] border border-gray-700 rounded-lg px-4 py-3 focus:border-[#FFD700] focus:outline-none disabled:opacity-50"
            />
            <input
              type="email" placeholder="Email address" value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={step > 1}
              className="w-full bg-[#252525] border border-gray-700 rounded-lg px-4 py-3 focus:border-[#FFD700] focus:outline-none disabled:opacity-50"
            />
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">What GPU do you have?</label>
              <select
                value={gpuModel}
                onChange={e => setGpuModel(e.target.value)}
                disabled={step > 1}
                className="w-full bg-[#252525] border border-gray-700 rounded-lg px-4 py-3 focus:border-[#FFD700] focus:outline-none disabled:opacity-50 text-white"
              >
                <option value="" disabled>Select your GPU</option>
                {GPU_OPTIONS.map(gpu => (
                  <option key={gpu} value={gpu}>{gpu}</option>
                ))}
              </select>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={consent1} onChange={e => setConsent1(e.target.checked)} disabled={step > 1}
                className="mt-1 accent-[#FFD700]" />
              <span className="text-sm text-gray-300">I agree to share my GPU compute resources with DC1 renters</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={consent2} onChange={e => setConsent2(e.target.checked)} disabled={step > 1}
                className="mt-1 accent-[#FFD700]" />
              <span className="text-sm text-gray-300">I understand I can pause or stop at any time — my GPU, my rules</span>
            </label>
            {step === 1 && (
              <button onClick={() => setStep(2)} disabled={!canContinueStep1}
                className="w-full py-3 rounded-lg font-semibold bg-[#FFD700] text-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e6c200] transition">
                Continue →
              </button>
            )}
          </div>
        </div>

        {/* Step 2 */}
        {step >= 2 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Hardware Check</h2>
            {!hwCheckDone ? (
              <div className="flex items-center gap-3 text-gray-400">
                <div className="w-5 h-5 border-2 border-[#00A8E1] border-t-transparent rounded-full animate-spin" />
                Detecting your GPU...
              </div>
            ) : hwCheckResult?.passed ? (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-400 font-semibold">✅ GPU Detected</p>
                  <p className="text-green-300/80 text-sm mt-1">{hwCheckResult.gpu}</p>
                  <p className="text-gray-400 text-xs mt-2">Final verification happens when the daemon starts. Minimum: NVIDIA 8GB+ VRAM.</p>
                </div>
                {step === 2 && (
                  <button onClick={() => setStep(3)}
                    className="w-full py-3 rounded-lg font-semibold bg-[#FFD700] text-black hover:bg-[#e6c200] transition">
                    Continue →
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-yellow-400 font-semibold">⚠️ GPU Not Confirmed</p>
                  {hwCheckResult?.gpu && hwCheckResult.gpu !== 'Unknown' && (
                    <p className="text-yellow-300/80 text-sm mt-1">Detected: {hwCheckResult.gpu}</p>
                  )}
                  <p className="text-gray-400 text-sm mt-2">{hwCheckResult?.error}</p>
                </div>
                {step === 2 && (
                  <button onClick={() => setStep(3)}
                    className="w-full py-3 rounded-lg font-semibold bg-[#FFD700] text-black hover:bg-[#e6c200] transition">
                    Continue Anyway →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3 */}
        {step >= 3 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. How should DC1 use your GPU?</h2>
            <p className="text-gray-400 text-sm mb-4">You can change this anytime from your dashboard.</p>
            <div className="space-y-3">
              {([
                { value: 'always-on' as const, label: 'Always-on', badge: 'Recommended', desc: 'Runs quietly in background. Starts automatically at login. Earn while idle.' },
                { value: 'manual' as const, label: 'Manual only', desc: 'You control when to share. Start/stop from your dashboard or a desktop shortcut.' },
                { value: 'scheduled' as const, label: 'Scheduled', desc: 'Set a time window. DC1 runs only during those hours.' },
              ]).map(opt => (
                <div key={opt.value}
                  onClick={() => { if (step === 3) setRunMode(opt.value); }}
                  className={`p-4 rounded-lg border cursor-pointer transition ${runMode === opt.value ? 'border-[#FFD700] bg-[#252525]' : 'border-gray-700 bg-[#1f1f1f] hover:border-gray-500'} ${step > 3 ? 'opacity-50 cursor-default' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-4 h-4 rounded-full border-2 ${runMode === opt.value ? 'border-[#FFD700] bg-[#FFD700]' : 'border-gray-500'}`} />
                    <span className="font-semibold">{opt.label}</span>
                    {opt.badge && <span className="text-xs bg-[#FFD700] text-black px-2 py-0.5 rounded-full font-medium">{opt.badge}</span>}
                  </div>
                  <p className="text-sm text-gray-400 ml-6">{opt.desc}</p>
                  {opt.value === 'scheduled' && runMode === 'scheduled' && (
                    <div className="flex gap-3 mt-3 ml-6">
                      <label className="text-sm text-gray-400">From
                        <input type="time" value={schedStart} onChange={e => setSchedStart(e.target.value)}
                          className="ml-2 bg-[#333] border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </label>
                      <label className="text-sm text-gray-400">To
                        <input type="time" value={schedEnd} onChange={e => setSchedEnd(e.target.value)}
                          className="ml-2 bg-[#333] border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Registration Error Messages */}
            {registerError === 'duplicate' && (
              <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-400 text-sm font-semibold">This email is already registered.</p>
                <p className="text-yellow-400/70 text-sm mt-1">
                  <Link href="/provider" className="underline hover:text-yellow-300">Log in instead?</Link>
                </p>
              </div>
            )}
            {registerError === 'server' && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-sm font-semibold">Registration failed.</p>
                <p className="text-red-400/70 text-sm mt-1">
                  Please try again or contact{' '}
                  <a href="mailto:support@dc1st.com" className="underline hover:text-red-300">support@dc1st.com</a>
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="mt-6">
                <button onClick={handleDownload} disabled={downloading}
                  className="w-full py-3 rounded-lg font-semibold bg-[#FFD700] text-black hover:bg-[#e6c200] transition disabled:opacity-50">
                  {downloading ? 'Preparing...' : 'Download My Installer →'}
                </button>
              </div>
            )}
            {apiKey && step >= 4 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {(['windows', 'mac', 'linux'] as const).map(os => {
                  const info = osLabels[os];
                  const isDetected = os === detectedOS;
                  return (
                    <a
                      key={os}
                      href={`/api/providers/download?key=${apiKey}&platform=${info.platform}`}
                      className={`text-sm px-3 py-1.5 rounded-lg border transition ${
                        isDetected
                          ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700] font-semibold'
                          : 'border-gray-700 text-[#00A8E1] hover:border-gray-500'
                      }`}
                    >
                      {info.icon} {info.label} {isDetected && '(detected)'}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 4 */}
        {step >= 4 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Connect Your GPU</h2>
            {!connected && !connectionTimeout ? (
              <div className="space-y-4">
                <p className="text-green-400">✅ Installer downloaded! Run it on your PC.</p>
                <div className="flex items-center gap-3 text-[#00A8E1]">
                  <div className="w-3 h-3 bg-[#00A8E1] rounded-full animate-pulse" />
                  Waiting for your GPU to connect...
                </div>
              </div>
            ) : connectionTimeout && !connected ? (
              <div className="space-y-4">
                <p className="text-yellow-400 font-semibold">⚠️ Having trouble connecting?</p>
                <p className="text-gray-400 text-sm">We haven&apos;t detected your GPU yet. Try these steps:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300 bg-[#252525] rounded-lg p-4 border border-gray-700">
                  <li>Make sure you ran the installer as the correct user</li>
                  <li>Check your firewall allows outbound connections on port 443</li>
                  <li>Try restarting the DC1 daemon</li>
                </ol>
                <p className="text-gray-500 text-xs">
                  Still stuck? Contact{' '}
                  <a href="mailto:support@dc1st.com" className="text-[#00A8E1] underline">support@dc1st.com</a>
                </p>
                <button
                  onClick={() => {
                    pollStartRef.current = Date.now();
                    setConnectionTimeout(false);
                  }}
                  className="text-[#00A8E1] underline text-sm"
                >
                  Retry connection check
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-2xl">🟢 You&apos;re live! {name}&apos;s GPU just connected.</p>
                <a href={`/provider?key=${apiKey}`}
                  className="inline-block py-3 px-8 rounded-lg font-semibold bg-[#FFD700] text-black hover:bg-[#e6c200] transition">
                  View My Dashboard →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
