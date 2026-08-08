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
          model: 'claude-opus-4-8',
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

  const explainError = useCallback(async (headline, traceback) => {
    const systemPrompt = `You are µLM Studio's AI diagnostic engine. You read raw Python tracebacks produced while tracing a PyTorch model and translate them into a plain-English diagnosis for a researcher who does not want to parse a stack trace. Be concise (max 4 sentences). Name the failing line, module, or operation if it's visible in the traceback, state the likely root cause in plain language, and end with ONE concrete fix. Never say "I" — speak as the tool ("µLM detected...").`;

    const userMessage = `A trace of the user's PyTorch code failed.

Headline: ${headline || 'Unknown error'}

${traceback ? `Traceback:\n${traceback.slice(0, 4000)}` : 'No traceback available.'}

Explain this error in plain English and suggest a fix.`;

    return askClaude(systemPrompt, userMessage);
  }, [askClaude]);

  const explainNode = useCallback(async (nodeData) => {
    const systemPrompt = `You are µLM Studio's AI engine, powering the Debug panel. Given the raw internal record for one traced block, explain in plain English what it does and why it looks the way it does. Be concise (max 3 sentences). Mention the shape, category, and sync_state if they're notable (e.g. why a block is atomic or untraceable), and skip anything obvious or redundant. Speak as the tool, never "I".`;

    const userMessage = `Selected block record:
\`\`\`json
${JSON.stringify(nodeData, null, 2).slice(0, 3000)}
\`\`\`

Explain this block.`;

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

  return { askClaude, explainMismatch, explainError, explainNode, explainArchitecture, isLoading, lastResponse };
}
