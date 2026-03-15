import React, { useState } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { useStore } from '../store/useStore';
import clsx from 'clsx';

interface AIAgentProps {
  onCodeGenerated: (code: string) => void;
  currentCode: string;
}

export default function AIAgent({ onCodeGenerated, currentCode }: AIAgentProps) {
  const { theme } = useStore();
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3.1-pro-preview";
      
      const systemInstruction = `
        You are an AI expert in Easy Programming Language (EPL).
        EPL is a language where programming looks like plain English.
        
        Syntax rules:
        - Actions and entities are keywords.
        - Parameters are passed in curly braces: keyword{param1=val1, param2=val2}.
        - Use '#' for comments (e.g. # This is a comment).
        - Use 'create' to instantiate entities.
        - Use entity keywords without 'create' to update existing ones.
        - Events end with '?': started?, created?, clicked?, collided?, key_pressed?, timer_tick?.
        - Event blocks end with 'end'.
        - Control flow: if check{expression=...} ... else ... end.
        - Keywords: world, button, block, 3Dblock, sprite, png, text_label, particle, sound, timer, player, enemy.
        - Actions: move, set up, background, type, destroy, wait, stop.
        
        Example:
        started?
          create world{background=blue}
          create button{name=Btn, label="Click me", x=100, y=100}
        end
        
        clicked?{target=Btn}
          type{text="Button clicked!"}
          move{target=Btn, x=+10}
        end

        Your task is to generate ONLY the EPL code based on the user's request.
        Do not include any explanations, markdown code blocks, or extra text.
        If the user asks to modify existing code, provide the full updated code.
        
        Current code:
        \${currentCode}
      `;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      const generatedCode = response.text?.trim() || '';
      // Remove markdown code blocks if the model included them despite instructions
      const cleanedCode = generatedCode.replace(/```[a-z]*\n?|```/gi, '').trim();
      
      onCodeGenerated(cleanedCode);
      setPrompt('');
    } catch (error) {
      console.error("AI Generation Error:", error);
      alert("Failed to generate code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={clsx(
      "p-4 border-t",
      theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <div className="flex items-center gap-2 mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
        AI Assistant
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          placeholder="Ask AI to create something (e.g. 'Make a red block that moves when clicked')"
          className={clsx(
            "flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-all",
            theme === 'dark' 
              ? 'bg-zinc-950 border border-zinc-800 focus:border-emerald-500 text-zinc-200' 
              : 'bg-zinc-50 border border-zinc-200 focus:border-emerald-500 text-zinc-800'
          )}
        />
        <button
          onClick={handleGenerate}
          disabled={isLoading || !prompt.trim()}
          className={clsx(
            "px-4 py-2 rounded-lg flex items-center justify-center transition-all",
            isLoading || !prompt.trim()
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
          )}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
