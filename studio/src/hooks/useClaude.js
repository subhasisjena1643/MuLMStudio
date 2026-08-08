import { useCallback, useState } from 'react';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export function useClaude() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);

  const askClaude = useCallback(async (systemPrompt, userMessage) => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        text: 'Claude API key not configured. Set VITE_ANTHROPIC_API_KEY in .env.local'
      };
    }

    setIsLoading(true);
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }]
        })
      });

      const data = await response.json();
      const text = data.content
        ?.filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n') || 'No response from Claude.';

      setLastResponse(text);
      setIsLoading(false);
      return { ok: true, text };
    } catch (err) {
      setIsLoading(false);
      return { ok: false, text: `Claude API error: ${err.message}` };
    }
  }, []);

  const explainMismatch = useCallback(async (problem, codeContext) => {
    const systemPrompt = `You are µLM Studio's AI diagnostic engine. You analyze PyTorch shape mismatches with the precision of a senior ML researcher. Be concise (max 4 sentences). Always name the specific tensors, their shapes, and the most likely root cause. End with ONE concrete fix. Never say "I" — speak as the tool ("µLM detected...").`;

    const userMessage = `Shape mismatch in a PyTorch model:

Headline: ${problem.headline || 'Unknown'}
Source: ${problem.source_label || problem.source_id} with shape ${problem.source_shape}
Target: ${problem.target_label || problem.target_id} with shape ${problem.target_shape}
Detail: ${problem.detail || 'None'}

${codeContext ? `Relevant code:\n\`\`\`python\n${codeContext}\n\`\`\`` : ''}

Diagnose the root cause and suggest the fix.`;

    return askClaude(systemPrompt, userMessage);
  }, [askClaude]);

  const explainArchitecture = useCallback(async (graphData, code) => {
    const systemPrompt = `You are µLM Studio's AI engine. Generate a 3-4 sentence model map: what the architecture is, its key components, any atomic/untraceable regions and why. Speak as the tool. Be precise about shapes and module names. Use the format:
"Architecture: [name/type]. [Key structural observation]. [Any honest-degradation notes]. [One insight a researcher would find useful]."`;

    const nodeList = (graphData?.nodes || [])
      .map(n => `${n.id} (${n.data?.sync_state || 'traced'}) shape=${n.data?.shape || '?'}`)
      .join(', ');

    const userMessage = `Traced graph nodes: ${nodeList}

Code:
\`\`\`python
${code?.slice(0, 2000) || 'No code available'}
\`\`\`

Generate the model map.`;

    return askClaude(systemPrompt, userMessage);
  }, [askClaude]);

  return { askClaude, explainMismatch, explainArchitecture, isLoading, lastResponse };
}
