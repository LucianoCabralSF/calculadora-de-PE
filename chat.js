/* Controller consultivo: chat flutuante que conversa sobre os dados da calculadora.
   Só aparece depois que a pessoa alimenta os dados (importação com IA ou digitação). */
'use strict';

const CHAT = (() => {
  const SUGESTOES = [
    'Qual é o diagnóstico geral desses números?',
    'Onde estão os maiores riscos?',
    'Como posso melhorar a margem?',
    'Explique o ponto de equilíbrio com meus números',
    'Devo aceitar o pedido especial?'
  ];
  const MSG = {
    sem_servidor: 'O chat só funciona na versão publicada (calculadora-de-pe.vercel.app).',
    sem_chave: 'A IA está desligada no momento (chave não configurada ou expirada). Avise o professor.',
    sem_credito: 'Os créditos da IA acabaram. Avise o professor.',
    rate_limited: 'Muitas mensagens em pouco tempo. Espere alguns minutos e tente de novo.',
    refused: 'O Claude não quis responder a essa pergunta. Tente reformular.'
  };
  const CHAVE_CHAT = 'calcController.chat';
  let conversa = [], apagada = null, ctl = null, aberto = false, avisoTimer = null;
  // A conversa fica guardada neste navegador (sobrevive a fechar o chat ou recarregar a página)
  const guardar = () => { try { localStorage.setItem(CHAVE_CHAT, JSON.stringify(conversa.filter(m => m.content))); } catch (e) { } };
  try { conversa = JSON.parse(localStorage.getItem(CHAVE_CHAT)) || []; } catch (e) { conversa = []; }
  if (!Array.isArray(conversa)) conversa = [];
  const el = id => document.getElementById(id);

  /* ---------- retrato dos dados atuais ---------- */
  const limpo = s => (s || '').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  const textoDe = sel => { const n = document.querySelector(sel); return n ? limpo(n.innerText || n.textContent) : ''; };
  const tabela = sel => {
    const t = document.querySelector(sel);
    if (!t) return '';
    return [...t.querySelectorAll('tr')].map(tr => [...tr.children].map(c => limpo(c.textContent)).join(' | ')).filter(l => l.replace(/[| ]/g, '')).join('\n');
  };

  function contexto() {
    const b = base(), u = U(), us = plural(u), d = D();
    const campos = [...document.querySelectorAll('details.base label.f')]
      .filter(l => l.style.display !== 'none')
      .map(l => { const i = l.querySelector('[data-k]'); return i ? `- ${limpo(l.querySelector('span')?.textContent)}: ${i.value || '(vazio)'}` : ''; })
      .filter(Boolean).join('\n');
    const partes = [
      `MODO: ${isServ() ? 'Serviços' : 'Produtos'} · forma de informar: ${isDRE() ? 'totais do mês (DRE), a unidade de análise é R$ 1 de receita' : 'por unidade (' + u + ')'}`,
      `PRODUTO/SERVIÇO: ${d.produto || '-'}`,
      `DADOS BASE:\n${campos}`,
      `INDICADORES CALCULADOS:
- Margem de contribuição por ${u}: ${brl(b.mcu)} · IMC (MC total ÷ receita bruta): ${pct(b.imc)}
- Receita do mês: ${brl(b.preco * b.volVend)} · MC total: ${brl(b.mcu * b.volVend)} · Fixos (CF+DF): ${brl(b.F)} (CF ${brl(b.cfp)}, DF ${brl(b.df)})
- Lucro do mês (gerencial): ${brl(b.lucro)}
- PE contábil: ${qtd(b.pec, us)} = ${brl(b.pecR)} · PE financeiro: ${qtd(b.pef, us)} = ${brl(b.pefR)} · PE econômico: ${qtd(b.pee, us)} = ${brl(b.peeR)}
- Margem de segurança: ${pct(b.ms)} · Alavancagem operacional: ${ok(b.gao) ? num(b.gao, 1) + 'x' : '-'} · Uso da capacidade: ${pct(b.ocup)}
- Custo cheio (absorção) por ${u}: ${brl(b.cheio)} (fixo rateado ${brl(b.cfu)})`,
      `LEITURA AUTOMÁTICA:\n${textoDe('#leituras360')}`
    ];
    if (d.linhas?.length) partes.push(`LINHAS DO DOCUMENTO (descrição | valor mensal | grupo):\n` + tabelaLinhas());
    partes.push(`ABSORÇÃO x VARIÁVEL:\n${tabela('#dreAbs')}\n${tabela('#dreVar')}\n${textoDe('#alertaEstoque')}`);
    // Abas que ainda estão com os números de exemplo da ferramenta não entram como dados do caso
    const ex = EXEMPLOS[ST.modo];
    const alterado = ks => ks.some(k => JSON.stringify(d[k]) !== JSON.stringify(ex[k]));
    const ignoradas = [];
    if (alterado(['pDesc', 'pq', 'pp', 'pcv', 'pdv', 'prat', 'pinc', 'pcan'])) partes.push(`PEDIDO/PROPOSTA ESPECIAL "${d.pDesc || ''}": quantidade ${d.pq}, preço ${d.pp}, custo variável ${d.pcv}, desp. variáveis ${d.pdv}%, rateio no relatório ${d.prat}, gastos extras ${d.pinc}, vendas perdidas ${d.pcan}
${tabela('#pedVar table')}
${textoDe('#pedEmpresa')}
Recomendação da ferramenta: ${textoDe('#pedRec')}`);
    else ignoradas.push('pedido especial');
    if (alterado(['mix', 'mixRec', 'mixH'])) partes.push(`MIX E GARGALO (recurso escasso: ${d.mixRec}, disponível ${d.mixH}):\n${tabela('#resMix')}\n${textoDe('#resMixMsg')}`);
    else ignoradas.push('mix e gargalo');
    if (alterado(['abcP', 'abcA'])) partes.push(`CUSTEIO ABC:\n${tabela('#resAbc')}\n${textoDe('#resAbcMsg')}`);
    else ignoradas.push('custeio ABC');
    if (!isDRE()) partes.push(`FORMAÇÃO DE PREÇO${alterado(['mkImp', 'mkCom', 'mkDF', 'mkLuc', 'pMerc', 'metaMg']) ? '' : ' (percentuais ainda são os de exemplo; use com cautela)'}:\n${textoDe('#resMk')}\n${textoDe('#resMeta')}`);
    if (ignoradas.length) partes.push(`NÃO PREENCHIDO PELO USUÁRIO (ainda com números de exemplo, por isso não enviado): ${ignoradas.join(', ')}. Se for útil para a pergunta, sugira preencher.`);
    return partes.join('\n\n').slice(0, 38000);
  }
  function tabelaLinhas() {
    return [...document.querySelectorAll('#tabLinhas tbody tr')].map(tr => {
      const [d, v] = tr.querySelectorAll('input'); const g = tr.querySelector('select');
      return `${d.value} | ${v.value} | ${g.selectedOptions[0]?.text || ''}`;
    }).join('\n');
  }

  /* ---------- texto da resposta (markdown simples, sempre escapado) ---------- */
  const inline = l => l.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])_(.+?)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  function formatar(txt) {
    const linhas = esc(txt).split('\n').map(inline);
    let html = '', lista = false;
    for (const l of linhas) {
      const item = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (item) { if (!lista) { html += '<ul>'; lista = true; } html += `<li>${item[1]}</li>`; continue; }
      if (lista) { html += '</ul>'; lista = false; }
      const tit = l.match(/^#{1,4}\s+(.*)$/);
      html += tit ? `<p><strong>${tit[1]}</strong></p>` : l.trim() ? `<p>${l}</p>` : '';
    }
    if (lista) html += '</ul>';
    return html;
  }

  function desenhar() {
    const box = el('chatMsgs');
    box.innerHTML = (apagada && !conversa.length ? `<div class="chat-desfazer">Conversa anterior apagada. <button class="chip" id="chatDesfazer">Desfazer</button></div>` : '') +
      (conversa.length ? '' : `<div class="chat-boas">Olá! Sou seu <strong>controller consultivo</strong>. Já estou vendo os números que você alimentou. Pergunte o que quiser ou comece por uma sugestão:</div>`) +
      conversa.map(m => `<div class="chat-msg ${m.role === 'user' ? 'eu' : 'ia'}">${m.role === 'user' ? esc(m.content).replace(/\n/g, '<br>') : (m.content ? formatar(m.content) : '<span class="muted">Analisando os números...</span>')}</div>`).join('');
    el('chatSug').innerHTML = conversa.length ? '' : SUGESTOES.map(s => `<button class="chip" data-sug="${esc(s)}">${esc(s)}</button>`).join('');
    box.scrollTop = box.scrollHeight;
  }

  /* ---------- enviar ---------- */
  async function enviar(texto) {
    texto = (texto || '').trim();
    if (!texto || ctl) return;
    el('chatTexto').value = '';
    conversa.push({ role: 'user', content: texto });
    const resp = { role: 'assistant', content: '' };
    conversa.push(resp);
    ctl = new AbortController();
    el('chatEnviar').hidden = true; el('chatParar').hidden = false;
    desenhar();
    try {
      const r = await fetch('api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contexto: contexto(), mensagens: conversa.slice(0, -1).slice(-20) }),
        signal: ctl.signal
      });
      if (!r.ok) {
        let code = r.status === 404 || r.status === 501 ? 'sem_servidor' : 'upstream_error';
        try { code = (await r.json()).code || code; } catch (e) { }
        throw { code };
      }
      const leitor = r.body.getReader(), dec = new TextDecoder();
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        resp.content += dec.decode(value, { stream: true });
        const ultima = el('chatMsgs').lastElementChild;
        if (ultima) ultima.innerHTML = formatar(resp.content);
        el('chatMsgs').scrollTop = el('chatMsgs').scrollHeight;
      }
      if (!resp.content.trim()) throw { code: 'upstream_error' };
    } catch (e) {
      if (e?.name === 'AbortError') { if (!resp.content) resp.content = '_(interrompido)_'; }
      else {
        const aviso = MSG[e?.code] || 'Não consegui responder agora. Tente de novo em instantes.';
        resp.content = resp.content ? resp.content + `\n\n_(${aviso})_` : `_${aviso}_`;
      }
    } finally {
      ctl = null;
      el('chatEnviar').hidden = false; el('chatParar').hidden = true;
      apagada = null;
      guardar();
      desenhar();
    }
  }

  /* ---------- abrir, fechar, aparecer ---------- */
  function abrir(sim) {
    if (aberto && !sim) avisarOndeEsta();
    aberto = sim;
    el('chatPainel').hidden = !sim;
    el('chatBtn').classList.toggle('aberto', sim);
    if (sim) { desenhar(); el('chatTexto').focus(); }
  }
  // Ao fechar, o botão pisca e mostra onde o chat continua disponível
  function avisarOndeEsta() {
    const b = el('chatBtn'), aviso = el('chatAviso');
    b.classList.remove('pulsa'); void b.offsetWidth; b.classList.add('pulsa');
    aviso.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => { aviso.hidden = true; }, 4500);
  }
  // Mostra o botão só depois que os dados foram alimentados neste modo
  function atualizar() {
    const pronto = !!D().alimentado;
    el('chatBtn').hidden = !pronto;
    el('chatTopo').hidden = !pronto;
    el('chatDica').hidden = pronto;
    if (!pronto && aberto) abrir(false);
  }

  function iniciar() {
    el('chatBtn').addEventListener('click', () => abrir(!aberto));
    el('chatFechar').addEventListener('click', () => abrir(false));
    el('chatTopo').addEventListener('click', () => abrir(true));
    el('chatAviso').addEventListener('click', () => { el('chatAviso').hidden = true; abrir(true); });
    el('chatNova').addEventListener('click', () => {
      ctl?.abort();
      if (conversa.length) apagada = conversa;
      conversa = []; guardar(); desenhar();
    });
    el('chatMsgs').addEventListener('click', e => {
      if (e.target.id === 'chatDesfazer' && apagada) { conversa = apagada; apagada = null; guardar(); desenhar(); }
    });
    el('chatParar').addEventListener('click', () => ctl?.abort());
    el('chatEnviar').addEventListener('click', () => enviar(el('chatTexto').value));
    el('chatTexto').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(el('chatTexto').value); }
    });
    el('chatSug').addEventListener('click', e => { const s = e.target.closest('[data-sug]'); if (s) enviar(s.dataset.sug); });
    atualizar();
  }

  return { iniciar, atualizar };
})();

CHAT.iniciar();
