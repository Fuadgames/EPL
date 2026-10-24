/**
 * Client helper to call secure server-side Gemini endpoints.
 * Never exposes API keys or secrets in client-side code.
 */

export async function generateWithAI(
  prompt: string, 
  options?: { systemInstruction?: string; model?: string }
): Promise<string> {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      model: options?.model,
      systemInstruction: options?.systemInstruction
    })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'AI generation request failed');
  }

  const data = await res.json();
  return data.text || '';
}

export async function generateImageWithAI(prompt: string): Promise<string> {
  const res = await fetch('/api/ai/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Image generation request failed');
  }

  const data = await res.json();
  return data.imageBase64 || '';
}
