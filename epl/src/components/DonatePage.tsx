import React from 'react';
import { Star } from 'lucide-react';

export default function DonatePage() {
  const packs = [
    { coins: 10, price: 1.99 },
    { coins: 50, price: 3.99 },
    { coins: 100, price: 5.99 },
    { coins: 150, price: 7.99 },
    { coins: 1500, price: 9.99 },
  ];

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4 flex items-center gap-3">
        <Star className="text-yellow-400" /> Donate EPLCoins
      </h1>
      <p className="text-zinc-400 mb-8">Support EPL Studio and boost your balance with EPLCoins!</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {packs.map((pack) => (
          <button key={pack.coins} className="p-6 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition flex flex-col items-center gap-2">
            <span className="text-2xl font-bold text-emerald-400">{pack.coins} EPLCoins</span>
            <span className="text-lg text-zinc-300">${pack.price.toFixed(2)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
