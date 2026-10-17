// Servidor da IA: recebe o texto do documento, pergunta ao Claude e devolve só os dados.
// A chave fica na variável de ambiente ANTHROPIC_API_KEY da Vercel e nunca vai para o navegador.
import Anthropic from '@anthropic-ai/sdk';
import { SCHEMA, montarPrompt } from '../lib/prompt.mjs';

const client = new Anthropic();
const LIMITE_TEXTO = 150000;
const LIMITE_EXTRA = 500;

// Limite simples por endereço IP (vale por instância do servidor; evita abuso casual)
const JANELA_MS = 10 * 60 * 1000, MAX_POR_JANELA = 12;
const acessos = new Map();
function permitido(ip) {
  const agora = Date.now();
  const lista = (acessos.get(ip) || []).filter(t => agora - t < JANELA_MS);
  if (lista.length >= MAX_POR_JANELA) { acessos.set(ip, lista); return false; }
  lista.push(agora); acessos.set(ip, lista);
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ code: 'metodo' });

  const origem = req.headers.origin;
  if (origem) {
    let host = '';
    try { host = new URL(origem).host; } catch (e) { }
    if (host !== req.headers.host) return res.status(403).json({ code: 'origem' });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconhecido';
  if (!permitido(ip)) return res.status(429).json({ code: 'rate_limited' });

  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ code: 'sem_chave' });

  const { texto, nome, extra } = req.body || {};
  if (typeof texto !== 'string' || texto.trim().length < 20) return res.status(400).json({ code: 'vazio' });
  if (texto.length > LIMITE_TEXTO) return res.status(413).json({ code: 'prompt_too_large' });

  try {
    const resp = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: montarPrompt(texto, String(nome || 'documento').slice(0, 120), String(extra || '').slice(0, LIMITE_EXTRA))
      }]
    });
    if (resp.stop_reason === 'refusal') return res.status(422).json({ code: 'refused' });
    if (resp.stop_reason === 'max_tokens') return res.status(502).json({ code: 'invalid_json' });
    const txt = resp.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return res.status(200).json(JSON.parse(txt));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ code: 'rate_limited' });
    if (e instanceof Anthropic.AuthenticationError) return res.status(503).json({ code: 'sem_chave' });
    if (e instanceof Anthropic.APIError) {
      const semCredito = /credit/i.test(e.message || '');
      return res.status(502).json({ code: semCredito ? 'sem_credito' : 'upstream_error' });
    }
    if (e instanceof SyntaxError) return res.status(502).json({ code: 'invalid_json' });
    return res.status(500).json({ code: 'upstream_error' });
  }
}
