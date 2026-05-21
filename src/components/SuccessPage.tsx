import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';

export default function SuccessPage() {
  const [premiumCode, setPremiumCode] = useState('');
  const setPremiumCodeGlobal = useStore(state => state.setPremiumCode);
  
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const session_id = query.get('session_id');
    const user_id = query.get('user_id');

    async function verify() {
      try {
        const res = await fetch(`/api/verify-session?session_id=${session_id}&user_id=${user_id}`);
        const data = await res.json();
        if (data.premiumCode) {
          setPremiumCode(data.premiumCode);
          setPremiumCodeGlobal(data.premiumCode);
        }
      } catch (e) {
        console.error(e);
      }
    }
    
    if (session_id) verify();
  }, [setPremiumCodeGlobal]);

  return (
    <div className="flex flex-col items-center justify-center p-8 h-screen">
      <h1 className="text-2xl font-bold">Successfully Purchased!</h1>
      {premiumCode && (
        <div className="mt-4 p-4 bg-zinc-800 rounded">
          <p>Your one-time premium code:</p>
          <p className="text-xl font-bold font-mono text-emerald-500">{premiumCode}</p>
        </div>
      )}
    </div>
  );
}
