// Servidor da IA: recebe o texto do documento, pergunta ao Claude e devolve só os dados.
// A chave fica na variável de ambiente ANTHROPIC_API_KEY da Vercel e nunca vai para o navegador.
import { SCHEMA, montarPrompt } from '../lib/prompt.mjs';
import { client, criarLimite, barrar, codigoErro } from '../lib/protecao.mjs';

const LIMITE_TEXTO = 150000;
const LIMITE_EXTRA = 500;
const permitido = criarLimite(12, 10 * 60 * 1000); // 12 leituras a cada 10 min por IP

export default async function handler(req, res) {
  if (barrar(req, res, permitido)) return;

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
    const [status, code] = codigoErro(e);
    return res.status(status).json({ code });
  }
}
