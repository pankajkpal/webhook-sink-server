import { useState, useEffect } from 'react';
import { 
  Code2, 
  Sparkles, 
  Copy, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  SlidersHorizontal,
  Plus,
  X,
  Clock,
  Timer,
  Zap,
  ShieldAlert
} from 'lucide-react';

const PRESETS = [
  {
    name: 'Simple Success',
    code: 200,
    json: { status: 'success' }
  },
  {
    name: 'Detailed Ack',
    code: 200,
    json: {
      status: 'success',
      message: 'Webhook processed successfully',
      code: 200,
      timestamp: Date.now()
    }
  },
  {
    name: 'Resource Created',
    code: 201,
    json: {
      status: 'created',
      id: 'item_1024',
      acknowledged: true
    }
  },
  {
    name: 'Data Envelope',
    code: 202,
    json: {
      ok: true,
      data: {
        queued: true,
        task_id: 'task_abc123'
      },
      meta: {
        server: 'webhook-sink'
      }
    }
  },
  {
    name: '404 Not Found',
    code: 404,
    json: {
      status: 'error',
      code: 404,
      message: 'The requested webhook resource was not found'
    }
  },
  {
    name: '429 Rate Limit',
    code: 429,
    json: {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please retry after 20 seconds.',
      retryAfter: 20
    }
  }
];

const STATUS_CODES = [
  { code: 200, label: '200 OK' },
  { code: 201, label: '201 Created' },
  { code: 202, label: '202 Accepted' },
  { code: 204, label: '204 No Content' },
  { code: 400, label: '400 Bad Request' },
  { code: 404, label: '404 Not Found' },
  { code: 429, label: '429 Too Many Requests' },
  { code: 500, label: '500 Server Error' }
];

const DELAY_PRESETS = [
  { label: '0ms (Instant)', value: 0 },
  { label: '500ms', value: 500 },
  { label: '1s', value: 1000 },
  { label: '3s', value: 3000 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s (Timeout test)', value: 30000 },
];

const RATE_LIMIT_PRESETS = [
  { label: 'Off', value: 0 },
  { label: '1 / sec', value: 1 },
  { label: '2 / sec', value: 2 },
  { label: '5 / sec', value: 5 },
  { label: '10 / sec', value: 10 },
  { label: '20 / sec', value: 20 },
];

const RETRY_AFTER_PRESETS = [
  { label: '5s', value: 5 },
  { label: '10s', value: 10 },
  { label: '20s (Default)', value: 20 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
];

export default function JsonResponseConfigurator({
  jsonString,
  onChangeJson,
  statusCode = 200,
  onChangeStatusCode,
  delayMs = 0,
  onChangeDelayMs,
  rateLimitPerSecond = 0,
  onChangeRateLimitPerSecond,
  retryAfterSeconds = 20,
  onChangeRetryAfterSeconds,
  onErrorChange
}) {
  const [activeTab, setActiveTab] = useState('json'); // 'json' | 'keyvalue'
  const [validationError, setValidationError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [keyValues, setKeyValues] = useState([]);

  // Validate JSON on change
  useEffect(() => {
    try {
      if (!jsonString || !jsonString.trim()) {
        setValidationError('Response JSON cannot be empty');
        if (onErrorChange) onErrorChange(true);
        return;
      }
      JSON.parse(jsonString);
      setValidationError(null);
      if (onErrorChange) onErrorChange(false);
    } catch (err) {
      setValidationError(err.message);
      if (onErrorChange) onErrorChange(true);
    }
  }, [jsonString, onErrorChange]);

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonString);
      const formatted = JSON.stringify(parsed, null, 2);
      onChangeJson(formatted);
      setValidationError(null);
    } catch {
      // cannot format invalid JSON
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const createKvItem = (k = '', v = '') => ({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    key: k,
    value: v
  });

  const handleApplyPreset = (preset) => {
    onChangeJson(JSON.stringify(preset.json, null, 2));
    if (onChangeStatusCode) {
      onChangeStatusCode(preset.code);
    }
    // sync key values if applicable
    if (typeof preset.json === 'object' && preset.json !== null && !Array.isArray(preset.json)) {
      setKeyValues(
        Object.entries(preset.json).map(([k, v]) =>
          createKvItem(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
        )
      );
    }
  };

  const handleTextareaKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const value = e.target.value;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChangeJson(newValue);
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Switch to Key-Value Builder
  const handleSwitchTab = (tab) => {
    if (tab === 'keyvalue') {
      try {
        const parsed = JSON.parse(jsonString);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          setKeyValues(
            Object.entries(parsed).map(([k, v]) =>
              createKvItem(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
            )
          );
        } else {
          setKeyValues([]);
        }
      } catch {
        setKeyValues([]);
      }
    } else if (tab === 'json') {
      // Reconstruct JSON from key values if key values exist
      if (keyValues.length > 0) {
        const obj = {};
        keyValues.forEach(({ key, value }) => {
          if (key.trim()) {
            try {
              obj[key.trim()] = JSON.parse(value);
            } catch {
              obj[key.trim()] = value;
            }
          }
        });
        onChangeJson(JSON.stringify(obj, null, 2));
      }
    }
    setActiveTab(tab);
  };

  const updateKeyValue = (id, field, val) => {
    const next = keyValues.map(item => item.id === id ? { ...item, [field]: val } : item);
    setKeyValues(next);

    const obj = {};
    next.forEach(({ key, value }) => {
      if (key && key.trim()) {
        try {
          obj[key.trim()] = JSON.parse(value);
        } catch {
          obj[key.trim()] = value;
        }
      }
    });
    onChangeJson(JSON.stringify(obj, null, 2));
  };

  const addKeyValue = () => {
    setKeyValues(prev => [...prev, createKvItem()]);
  };

  const removeKeyValue = (id) => {
    const next = keyValues.filter((item) => item.id !== id);
    setKeyValues(next);
    const obj = {};
    next.forEach(({ key, value }) => {
      if (key && key.trim()) {
        try {
          obj[key.trim()] = JSON.parse(value);
        } catch {
          obj[key.trim()] = value;
        }
      }
    });
    onChangeJson(JSON.stringify(obj, null, 2));
  };

  return (
    <div className="space-y-3">
      {/* Top Header Controls: Mode Selector & Status Code */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button
            type="button"
            onClick={() => handleSwitchTab('json')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'json'
                ? 'bg-white text-blue-600 shadow-xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Code2 size={13} />
            JSON Editor
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab('keyvalue')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'keyvalue'
                ? 'bg-white text-blue-600 shadow-xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <SlidersHorizontal size={13} />
            Key-Value Mode
          </button>
        </div>

        {/* HTTP Status Code */}
        {onChangeStatusCode && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Status Code:</span>
            <select
              value={statusCode}
              onChange={(e) => onChangeStatusCode(Number(e.target.value))}
              className="text-xs font-mono bg-white border border-gray-300 rounded-md px-2.5 py-1 text-gray-700 focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
            >
              {STATUS_CODES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Wait / Delay Configuration (Useful for timeout cases) */}
      {onChangeDelayMs && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
              <Timer size={14} className="text-amber-600" />
              <span>Wait Before Responding (Timeout / Delay Simulation)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                max="120000"
                step="100"
                value={delayMs}
                onChange={(e) => onChangeDelayMs(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-24 bg-white border border-amber-300 rounded-md px-2 py-1 text-xs font-mono text-amber-950 font-bold text-right focus:ring-2 focus:ring-amber-500 outline-hidden"
                placeholder="0"
              />
              <span className="text-xs font-mono font-medium text-amber-800">ms</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-amber-800/80 font-medium">Quick Presets:</span>
            {DELAY_PRESETS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => onChangeDelayMs(d.value)}
                className={`text-[11px] px-2 py-0.5 rounded-md font-mono transition-all ${
                  delayMs === d.value
                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                    : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          {delayMs > 0 && (
            <p className="text-[11px] text-amber-800 flex items-center gap-1.5 pt-0.5">
              <Clock size={12} className="shrink-0 text-amber-600" />
              <span>Server will pause for <strong>{delayMs}ms {delayMs >= 1000 ? `(${(delayMs / 1000).toFixed(1)}s)` : ''}</strong> before responding, ideal for testing timeout handling.</span>
            </p>
          )}
        </div>
      )}

      {/* Rate Limiting (Too Many Requests / 429 Simulation) */}
      {onChangeRateLimitPerSecond && (
        <div className="bg-orange-50/70 border border-orange-200/80 rounded-xl p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-950">
              <Zap size={14} className="text-orange-600" />
              <span>Rate Limit &amp; 429 Simulation (Too Many Requests)</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-orange-800">Limit:</span>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={rateLimitPerSecond}
                  onChange={(e) => onChangeRateLimitPerSecond(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-16 bg-white border border-orange-300 rounded-md px-2 py-1 text-xs font-mono text-orange-950 font-bold text-right focus:ring-2 focus:ring-orange-500 outline-hidden"
                  placeholder="0"
                />
                <span className="text-xs font-mono font-medium text-orange-800">req/s</span>
              </div>

              {onChangeRetryAfterSeconds && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-orange-800">Resend Time:</span>
                  <input
                    type="number"
                    min="1"
                    max="3600"
                    value={retryAfterSeconds}
                    onChange={(e) => onChangeRetryAfterSeconds(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-16 bg-white border border-orange-300 rounded-md px-2 py-1 text-xs font-mono text-orange-950 font-bold text-right focus:ring-2 focus:ring-orange-500 outline-hidden"
                    placeholder="20"
                  />
                  <span className="text-xs font-mono font-medium text-orange-800">s</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-orange-800/80 font-medium">Limit Presets:</span>
              {RATE_LIMIT_PRESETS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => onChangeRateLimitPerSecond(r.value)}
                  className={`text-[11px] px-2 py-0.5 rounded-md font-mono transition-all cursor-pointer ${
                    rateLimitPerSecond === r.value
                      ? 'bg-orange-600 text-white font-bold shadow-xs'
                      : 'bg-white hover:bg-orange-100 text-orange-900 border border-orange-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {onChangeRetryAfterSeconds && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-orange-800/80 font-medium">Resend Presets:</span>
                {RETRY_AFTER_PRESETS.map((ra) => (
                  <button
                    key={ra.value}
                    type="button"
                    onClick={() => onChangeRetryAfterSeconds(ra.value)}
                    className={`text-[11px] px-2 py-0.5 rounded-md font-mono transition-all cursor-pointer ${
                      retryAfterSeconds === ra.value
                        ? 'bg-orange-600 text-white font-bold shadow-xs'
                        : 'bg-white hover:bg-orange-100 text-orange-900 border border-orange-200'
                    }`}
                  >
                    {ra.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {rateLimitPerSecond > 0 && (
            <p className="text-[11px] text-orange-900 flex items-center gap-1.5 pt-0.5 border-t border-orange-200/60">
              <ShieldAlert size={13} className="shrink-0 text-orange-600" />
              <span>
                Requests exceeding <strong>{rateLimitPerSecond} req/s</strong> return <strong>429 Too Many Requests</strong> with header <code>Retry-After: {retryAfterSeconds}</code> (resend time: {retryAfterSeconds}s).
              </span>
            </p>
          )}
        </div>
      )}

      {/* Quick Preset Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
          <Sparkles size={11} className="text-amber-500" /> Payload Presets:
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => handleApplyPreset(p)}
            className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors font-medium active:scale-95"
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      {activeTab === 'json' ? (
        <div className="rounded-xl border border-gray-800 bg-[#0f172a] shadow-inner overflow-hidden">
          {/* Editor Header Bar */}
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-gray-800 bg-[#1e293b]/70 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-gray-400 font-semibold tracking-wide">
                response.json
              </span>
              {validationError ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800 text-[11px] font-mono">
                  <AlertCircle size={11} /> Invalid JSON
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] font-mono">
                  <CheckCircle2 size={11} /> Valid JSON
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleFormat}
                disabled={Boolean(validationError)}
                title="Format JSON indentation"
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded text-gray-300 hover:text-white hover:bg-slate-700/80 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Sparkles size={12} className="text-amber-400" />
                Format
              </button>
              <button
                type="button"
                onClick={handleCopy}
                title="Copy JSON"
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded text-gray-300 hover:text-white hover:bg-slate-700/80 transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Raw Textarea */}
          <div className="relative">
            <textarea
              value={jsonString}
              onChange={(e) => onChangeJson(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              rows={8}
              spellCheck={false}
              className="w-full bg-[#0f172a] text-emerald-400 font-mono text-xs md:text-sm p-3.5 focus:outline-hidden resize-y leading-relaxed selection:bg-blue-600 selection:text-white"
              placeholder='{\n  "status": "success"\n}'
            />
          </div>

          {/* Validation Error Banner */}
          {validationError && (
            <div className="px-3.5 py-2 bg-red-950/80 border-t border-red-900/60 text-red-300 text-xs flex items-center gap-2 font-mono">
              <AlertCircle size={14} className="shrink-0 text-red-400" />
              <span className="truncate">{validationError}</span>
            </div>
          )}
        </div>
      ) : (
        /* Key-Value Builder Mode */
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-gray-600">Key-Value Pairs</span>
            <button
              type="button"
              onClick={addKeyValue}
              className="text-blue-600 hover:bg-blue-50 text-xs font-medium px-2 py-1 rounded flex items-center gap-1 transition-colors"
            >
              <Plus size={14} /> Add Field
            </button>
          </div>

          {keyValues.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Field (e.g. status)"
                value={item.key}
                onChange={(e) => updateKeyValue(item.id, 'key', e.target.value)}
                className="w-1/2 border border-gray-300 bg-white rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-hidden text-xs font-mono"
              />
              <input
                type="text"
                placeholder="Value (e.g. success or 123)"
                value={item.value}
                onChange={(e) => updateKeyValue(item.id, 'value', e.target.value)}
                className="w-1/2 border border-gray-300 bg-white rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-hidden text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => removeKeyValue(item.id)}
                className="text-gray-400 hover:text-red-500 p-1.5 transition-colors"
                title="Remove"
              >
                <X size={15} />
              </button>
            </div>
          ))}

          {keyValues.length === 0 && (
            <div className="text-xs text-gray-400 italic py-2 text-center">
              No fields configured. Click &quot;Add Field&quot; or switch to JSON Editor.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
