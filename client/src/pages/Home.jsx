import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, List, ArrowRight, X, Trash2, Clock, Zap, AlertTriangle, RotateCcw } from 'lucide-react';
import JsonResponseConfigurator from '../components/JsonResponseConfigurator';

function KeyValueBuilder({ items, setItems, label }) {
  const addItem = () => {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
    setItems(prev => [...prev, { id, key: '', value: '' }]);
  };

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <button 
          type="button" 
          onClick={addItem}
          className="text-blue-600 hover:bg-blue-50 p-1 rounded-md transition-colors cursor-pointer"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <input 
              type="text" 
              placeholder="Key" 
              value={item.key}
              onChange={(e) => updateItem(item.id, 'key', e.target.value)}
              className="w-1/2 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-hidden text-sm font-mono"
            />
            <input 
              type="text" 
              placeholder="Value" 
              value={item.value}
              onChange={(e) => updateItem(item.id, 'value', e.target.value)}
              className="w-1/2 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-hidden text-sm font-mono"
            />
            <button 
              type="button" 
              onClick={() => removeItem(item.id)}
              className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-xs text-gray-400 italic">No {label.toLowerCase()} added.</div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [inboxes, setInboxes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  // Form State
  const [name, setName] = useState('');
  const [method, setMethod] = useState('POST');
  const [headers, setHeaders] = useState([]); // Array of {key, value}
  const [queryParams, setQueryParams] = useState([]); // Array of {key, value}
  const [responseJson, setResponseJson] = useState('{\n  "status": "success"\n}');
  const [responseStatusCode, setResponseStatusCode] = useState(200);
  const [responseDelayMs, setResponseDelayMs] = useState(0);
  const [rateLimitPerSecond, setRateLimitPerSecond] = useState(0);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(20);
  const [randomErrorEnabled, setRandomErrorEnabled] = useState(false);
  const [isJsonInvalid, setIsJsonInvalid] = useState(false);

  useEffect(() => {
    fetchInboxes();
  }, []);

  const fetchInboxes = async () => {
    try {
      const res = await fetch('/api/inboxes');
      const data = await res.json();
      setInboxes(data);
    } catch (err) {
      console.error('Error fetching inboxes:', err);
    }
  };

  const handleClearFeed = async (uuid, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to clear all feed messages for this inbox?')) {
      return;
    }
    try {
      const res = await fetch(`/api/inboxes/${uuid}/messages`, { method: 'DELETE' });
      if (res.ok) {
        alert('Inbox feed cleared successfully');
      } else {
        const data = await res.json();
        alert('Failed to clear feed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error clearing feed:', err);
    }
  };

  const handleDeleteInbox = async (uuid, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this inbox and its messages?')) {
      return;
    }
    try {
      const res = await fetch(`/api/inboxes/${uuid}`, { method: 'DELETE' });
      if (res.ok) {
        setInboxes(prev => prev.filter(item => item.uuid !== uuid));
      }
    } catch (err) {
      console.error('Error deleting inbox:', err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (isJsonInvalid) {
      alert('Please fix the invalid JSON in the response configuration before creating.');
      return;
    }

    try {
      const safeReduce = (arr) => {
        if (!Array.isArray(arr)) return {};
        return arr.reduce((acc, curr) => {
          if (curr.key && curr.key.trim()) acc[curr.key.trim()] = curr.value.trim();
          return acc;
        }, {});
      };

      const headersObj = safeReduce(headers);
      const queryParamsObj = safeReduce(queryParams);

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseJson);
      } catch (err) {
        alert('Invalid JSON in response configuration: ' + err.message);
        return;
      }

      const payload = {
        name,
        method,
        headers: headersObj,
        queryParams: queryParamsObj,
        responseStructure: parsedResponse,
        responseStatusCode: Number(responseStatusCode) || 200,
        responseDelayMs: Number(responseDelayMs) || 0,
        rateLimitPerSecond: Number(rateLimitPerSecond) || 0,
        retryAfterSeconds: Number(retryAfterSeconds) || 20,
        randomErrorEnabled: Boolean(randomErrorEnabled)
      };
      
      const res = await fetch('/api/inboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create inbox');
      }
      setIsModalOpen(false);
      navigate(`/webhook-inbox/${data.uuid}`);
    } catch (err) {
      console.error(err);
      alert('Error creating inbox: ' + err.message);
    }
  };

  const handleOpenCreateModal = () => {
    setName('');
    setMethod('POST');
    setHeaders([]);
    setQueryParams([]);
    setResponseJson('{\n  "status": "success"\n}');
    setResponseStatusCode(200);
    setResponseDelayMs(0);
    setRateLimitPerSecond(0);
    setRetryAfterSeconds(20);
    setRandomErrorEnabled(false);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <List className="text-blue-500" />
            Your Webhook Inboxes
          </h2>
          <p className="text-gray-500 text-sm mt-1">Manage and monitor incoming webhooks in real-time.</p>
        </div>
        <button 
          onClick={handleOpenCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
        >
          <Plus size={20} />
          Create Inbox
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {inboxes.map(inbox => {
          let previewResponse = inbox.responseStructure || '{}';
          try {
            const parsed = JSON.parse(previewResponse);
            previewResponse = JSON.stringify(parsed);
          } catch {
            // keep raw
          }
          const delayNum = parseInt(inbox.responseDelayMs, 10) || 0;
          const statusNum = inbox.responseStatusCode || '200';
          const rateLimitNum = parseInt(inbox.rateLimitPerSecond, 10) || 0;
          const retryAfterNum = parseInt(inbox.retryAfterSeconds, 10) || 20;

          return (
            <div 
              key={inbox.uuid} 
              onClick={() => navigate(`/webhook-inbox/${inbox.uuid}`)}
              className="group bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 transform origin-left scale-y-0 group-hover:scale-y-100 transition-transform"></div>
              
              <div>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors truncate pr-2">
                    {inbox.name}
                  </h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => handleClearFeed(inbox.uuid, e)}
                      title="Clear Messages Feed"
                      className="text-gray-400 hover:text-amber-600 p-1 rounded-md hover:bg-amber-50 transition-colors cursor-pointer"
                    >
                      <RotateCcw size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteInbox(inbox.uuid, e)}
                      title="Delete Inbox"
                      className="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-md font-mono font-semibold">
                    {inbox.method}
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-md font-mono font-medium">
                    {statusNum}
                  </span>
                  {delayNum > 0 && (
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs px-2 py-0.5 rounded-md font-mono font-medium flex items-center gap-1">
                      <Clock size={11} className="text-amber-600" />
                      {delayNum >= 1000 ? `${(delayNum / 1000).toFixed(1)}s` : `${delayNum}ms`} delay
                    </span>
                  )}
                  {rateLimitNum > 0 && (
                    <span className="bg-orange-50 text-orange-800 border border-orange-200 text-xs px-2 py-0.5 rounded-md font-mono font-medium flex items-center gap-1">
                      <Zap size={11} className="text-orange-600" />
                      {rateLimitNum}/s (429 @ {retryAfterNum}s)
                    </span>
                  )}
                  {inbox.randomErrorEnabled === 'true' && (
                    <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs px-2 py-0.5 rounded-md font-mono font-medium flex items-center gap-1">
                      <AlertTriangle size={11} className="text-rose-600" />
                      Random 500
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-400 font-mono truncate mb-3">ID: {inbox.uuid}</p>

                {/* Response Preview */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 mb-3">
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">Configured Response:</span>
                  <p className="font-mono text-xs text-gray-700 truncate">
                    {previewResponse}
                  </p>
                </div>
              </div>

              <div className="flex items-center text-sm text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0 duration-300 pt-2 border-t border-gray-50">
                View Inbox & Live Feed <ArrowRight size={16} className="ml-1" />
              </div>
            </div>
          );
        })}
        {inboxes.length === 0 && (
          <div className="col-span-full py-16 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
            No inboxes found. Create one to get started!
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 my-8 border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Create New Inbox</h3>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inbox Name (optional)</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all text-sm"
                    placeholder="e.g. Stripe Webhooks"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allowed HTTP Method</label>
                  <select 
                    value={method} 
                    onChange={e => setMethod(e.target.value)}
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <KeyValueBuilder items={headers} setItems={setHeaders} label="Mandatory Headers" />
                <KeyValueBuilder items={queryParams} setItems={setQueryParams} label="Mandatory Query Params" />
              </div>

              {/* Rich JSON Response Configurator with Raw JSON & Delay */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Configure Response Payload & Timeout Simulation
                </label>
                <JsonResponseConfigurator
                  jsonString={responseJson}
                  onChangeJson={setResponseJson}
                  statusCode={responseStatusCode}
                  onChangeStatusCode={setResponseStatusCode}
                  delayMs={responseDelayMs}
                  onChangeDelayMs={setResponseDelayMs}
                  rateLimitPerSecond={rateLimitPerSecond}
                  onChangeRateLimitPerSecond={setRateLimitPerSecond}
                  retryAfterSeconds={retryAfterSeconds}
                  onChangeRetryAfterSeconds={setRetryAfterSeconds}
                  randomErrorEnabled={randomErrorEnabled}
                  onChangeRandomErrorEnabled={setRandomErrorEnabled}
                  onErrorChange={setIsJsonInvalid}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isJsonInvalid}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold cursor-pointer"
                >
                  Create Inbox
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
