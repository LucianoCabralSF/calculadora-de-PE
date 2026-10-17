// Proteções comuns das rotas de IA: mesma origem, JSON e limite por IP
import Anthropic from '@anthropic-ai/sdk';

// Chave sem workspace exige o cabeçalho anthropic-workspace-id (variável ANTHROPIC_WORKSPACE_ID)
export const client = new Anthropic(process.env.ANTHROPIC_WORKSPACE_ID
  ? { defaultHeaders: { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } }
  : {});
export { Anthropic };

export function criarLimite(maximo, janelaMs) {
  const acessos = new Map();
  return ip => {
    const agora = Date.now();
    const lista = (acessos.get(ip) || []).filter(t => agora - t < janelaMs);
    if (lista.length >= maximo) { acessos.set(ip, lista); return false; }
    lista.push(agora); acessos.set(ip, lista);
    return true;
  };
}

// Devolve um código de erro (e já responde) ou null se o pedido pode seguir
export function barrar(req, res, permitido) {
  if (req.method !== 'POST') { res.status(405).json({ code: 'metodo' }); return true; }
  // Só aceita pedidos feitos pela própria página (barra uso direto por outros sites)
  let host = '';
  try { host = new URL(req.headers.origin || '').host; } catch (e) { }
  if (!host || host !== req.headers.host) { res.status(403).json({ code: 'origem' }); return true; }
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) { res.status(415).json({ code: 'formato' }); return true; }
  // Na Vercel, x-real-ip / x-forwarded-for são definidos pela própria plataforma
  const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconhecido';
  if (!permitido(ip)) { res.status(429).json({ code: 'rate_limited' }); return true; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ code: 'sem_chave' }); return true; }
  return false;
}

export function codigoErro(e) {
  console.error('Falha ao chamar o Claude:', e?.status, e?.name, String(e?.message || '').slice(0, 500));
  if (e instanceof Anthropic.RateLimitError) return [429, 'rate_limited'];
  if (e instanceof Anthropic.AuthenticationError || /workspace/i.test(e?.message || '')) return [503, 'sem_chave'];
  if (e instanceof Anthropic.APIError) return [502, /credit/i.test(e.message || '') ? 'sem_credito' : 'upstream_error'];
  if (e instanceof SyntaxError) return [502, 'invalid_json'];
  return [500, 'upstream_error'];
}
