/* Controller consultivo: chat flutuante que conversa sobre os dados da calculadora.
   Só aparece depois que a pessoa alimenta os dados (importação com IA ou digitação). */
'use strict';

const CHAT = (() => {
  // Perguntas iniciais escolhidas conforme a situação dos números
  function sugestoesIniciais() {
    const b = base(), d = D(), s = [];
    if (d.caso || d.resumoIA) s.push('Avalie este caso e diga o que você recomenda');
    s.push('Qual é o diagnóstico geral desses números?');
    if (b.mcu <= 0) s.push('Por que o preço não cobre nem o custo variável?');
    else if (b.lucro < 0) s.push('O que fazer para sair do prejuízo?');
    else if (b.ms < 0.2) s.push('Minha margem de segurança é baixa. O que fazer?');
    if (b.preco - b.cheio - b.dvu < 0 && b.mcu > 0) s.push('O custo cheio diz prejuízo. Devo parar de vender?');
    if (secaoUsavel('pedido')) s.push(`Devo aceitar ${isServ() ? 'a proposta' : 'o pedido'} especial?`);
    if (ok(b.ocup) && b.ocup < 0.75) s.push('Como aproveitar a capacidade ociosa?');
    s.push(isDRE() ? 'Qual faturamento mínimo preciso e por quê?' : 'Explique o ponto de equilíbrio com meus números');
    if (secaoUsavel('mix')) s.push('Qual produto devo priorizar no gargalo?');
    if (secaoUsavel('abc')) s.push('O que o custeio ABC revela que o rateio esconde?');
    s.push('Como posso melhorar a margem?', 'Onde estão os maiores riscos?');
    return [...new Set(s)].slice(0, 5);
  }
  // A IA termina cada resposta com "<<sugestoes>>" e 3 perguntas; aqui separamos texto e botões
  function separar(bruto) {
    const i = bruto.indexOf('<<sugest');
    if (i < 0) return { texto: bruto.replace(/<{1,2}[a-z]*$/i, ''), sug: [] };
    const sug = bruto.slice(i).split('\n').map(l => l.match(/^\s*[-*•]\s+(.+?)\s*$/)?.[1]).filter(Boolean).slice(0, 3);
    return { texto: bruto.slice(0, i).trimEnd(), sug };
  }
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
      ...(d.caso ? [`CASO DESCRITO PELO USUÁRIO (texto original):
${d.caso}`] : []),
      ...(d.resumoIA ? [`O QUE A IA ENTENDEU AO IMPORTAR: ${d.resumoIA}`] : []),
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
    // Abas vazias ou que ainda estão com os números de exemplo da ferramenta não entram como dados do caso
    const ignoradas = [];
    if (secaoUsavel('pedido')) partes.push(`PEDIDO/PROPOSTA ESPECIAL "${d.pDesc || ''}": quantidade ${d.pq}, preço ${d.pp}, custo variável ${d.pcv}, desp. variáveis ${d.pdv}%, rateio no relatório ${d.prat}, gastos extras ${d.pinc}, vendas perdidas ${d.pcan}
${tabela('#pedVar table')}
${textoDe('#pedEmpresa')}
Recomendação da ferramenta: ${textoDe('#pedRec')}`);
    else ignoradas.push('pedido especial');
    if (secaoUsavel('mix')) partes.push(`MIX E GARGALO (recurso escasso: ${d.mixRec}, disponível ${d.mixH}):\n${tabela('#resMix')}\n${textoDe('#resMixMsg')}`);
    else ignoradas.push('mix e gargalo');
    if (secaoUsavel('abc')) partes.push(`CUSTEIO ABC:\n${tabela('#resAbc')}\n${textoDe('#resAbcMsg')}`);
    else ignoradas.push('custeio ABC');
    if (!isDRE() && !secaoUsavel('preco')) ignoradas.push('formação de preço');
    if (!isDRE() && secaoUsavel('preco')) partes.push(`FORMAÇÃO DE PREÇO:\n${textoDe('#resMk')}\n${textoDe('#resMeta')}`);
    if (ignoradas.length) partes.push(`NÃO PREENCHIDO PELO USUÁRIO (vazio ou ainda com números de exemplo, por isso não enviado): ${ignoradas.join(', ')}. Se for útil para a pergunta, sugira preencher.`);
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
    // Botões de pergunta: iniciais, ou as continuações sugeridas na última resposta
    const ultima = conversa[conversa.length - 1];
    const feitas = new Set(conversa.filter(m => m.role === 'user').map(m => m.content));
    const reserva = () => sugestoesIniciais().filter(q => !feitas.has(q)).slice(0, 3);
    const sug = !conversa.length ? sugestoesIniciais()
      : (!ctl && ultima?.role === 'assistant' ? (ultima.sug?.length ? ultima.sug : reserva()) : []);
    el('chatSug').innerHTML = sug.map(s => `<button class="chip" data-sug="${esc(s)}">${esc(s)}</button>`).join('');
    box.scrollTop = box.scrollHeight;
  }

  /* ---------- conversa com o servidor ---------- */
  const historico = msgs => msgs.filter(m => m.content).slice(-20).map(m => ({ role: m.role, content: m.content }));
  async function lerResposta(r, aoReceber) {
    if (!r.ok) {
      let code = r.status === 404 || r.status === 501 ? 'sem_servidor' : 'upstream_error';
      try { code = (await r.json()).code || code; } catch (e) { }
      throw { code };
    }
    const leitor = r.body.getReader(), dec = new TextDecoder();
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      aoReceber(dec.decode(value, { stream: true }));
    }
  }

  /* ---------- insights da conversa (painel e PDF) ---------- */
  const CHAVE_INS = 'calcController.insights';
  let insights = null, ctlIns = null;
  try { insights = JSON.parse(localStorage.getItem(CHAVE_INS)); } catch (e) { insights = null; }

  function desenharInsights() {
    const tem = conversa.some(m => m.role === 'assistant' && m.content);
    el('insGerar').disabled = !tem || !!ctlIns;
    el('insGerar').textContent = insights?.texto ? 'Atualizar insights' : 'Gerar insights da conversa';
    el('insData').textContent = insights?.data ? 'gerado em ' + insights.data : '';
    if (ctlIns) return;
    el('insightsTexto').innerHTML = insights?.texto ? formatar(insights.texto)
      : `<p class="muted">${tem ? 'Clique em "Gerar insights da conversa" para resumir o que foi conversado com o Controller consultivo.' : 'Converse com o 💬 Controller consultivo (canto da tela) e depois gere aqui o resumo dos insights para exportar com o PDF.'}</p>`;
  }

  async function gerarInsights() {
    if (ctlIns) return;
    ctlIns = new AbortController();
    el('insGerar').disabled = true;
    el('insightsTexto').innerHTML = '<p class="muted">Resumindo a conversa...</p>';
    let texto = '';
    try {
      const r = await fetch('api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'insights', contexto: contexto(), mensagens: historico(conversa) }),
        signal: ctlIns.signal
      });
      await lerResposta(r, parte => { texto += parte; el('insightsTexto').innerHTML = formatar(texto); });
      if (!texto.trim()) throw { code: 'upstream_error' };
      insights = { texto, data: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) };
      try { localStorage.setItem(CHAVE_INS, JSON.stringify(insights)); } catch (e) { }
    } catch (e) {
      el('insightsTexto').innerHTML = `<p class="neg">${esc(MSG[e?.code] || 'Não consegui gerar os insights agora. Tente de novo em instantes.')}</p>`;
      ctlIns = null; desenharInsights();
      return;
    }
    ctlIns = null;
    desenharInsights();
  }

  // PDF: abre o Painel 360 com os insights (e, se marcado, a conversa completa) e chama a impressão
  function exportarPDF() {
    const comConversa = el('insConversa').checked;
    el('insConversaImp').innerHTML = comConversa && conversa.length
      ? `<h3>Conversa com o Controller consultivo</h3>` + conversa.filter(m => m.content).map(m =>
        `<div class="imp-msg"><strong>${m.role === 'user' ? 'Pergunta' : 'Controller'}:</strong> ${m.role === 'user' ? esc(m.content) : formatar(m.content)}</div>`).join('')
      : '';
    el('insConversaImp').classList.toggle('imprimir', comConversa);
    el('impData').textContent = 'Relatório gerado em ' + new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
    document.querySelector('[data-aba="painel"]').click();
    setTimeout(() => window.print(), 100);
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
        body: JSON.stringify({ contexto: contexto(), mensagens: historico(conversa.slice(0, -1)) }),
        signal: ctl.signal
      });
      let bruto = '';
      await lerResposta(r, parte => {
        bruto += parte;
        const { texto, sug } = separar(bruto);
        resp.content = texto; resp.sug = sug;
        const ultima = el('chatMsgs').lastElementChild;
        if (ultima && texto) ultima.innerHTML = formatar(texto);
        el('chatMsgs').scrollTop = el('chatMsgs').scrollHeight;
      });
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
      desenharInsights();
    }
  }

  /* ---------- abrir, fechar, aparecer ---------- */
  function abrir(sim) {
    if (aberto && !sim) avisarOndeEsta();
    aberto = sim;
    el('chatPainel').hidden = !sim;
    el('chatBtn').classList.toggle('aberto', sim);
    document.body.classList.toggle('chat-aberto', sim);
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
    el('insGerar').addEventListener('click', gerarInsights);
    el('insPDF').addEventListener('click', exportarPDF);
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
    desenharInsights();
  }

  // "Começar do zero": apaga conversa e insights e devolve uma função que desfaz
  function zerar() {
    ctl?.abort();
    const antes = { conversa, insights };
    conversa = []; insights = null; apagada = null;
    guardar();
    try { localStorage.removeItem(CHAVE_INS); } catch (e) { }
    desenhar(); desenharInsights();
    return () => {
      conversa = antes.conversa; insights = antes.insights; guardar();
      try { if (insights) localStorage.setItem(CHAVE_INS, JSON.stringify(insights)); } catch (e) { }
      desenhar(); desenharInsights();
    };
  }

  return { iniciar, atualizar, zerar };
})();

CHAT.iniciar();
