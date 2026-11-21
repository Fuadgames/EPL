import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, giveCoins, verifyProject } from '../firebase';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';
import { notify } from '../store/useDialogStore';

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
    if (error) {
      setMessage(`Error: ${error.message}`);
      notify.error(error.message);
    } else {
      setMessage('Coins given successfully!');
      notify.success('Coins given successfully!');
    }
  };

  const handleVerifyProject = async (projectId: string) => {
    const { error } = await verifyProject(projectId);
    if (error) {
      setMessage(`Error: ${error.message}`);
      notify.error(error.message);
    } else {
      setMessage('Project verified successfully!');
      notify.success('Project verified successfully!');
      setPendingApps(pendingApps.filter(app => app.id !== projectId));
    }
  };

  return (
    <div className={clsx('p-6 rounded-xl border', theme !== 'light' ? 'bg-[#181B20] border-[#262B33]' : 'bg-white border-[#E2E5EA]')}>
      <h2 className="text-lg font-bold mb-4">Developer Panel</h2>

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-2">Give Coins</h3>
          <input
            type="text"
            placeholder="User ID"
            value={targetUserId}
            onChange={e => setTargetUserId(e.target.value)}
            className={clsx(
              'w-full px-3 py-2 mb-2 rounded-lg border text-sm focus:outline-none',
              theme !== 'light' ? 'bg-[#111315] border-[#262B33] text-[#F3F4F6]' : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315]'
            )}
          />
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            className={clsx(
              'w-full px-3 py-2 mb-2 rounded-lg border text-sm font-mono-num focus:outline-none',
              theme !== 'light' ? 'bg-[#111315] border-[#262B33] text-[#F3F4F6]' : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315]'
            )}
          />
          <button
            onClick={handleGiveCoins}
            className="px-4 py-2 bg-[#10B981] hover:bg-[#059669] rounded-lg text-[#0A0C0E] text-sm font-semibold cursor-pointer"
          >
            Give Coins
          </button>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Pending Projects</h3>
          {pendingApps.map(app => (
            <div
              key={app.id}
              className={clsx(
                'flex justify-between items-center p-2.5 rounded-lg border mb-2',
                theme !== 'light' ? 'bg-[#111315] border-[#262B33]' : 'bg-[#F5F6F8] border-[#E2E5EA]'
              )}
            >
              <span className="text-sm font-medium">{app.title}</span>
              <button
                onClick={() => handleVerifyProject(app.id)}
                className="px-3 py-1 bg-[#10B981] hover:bg-[#059669] rounded-md text-[#0A0C0E] text-xs font-semibold cursor-pointer"
              >
                Verify
              </button>
            </div>
          ))}
        </div>

        {message && <p className="mt-4 text-xs text-[#10B981]">{message}</p>}
      </div>
    </div>
  );
}
