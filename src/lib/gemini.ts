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
      model: options?.model || 'gemini-4-hydrogen',
      systemInstruction: options?.systemInstruction,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'AI generation request failed');
  }

  const data = await res.json();
  return data.text || '';
}

export async function generateImageWithAI(
  prompt: string,
  options?: { aspectRatio?: '1:1' | '16:9'; title?: string }
): Promise<{ imageBase64: string; mimeType: string; isSvgFallback?: boolean }> {
  const res = await fetch('/api/ai/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      aspectRatio: options?.aspectRatio || '1:1',
      title: options?.title || 'EPL App',
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Image generation request failed');
  }

  const data = await res.json();
  return {
    imageBase64: data.imageBase64 || '',
    mimeType: data.mimeType || 'image/png',
    isSvgFallback: !!data.isSvgFallback,
  };
}
