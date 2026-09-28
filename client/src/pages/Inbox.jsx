import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  ArrowLeft, 
  Copy, 
  Check, 
  CheckCircle, 
  XCircle, 
  Activity, 
  Globe, 
  Settings, 
  Timer, 
  Clock, 
  Terminal, 
  X,
  Code2,
  Zap
} from 'lucide-react';
import JsonResponseConfigurator from '../components/JsonResponseConfigurator';

export default function Inbox() {
  const { uuid } = useParams();
  const [inbox, setInbox] = useState(null);
  const [messages, setMessages] = useState([]);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editMethod, setEditMethod] = useState('POST');
  const [editJson, setEditJson] = useState('{\n  "status": "success"\n}');
  const [editStatusCode, setEditStatusCode] = useState(200);
  const [editDelayMs, setEditDelayMs] = useState(0);
  const [editRateLimitPerSecond, setEditRateLimitPerSecond] = useState(0);
  const [editRetryAfterSeconds, setEditRetryAfterSeconds] = useState(20);
  const [isJsonInvalid, setIsJsonInvalid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const webhookUrl = `${window.location.origin}/webhook/${uuid}`;

  useEffect(() => {
    // Fetch inbox details and history
    fetch(`/api/inboxes/${uuid}`)
      .then(res => res.json())
      .then(data => {
        setInbox(data);
        if (data) {
          setEditMethod(data.method || 'POST');
          setEditStatusCode(parseInt(data.responseStatusCode, 10) || 200);
          setEditDelayMs(parseInt(data.responseDelayMs, 10) || 0);
          setEditRateLimitPerSecond(parseInt(data.rateLimitPerSecond, 10) || 0);
          setEditRetryAfterSeconds(parseInt(data.retryAfterSeconds, 10) || 20);
          try {
            const parsed = JSON.parse(data.responseStructure || '{"status":"success"}');
            setEditJson(JSON.stringify(parsed, null, 2));
          } catch {
            setEditJson(data.responseStructure || '{\n  "status": "success"\n}');
          }
        }
      })
      .catch(console.error);

    fetch(`/api/inboxes/${uuid}/messages`)
      .then(res => res.json())
      .then(data => setMessages(data))
      .catch(console.error);

    // Socket.io connection
    const socket = io(window.location.origin);
    
    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('joinInbox', uuid);
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('newMessage', (msg) => {
      setMessages(prev => [msg, ...prev]);
    });

    return () => socket.disconnect();
  }, [uuid]);

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const copyResponseJson = () => {
    if (!inbox?.responseStructure) return;
    try {
      const parsed = JSON.parse(inbox.responseStructure);
      navigator.clipboard.writeText(JSON.stringify(parsed, null, 2));
    } catch {
      navigator.clipboard.writeText(inbox.responseStructure);
    }
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const handleOpenEdit = () => {
    if (inbox) {
      setEditMethod(inbox.method || 'POST');
      setEditStatusCode(parseInt(inbox.responseStatusCode, 10) || 200);
      setEditDelayMs(parseInt(inbox.responseDelayMs, 10) || 0);
      setEditRateLimitPerSecond(parseInt(inbox.rateLimitPerSecond, 10) || 0);
      setEditRetryAfterSeconds(parseInt(inbox.retryAfterSeconds, 10) || 20);
      try {
        const parsed = JSON.parse(inbox.responseStructure || '{"status":"success"}');
        setEditJson(JSON.stringify(parsed, null, 2));
      } catch {
        setEditJson(inbox.responseStructure || '{\n  "status": "success"\n}');
      }
    }
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (isJsonInvalid) {
      alert('Please fix JSON syntax errors before saving.');
      return;
    }

    try {
      setIsSaving(true);
      let parsed;
      try {
        parsed = JSON.parse(editJson);
      } catch (err) {
        alert('Invalid JSON: ' + err.message);
        setIsSaving(false);
        return;
      }

      const res = await fetch(`/api/inboxes/${uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: editMethod,
          responseStructure: parsed,
          responseStatusCode: Number(editStatusCode),
          responseDelayMs: Number(editDelayMs),
          rateLimitPerSecond: Number(editRateLimitPerSecond) || 0,
          retryAfterSeconds: Number(editRetryAfterSeconds) || 20
        })
      });

      const updated = await res.json();
      if (!res.ok) {
        throw new Error(updated.error || 'Failed to update inbox configuration');
      }

      setInbox(updated);
      setIsEditModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error updating configuration: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!inbox) return <div className="p-8 text-center animate-pulse text-gray-500 font-medium">Loading inbox details...</div>;

  let formattedConfigJson = '{\n  "status": "success"\n}';
  try {
    const parsed = JSON.parse(inbox.responseStructure || '{"status":"success"}');
    formattedConfigJson = JSON.stringify(parsed, null, 2);
  } catch {
    formattedConfigJson = inbox.responseStructure || '';
  }

  const delayNum = parseInt(inbox.responseDelayMs, 10) || 0;
  const statusNum = inbox.responseStatusCode || '200';
  const rateLimitNum = parseInt(inbox.rateLimitPerSecond, 10) || 0;
  const retryAfterNum = parseInt(inbox.retryAfterSeconds, 10) || 20;

  // Generate test curl command
  const curlMethod = inbox.method === 'ANY' ? 'POST' : inbox.method;
  const timeoutFlag = delayNum > 0 ? ` --max-time ${(Math.ceil(delayNum / 1000) + 5)}` : '';
  const testCurlCommand = `curl -X ${curlMethod} "${webhookUrl}" -H "Content-Type: application/json" -d '{"event":"test","timestamp":${Date.now()}}'${timeoutFlag}`;

  const copyCurl = () => {
    navigator.clipboard.writeText(testCurlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <Link to="/" className="inline-flex items-center text-gray-500 hover:text-blue-600 transition-colors font-medium text-sm">
        <ArrowLeft size={16} className="mr-1" /> Back to Inboxes
      </Link>
      
      {/* Header Card */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xs border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
          <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${isConnected ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            {isConnected ? 'Listening Live' : 'Disconnected'}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <h2 className="text-3xl font-bold text-gray-900">{inbox.name}</h2>
          <button
            onClick={handleOpenEdit}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-gray-200"
          >
            <Settings size={15} />
            Configure Response & Rules
          </button>
        </div>
        
        {/* Webhook URL bar */}
        <div className="mt-4 flex flex-col md:flex-row gap-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="bg-white p-2 rounded-lg shadow-xs border border-gray-100 flex items-center justify-center">
            <Globe className="text-blue-500" size={24} />
          </div>
          <div className="flex-1 overflow-hidden w-full">
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Your Webhook URL</p>
            <p className="font-mono text-sm text-gray-800 select-all truncate">{webhookUrl}</p>
          </div>
          <button 
            onClick={copyUrl}
            className="shrink-0 flex items-center gap-2 bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600 px-4 py-2 rounded-lg transition-all active:scale-95 shadow-xs text-sm font-medium cursor-pointer"
          >
            {copiedUrl ? (
              <>
                <Check size={16} className="text-emerald-500" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy URL</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Configured Response & Settings Card */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="text-blue-500" size={18} />
            <h3 className="font-bold text-gray-800 text-base">Configured Webhook Response</h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-md font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Method: {inbox.method}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Status: {statusNum}
            </span>
            {delayNum > 0 ? (
              <span className="text-xs px-2.5 py-1 rounded-md font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1.5 animate-pulse">
                <Clock size={13} className="text-amber-600" />
                Delay: {delayNum >= 1000 ? `${(delayNum / 1000).toFixed(1)}s` : `${delayNum}ms`}
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-md font-mono font-medium bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1">
                <Timer size={13} className="text-gray-400" />
                Instant (0ms)
              </span>
            )}
            {rateLimitNum > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-md font-mono font-bold bg-orange-50 text-orange-800 border border-orange-300 flex items-center gap-1.5">
                <Zap size={13} className="text-orange-600" />
                Rate Limit: {rateLimitNum}/s (429 @ {retryAfterNum}s)
              </span>
            )}
          </div>
        </div>

        {/* Rate Limiting notice if configured */}
        {rateLimitNum > 0 && (
          <div className="bg-orange-50/90 border border-orange-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-orange-950">
            <Zap size={16} className="text-orange-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Simulated Rate Limiting is Active ({rateLimitNum} requests/second)</p>
              <p className="text-orange-800 text-[11px] mt-0.5">
                Requests exceeding <strong>{rateLimitNum} req/s</strong> will be rejected with HTTP <strong>429 Too Many Requests</strong> and a <code>Retry-After: {retryAfterNum}</code> header (resend time: {retryAfterNum}s) to test client rate limit and backoff retry logic.
              </p>
            </div>
          </div>
        )}

        {/* Delay notice if configured */}
        {delayNum > 0 && (
          <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
            <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Simulated Timeout / Response Delay is Active ({delayNum}ms)</p>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Every request to this webhook will be received immediately, but the HTTP connection will remain open for <strong>{delayNum}ms ({delayNum >= 1000 ? `${(delayNum / 1000).toFixed(1)}s` : `${delayNum}ms`})</strong> before returning the response. Perfect for testing your client&apos;s timeout tolerance and retry logic.
              </p>
            </div>
          </div>
        )}

        {/* Response JSON display */}
        <div className="rounded-xl border border-gray-800 bg-[#0f172a] overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-gray-800 bg-[#1e293b]/70 text-xs text-gray-300">
            <span className="font-mono text-gray-400 font-medium">HTTP Response Body (JSON)</span>
            <button
              onClick={copyResponseJson}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded text-gray-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {copiedResponse ? (
                <>
                  <Check size={12} className="text-emerald-400" /> Copied
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy JSON
                </>
              )}
            </button>
          </div>
          <pre className="p-4 text-emerald-400 font-mono text-xs md:text-sm overflow-x-auto leading-relaxed custom-scrollbar max-h-56">
            {formattedConfigJson}
          </pre>
        </div>

        {/* cURL Test Command */}
        <div className="bg-slate-900 rounded-xl p-3.5 border border-slate-800 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-slate-400 flex items-center gap-1.5 font-semibold">
              <Terminal size={14} className="text-blue-400" /> Test with cURL
            </span>
            <button
              onClick={copyCurl}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {copiedCurl ? (
                <>
                  <Check size={12} className="text-emerald-400" /> Copied
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy cURL
                </>
              )}
            </button>
          </div>
          <code className="block text-slate-300 font-mono text-[11px] break-all select-all bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            {testCurlCommand}
          </code>
        </div>
      </div>

      {/* Messages Feed */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="text-gray-400" />
            Live Event Feed
          </h3>
          <span className="text-xs text-gray-500 bg-white px-2.5 py-1 rounded-md shadow-xs border border-gray-100 font-mono font-medium">
            Showing last {messages.length} events
          </span>
        </div>

        {messages.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl text-center border border-dashed border-gray-300 shadow-xs">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity size={32} />
            </div>
            <h4 className="text-lg font-medium text-gray-800 mb-1">Waiting for events...</h4>
            <p className="text-sm text-gray-500">Send a request to your webhook URL or run the test cURL command above to see it appear here instantly.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`bg-white rounded-xl shadow-xs border-l-4 overflow-hidden transition-all hover:shadow-md ${
                  msg.status === 'SUCCESS' 
                    ? 'border-l-green-500' 
                    : msg.status === 'RATE_LIMITED' 
                    ? 'border-l-orange-500' 
                    : 'border-l-red-500'
                }`}
              >
                <div className="p-4 border-b border-gray-50 flex flex-wrap justify-between items-center bg-gray-50/50 gap-2">
                  <div className="flex items-center gap-3">
                    {msg.status === 'SUCCESS' ? (
                      <CheckCircle className="text-green-500" size={20} />
                    ) : msg.status === 'RATE_LIMITED' ? (
                      <Zap className="text-orange-500" size={20} />
                    ) : (
                      <XCircle className="text-red-500" size={20} />
                    )}
                    <span className="font-mono font-bold text-gray-700 bg-white px-2 py-0.5 rounded-md shadow-xs border border-gray-100 text-sm">
                      {msg.method}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {new Date(msg.receivedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {msg.delayMs > 0 && (
                      <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <Clock size={11} className="text-amber-600" />
                        Delayed: {msg.delayMs >= 1000 ? `${(msg.delayMs / 1000).toFixed(1)}s` : `${msg.delayMs}ms`}
                      </span>
                    )}
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      msg.status === 'SUCCESS' 
                        ? 'bg-green-100 text-green-700' 
                        : msg.status === 'RATE_LIMITED'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {msg.status === 'RATE_LIMITED' ? '429 RATE LIMITED' : msg.status}
                    </span>
                  </div>
                </div>
                
                {msg.status === 'RATE_LIMITED' && msg.errors?.length > 0 && (
                  <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
                    <p className="text-xs font-bold text-orange-900 mb-1 uppercase tracking-wider flex items-center gap-1">
                      <Zap size={13} className="text-orange-600" /> 429 Too Many Requests (Rate Limit Triggered):
                    </p>
                    <ul className="list-disc list-inside text-sm text-orange-800">
                      {msg.errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                )}

                {msg.status === 'FAILED' && msg.errors?.length > 0 && (
                  <div className="px-4 py-3 bg-red-50 border-b border-red-100">
                    <p className="text-xs font-bold text-red-800 mb-1 uppercase tracking-wider">Validation Errors:</p>
                    <ul className="list-disc list-inside text-sm text-red-600">
                      {msg.errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                )}

                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Headers</h4>
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto max-h-48 custom-scrollbar">
                      {JSON.stringify(msg.headers, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Payload (Body/Query)</h4>
                    <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs overflow-x-auto max-h-48 custom-scrollbar">
                      {JSON.stringify(msg.body || msg.query, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Configuration Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 my-8 border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Configure Webhook Response & Delay</h3>
                <p className="text-xs text-gray-500 mt-1">Changes take effect immediately for future incoming webhook calls.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Allowed HTTP Method</label>
                <select 
                  value={editMethod} 
                  onChange={e => setEditMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-hidden text-sm bg-white"
                >
                  <option value="ANY">ANY (All Methods)</option>
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>

              {/* JSON Response & Delay Configurator */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Response Payload & Timeout Simulation
                </label>
                <JsonResponseConfigurator
                  jsonString={editJson}
                  onChangeJson={setEditJson}
                  statusCode={editStatusCode}
                  onChangeStatusCode={setEditStatusCode}
                  delayMs={editDelayMs}
                  onChangeDelayMs={setEditDelayMs}
                  rateLimitPerSecond={editRateLimitPerSecond}
                  onChangeRateLimitPerSecond={setEditRateLimitPerSecond}
                  retryAfterSeconds={editRetryAfterSeconds}
                  onChangeRetryAfterSeconds={setEditRetryAfterSeconds}
                  onErrorChange={setIsJsonInvalid}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isJsonInvalid || isSaving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
