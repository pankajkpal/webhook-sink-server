import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { ArrowLeft, Copy, CheckCircle, XCircle, Activity, Globe } from 'lucide-react';

export default function Inbox() {
  const { uuid } = useParams();
  const [inbox, setInbox] = useState(null);
  const [messages, setMessages] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const webhookUrl = `${window.location.origin}/webhook/${uuid}`;

  useEffect(() => {
    // Fetch inbox details and history
    fetch(`/api/inboxes/${uuid}`)
      .then(res => res.json())
      .then(data => setInbox(data))
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
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inbox) return <div className="p-8 text-center animate-pulse">Loading...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Link to="/" className="inline-flex items-center text-gray-500 hover:text-blue-600 transition-colors">
        <ArrowLeft size={16} className="mr-1" /> Back to Inboxes
      </Link>
      
      {/* Header Card */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
          <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${isConnected ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            {isConnected ? 'Listening Live' : 'Disconnected'}
          </div>
        </div>

        <h2 className="text-3xl font-bold mb-2 text-gray-800">{inbox.name}</h2>
        
        <div className="mt-6 flex flex-col md:flex-row gap-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="bg-white p-2 rounded shadow-sm border border-gray-100 flex items-center justify-center">
            <Globe className="text-blue-500" size={24} />
          </div>
          <div className="flex-1 overflow-hidden w-full">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Your Webhook URL</p>
            <p className="font-mono text-sm text-gray-800 truncate">{webhookUrl}</p>
          </div>
          <button 
            onClick={copyUrl}
            className="shrink-0 flex items-center gap-2 bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600 px-4 py-2 rounded-lg transition-all active:scale-95 shadow-sm"
          >
            <Copy size={16} />
            {copied ? 'Copied!' : 'Copy URL'}
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="text-gray-400" />
            Live Event Feed
          </h3>
          <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded shadow-sm border border-gray-100">
            Showing last {messages.length} events
          </span>
        </div>

        {messages.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl text-center border border-dashed border-gray-300 shadow-sm">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity size={32} />
            </div>
            <h4 className="text-lg font-medium text-gray-800 mb-1">Waiting for events...</h4>
            <p className="text-sm text-gray-500">Send a request to your webhook URL to see it appear here instantly.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`bg-white rounded-xl shadow-sm border-l-4 overflow-hidden transition-all hover:shadow-md ${msg.status === 'SUCCESS' ? 'border-l-green-500' : 'border-l-red-500'}`}
              >
                <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    {msg.status === 'SUCCESS' ? (
                      <CheckCircle className="text-green-500" size={20} />
                    ) : (
                      <XCircle className="text-red-500" size={20} />
                    )}
                    <span className="font-mono font-bold text-gray-700 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100 text-sm">
                      {msg.method}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {new Date(msg.receivedAt).toLocaleString()}
                    </span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${msg.status === 'SUCCESS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {msg.status}
                  </span>
                </div>
                
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
    </div>
  );
}
