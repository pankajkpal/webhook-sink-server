import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, List, ArrowRight, X } from 'lucide-react';

export default function Home() {
  const [inboxes, setInboxes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  // Form State
  const [name, setName] = useState('');
  const [method, setMethod] = useState('POST');
  const [headers, setHeaders] = useState([]); // Array of {key, value}
  const [queryParams, setQueryParams] = useState([]); // Array of {key, value}
  const [responseStructure, setResponseStructure] = useState([{ key: 'status', value: 'success' }]);

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

  const handleCreate = async (e) => {
    e.preventDefault();
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
      const responseObj = safeReduce(responseStructure);

      const payload = {
        name,
        method,
        headers: headersObj,
        queryParams: queryParamsObj,
        responseStructure: Object.keys(responseObj).length > 0 ? responseObj : { status: 'success' }
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

  const KeyValueBuilder = ({ items, setItems, label }) => {
    const addItem = () => setItems([...items, { key: '', value: '' }]);
    const updateItem = (index, field, value) => {
      const newItems = [...items];
      newItems[index][field] = value;
      setItems(newItems);
    };
    const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

    return (
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-gray-700">{label}</label>
          <button 
            type="button" 
            onClick={addItem}
            className="text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <input 
                type="text" 
                placeholder="Key" 
                value={item.key}
                onChange={(e) => updateItem(index, 'key', e.target.value)}
                className="w-1/2 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
              />
              <input 
                type="text" 
                placeholder="Value" 
                value={item.value}
                onChange={(e) => updateItem(index, 'value', e.target.value)}
                className="w-1/2 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
              />
              <button 
                type="button" 
                onClick={() => removeItem(index)}
                className="text-gray-400 hover:text-red-500 p-1 transition-colors"
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
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95"
        >
          <Plus size={20} />
          Create Inbox
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {inboxes.map(inbox => (
          <div 
            key={inbox.uuid} 
            onClick={() => navigate(`/webhook-inbox/${inbox.uuid}`)}
            className="group bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 transform origin-left scale-y-0 group-hover:scale-y-100 transition-transform"></div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors">
                {inbox.name}
              </h3>
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-mono">
                {inbox.method}
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono truncate mb-4">ID: {inbox.uuid}</p>
            <div className="flex items-center text-sm text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0 duration-300">
              View Inbox <ArrowRight size={16} className="ml-1" />
            </div>
          </div>
        ))}
        {inboxes.length === 0 && (
          <div className="col-span-full py-16 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
            No inboxes found. Create one to get started!
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 my-8">
            <h3 className="text-xl font-bold mb-6">Create New Inbox</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. Stripe Webhooks"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Allowed HTTP Method</label>
                <select 
                  value={method} 
                  onChange={e => setMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="ANY">ANY</option>
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>

              <KeyValueBuilder items={headers} setItems={setHeaders} label="Mandatory Headers" />
              <KeyValueBuilder items={queryParams} setItems={setQueryParams} label="Mandatory Query Params" />
              <KeyValueBuilder items={responseStructure} setItems={setResponseStructure} label="Response Structure" />

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all active:scale-95"
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
