import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, giveCoins, verifyProject } from '../firebase';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';

export default function DeveloperPanel() {
  const [targetUserId, setTargetUserId] = useState('');
  const [amount, setAmount] = useState(0);
  const [pendingApps, setPendingApps] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const theme = useStore(state => state.theme);

  useEffect(() => {
    const fetchPendingApps = async () => {
      const q = query(collection(db, 'apps'), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      setPendingApps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchPendingApps();
  }, []);

  const handleGiveCoins = async () => {
    const { error } = await giveCoins(targetUserId, amount);
    if (error) setMessage(`Error: ${error.message}`);
    else setMessage('Coins given successfully!');
  };

  const handleVerifyProject = async (projectId: string) => {
    const { error } = await verifyProject(projectId);
    if (error) setMessage(`Error: ${error.message}`);
    else {
      setMessage('Project verified successfully!');
      setPendingApps(pendingApps.filter(app => app.id !== projectId));
    }
  };

  return (
    <div className={clsx("p-6 rounded-2xl border", theme !== 'light' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
      <h2 className="text-xl font-bold mb-4">Developer Panel</h2>
      
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold mb-2">Give Coins</h3>
          <input 
            type="text" 
            placeholder="User ID" 
            value={targetUserId} 
            onChange={e => setTargetUserId(e.target.value)}
            className="w-full p-2 mb-2 rounded-lg bg-zinc-800 text-white"
          />
          <input 
            type="number" 
            placeholder="Amount" 
            value={amount} 
            onChange={e => setAmount(Number(e.target.value))}
            className="w-full p-2 mb-2 rounded-lg bg-zinc-800 text-white"
          />
          <button onClick={handleGiveCoins} className="px-4 py-2 bg-emerald-500 rounded-lg text-white">Give Coins</button>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Pending Projects</h3>
          {pendingApps.map(app => (
            <div key={app.id} className="flex justify-between items-center p-2 bg-zinc-800 rounded-lg mb-2">
              <span>{app.title}</span>
              <button onClick={() => handleVerifyProject(app.id)} className="px-3 py-1 bg-emerald-500 rounded-lg text-white text-sm">Verify</button>
            </div>
          ))}
        </div>
        
        {message && <p className="mt-4 text-sm">{message}</p>}
      </div>
    </div>
  );
}
