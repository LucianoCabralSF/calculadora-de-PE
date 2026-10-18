/* Slides: o mesmo roteiro alimenta o PowerPoint (.pptx) e o modo apresentação na tela.
   Os números vêm do que a calculadora já mostra; os títulos-mensagem podem ser escritos pela IA. */
'use strict';

const SLIDES = (() => {
  const PPTX_JS = 'vendor/pptxgen.bundle.js'; // PptxGenJS 3.12.0
  const COR = { pri: '1F3A5F', acento: 'C98A12', tx: '1D2330', muted: '5D6676', borda: 'DFE3EA', fundo: 'F4F5F7', creme: 'FDF6E7', ok: '1F7A4D', ruim: 'B42318', receita: '2C7A7B', custo: 'C0392B', fixo: '8A94A6' };
  const el = id => document.getElementById(id);
  const limpo = s => (s || '').replace(/\s+/g, ' ').trim();
  const cache = new Map();

  /* ---------- leitura do que está na tela ---------- */
  const kpisDe = sel => [...document.querySelectorAll(sel + ' .kpi')].map(k => [...k.children].map(c => limpo(c.textContent)));
  const tabelaDe = (sel, cols) => {
    const t = document.querySelector(sel);
    if (!t) return null;
    // Só cabeçalho e corpo (as notas do rodapé da tabela ficam de fora)
    const ler = trs => [...trs].map(tr => [...tr.children].map(c => limpo(c.textContent)))
      .filter(l => l.some(x => x)).map(l => cols ? cols.map(i => l[i] ?? '') : l);
    const cab = ler(t.querySelectorAll('thead tr'))[0] || null;
    const corpo = ler(t.querySelectorAll('tbody tr'));
    return corpo.length ? { cab, linhas: corpo.slice(0, 11) } : null;
  };
  const textoDe = sel => limpo(document.querySelector(sel)?.textContent);
  const avisosDe = sel => [...document.querySelectorAll(sel + ' .aviso')].map(a => limpo(a.textContent)).filter(Boolean);
  const semMd = s => (s || '').replace(/\*\*|__|`/g, '').replace(/(^|\s)_(.+?)_/g, '$1$2');
  function insightsGuardados() {
    let ins = null;
    try { ins = JSON.parse(localStorage.getItem('calcController.insights')); } catch (e) { }
    if (!ins?.texto) return null;
    return ins.texto.split(/^###\s+/m).map(b => b.trim()).filter(Boolean).map(b => {
      const [tit, ...resto] = b.split('\n');
      return { titulo: semMd(tit.trim()), itens: resto.map(l => l.match(/^\s*[-*•]\s+(.*)$/)?.[1]).filter(Boolean).map(semMd).slice(0, 4) };
    }).filter(s => s.itens.length);
  }

  /* ---------- roteiro ---------- */
  function roteiro() {
    const b = base(), d = D(), u = U(), us = plural(u);
    const data = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const nome = d.produto || 'Análise de custos e resultados';
    const S = [];
    const kpisPainel = kpisDe('#kpis360');
    S.push({
      id: 'capa', capa: true, secao: 'Calculadora do Controller', titulo: nome,
      sub: `${isServ() ? 'Serviços' : 'Produtos'} · ${isDRE() ? 'totais do mês (DRE)' : 'análise por ' + u} · ${data}`,
      dados: `Negócio: ${nome}. ` + kpisPainel.slice(0, 8).map(k => `${k[0]}: ${k[1]}`).join('; ')
    });
    S.push({
      id: 'numeros', secao: 'Números-chave', titulo: 'Os números do mês',
      kpis: kpisPainel.filter(k => !/^Preço/.test(k[0])).slice(0, 8),
      dados: kpisPainel.map(k => `${k[0]}: ${k[1]} (${k[2]})`).join('; ')
    });
    const leitura = [...document.querySelectorAll('#leituras360 li')].map(li => limpo(li.textContent));
    if (leitura.length) S.push({ id: 'leitura', secao: 'Leitura do Controller', titulo: 'O que os números dizem', itens: leitura, dados: leitura.join(' ') });
    if (d.linhas?.length) {
      const k = kpisDe('#resLinhas');
      S.push({ id: 'dre', secao: 'DRE classificada', titulo: 'A DRE separada em custos e despesas, fixos e variáveis', kpis: k.slice(0, 6), dados: k.map(x => `${x[0]}: ${x[1]} (${x[2]})`).join('; ') });
    }
    const tabUnit = tabelaDe('#tabUnit');
    const alertaAbs = avisosDe('#alertaAbs');
    S.push({
      id: 'absorcao', secao: 'Absorção x Variável', titulo: 'Custo cheio x margem de contribuição',
      tabela: tabUnit, destaque: alertaAbs[0],
      dados: (tabUnit ? tabUnit.linhas.map(l => l.join(': ')).join('; ') : '') + ' ' + alertaAbs.join(' ')
    });
    const kpisPE = kpisDe('#kpisPE');
    S.push({
      id: 'equilibrio', secao: 'Ponto de equilíbrio', titulo: 'Quanto é preciso vender para cobrir a estrutura',
      grafico: b.mcu > 0 && b.preco > 0 ? serieCVL(b) : null,
      kpis: kpisPE.filter(k => /PEC|Equilíbrio|IMC/.test(k[0])).slice(0, 4),
      dados: kpisPE.map(k => `${k[0]}: ${k[1]} (${k[2]})`).join('; ')
    });
    if (secaoUsavel('pedido')) {
      const emp = kpisDe('#pedEmpresa').slice(0, 3);
      const rec = avisosDe('#pedRec')[0];
      S.push({
        id: 'pedido', secao: isServ() ? 'Proposta especial' : 'Pedido especial', titulo: `Vale a pena aceitar ${isServ() ? 'a proposta' : 'o pedido'}?`,
        kpis: emp, tabela: tabelaDe('#pedVar table'), destaque: rec,
        dados: `${d.pDesc}. ` + emp.map(k => `${k[0]}: ${k[1]}`).join('; ') + '. Contábil: ' + textoDe('#pedAbs table') + '. ' + (rec || '')
      });
    }
    if (secaoUsavel('mix')) {
      const t = tabelaDe('#resMix'), msg = avisosDe('#resMixMsg')[0];
      S.push({ id: 'mix', secao: 'Mix e gargalo', titulo: 'Qual produto priorizar no recurso escasso', tabela: t, destaque: msg, dados: (t ? t.linhas.map(l => l.join(' | ')).join('; ') : '') + ' ' + (msg || '') });
    }
    if (secaoUsavel('abc')) {
      const t = tabelaDe('#resAbc', [0, 3, 4, 5, 6]), msgs = avisosDe('#resAbcMsg');
      S.push({ id: 'abc', secao: 'Custeio ABC', titulo: 'O que o ABC revela sobre a rentabilidade', tabela: t, destaque: msgs[0], dados: (t ? t.linhas.map(l => l.join(' | ')).join('; ') : '') + ' ' + msgs.join(' ') });
    }
    if (!isDRE() && secaoUsavel('preco')) {
      const mk = tabelaDe('#resMk table'), meta = tabelaDe('#resMeta table'), avs = [...avisosDe('#resMk'), ...avisosDe('#resMeta')];
      S.push({ id: 'preco', secao: 'Formação de preço', titulo: 'Preço pelo custo, pelo mercado e custo-meta', tabela: mk, tabela2: meta, destaque: avs[avs.length - 1], dados: [mk, meta].filter(Boolean).map(t => t.linhas.map(l => l.join(': ')).join('; ')).join(' | ') + ' ' + avs.join(' ') });
    }
    const ins = insightsGuardados();
    if (ins?.length) S.push({ id: 'insights', secao: 'Insights da conversa com o Controller', titulo: 'Conclusões e recomendações', blocos: ins, dados: ins.map(s => s.titulo + ': ' + s.itens.join(' ')).join(' | ') });
    return S;
  }

  // Pontos do gráfico custo-volume-lucro (mesma lógica do gráfico da tela)
  function serieCVL(b) {
    const xMax = Math.max(b.cap || 0, b.pee * 1.1, b.volVend * 1.1) || 1;
    const xs = Array.from({ length: 11 }, (_, i) => xMax * i / 10);
    const rot = xs.map(x => isDRE() ? 'R$ ' + num(x / 1000, 0) + ' mil' : num(x, 0));
    return {
      eixo: isDRE() ? 'receita do mês' : plural(U()) + ' por mês',
      series: [
        { name: 'Receita', labels: rot, values: xs.map(x => Math.round(b.preco * x)) },
        { name: 'Custo total', labels: rot, values: xs.map(x => Math.round(b.F + b.cvt * x)) },
        { name: 'Custos fixos', labels: rot, values: xs.map(() => Math.round(b.F)) }
      ]
    };
  }

  /* ---------- títulos pela IA ---------- */
  async function titulosIA(S) {
    const pedido = S.map(s => ({ id: s.id, secao: s.secao, dados: s.dados || '' }));
    const chave = JSON.stringify(pedido);
    if (cache.has(chave)) return cache.get(chave);
    const r = await fetch('api/titulos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slides: pedido }) });
    if (!r.ok) throw new Error('titulos');
    const { titulos } = await r.json();
    cache.set(chave, titulos || {});
    return titulos || {};
  }

  async function preparar(status) {
    const S = roteiro();
    if (el('slIA').checked) {
      status('A IA está escrevendo os títulos dos slides...');
      try {
        const t = await titulosIA(S);
        S.forEach(s => { if (t[s.id]) { if (s.capa) s.mensagem = t[s.id]; else s.titulo = t[s.id]; } });
      } catch (e) {
        status('Não consegui gerar os títulos com IA agora; os slides saem com títulos simples.', 'alerta');
        await new Promise(r => setTimeout(r, 1200));
      }
    }
    return S;
  }

  /* ---------- PowerPoint ---------- */
  const carregar = src => new Promise((ok, erro) => {
    if (window.PptxGenJS) return ok();
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => erro(new Error('carregar'));
    document.head.appendChild(s);
  });

  async function exportarPptx() {
    const status = (t, cls = '') => { el('slStatus').innerHTML = t ? `<div class="aviso ${cls}">${esc(t)}</div>` : ''; };
    el('slPptx').disabled = true;
    try {
      const [S] = await Promise.all([preparar(status), carregar(PPTX_JS)]);
      status('Montando o arquivo PowerPoint...');
      const p = new PptxGenJS();
      p.layout = 'LAYOUT_WIDE'; // 13,33 x 7,5 pol
      p.title = S[0].titulo;
      const F = 'Calibri', total = S.length;
      S.forEach((s, i) => desenharPptx(p, s, i + 1, total, F));
      const arq = ('analise-' + (D().produto || 'controller')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/-$/, '').toLowerCase().slice(0, 60);
      await p.writeFile({ fileName: arq + '.pptx' });
      status('Arquivo .pptx gerado. Ele abre no PowerPoint, Google Slides ou Keynote e pode ser editado.', 'ok');
    } catch (e) {
      status('Não consegui gerar o arquivo agora. Verifique a internet e tente de novo.', 'ruim');
    } finally {
      el('slPptx').disabled = false;
    }
  }

  function desenharPptx(p, s, n, total, F) {
    const sl = p.addSlide();
    if (s.capa) {
      sl.background = { color: COR.pri };
      sl.addShape(p.ShapeType.rect, { x: 0.8, y: 2.2, w: 1.2, h: 0.08, fill: { color: COR.acento }, line: { color: COR.acento } });
      sl.addText(s.secao.toUpperCase(), { x: 0.8, y: 1.6, w: 11, h: 0.5, fontFace: F, fontSize: 14, color: COR.acento, bold: true, charSpacing: 2 });
      sl.addText(s.titulo, { x: 0.8, y: 2.5, w: 11.7, h: 1.6, fontFace: F, fontSize: 40, color: 'FFFFFF', bold: true, valign: 'top' });
      if (s.mensagem) sl.addText(s.mensagem, { x: 0.8, y: 4.2, w: 11.7, h: 1, fontFace: F, fontSize: 20, color: 'E8EEF5', valign: 'top' });
      sl.addText(s.sub, { x: 0.8, y: 6.4, w: 11.7, h: 0.5, fontFace: F, fontSize: 14, color: 'C8D3E0' });
      return;
    }
    sl.background = { color: 'FFFFFF' };
    sl.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: COR.pri }, line: { color: COR.pri } });
    sl.addText(s.secao.toUpperCase(), { x: 0.6, y: 0.35, w: 12, h: 0.35, fontFace: F, fontSize: 12, color: COR.acento, bold: true, charSpacing: 1 });
    sl.addText(s.titulo, { x: 0.6, y: 0.7, w: 12.1, h: 0.95, fontFace: F, fontSize: 24, color: COR.pri, bold: true, valign: 'top', fit: 'shrink' });
    sl.addText(`Calculadora do Controller · ${D().produto || ''}`, { x: 0.6, y: 7.0, w: 9, h: 0.3, fontFace: F, fontSize: 10, color: COR.muted });
    sl.addText(`${n} / ${total}`, { x: 11.7, y: 7.0, w: 1, h: 0.3, fontFace: F, fontSize: 10, color: COR.muted, align: 'right' });

    let y = 1.85;
    const X = 0.6, W = 12.1;
    const cards = (lista, x, yy, w, porLinha, h = 1.05) => {
      const gap = 0.18, cw = (w - gap * (porLinha - 1)) / porLinha;
      lista.forEach((k, i) => {
        const cx = x + (i % porLinha) * (cw + gap), cy = yy + Math.floor(i / porLinha) * (h + gap);
        sl.addShape(p.ShapeType.roundRect, { x: cx, y: cy, w: cw, h, fill: { color: COR.fundo }, line: { color: COR.borda, width: 0.75 }, rectRadius: 0.08 });
        sl.addText(k[0], { x: cx + 0.12, y: cy + 0.06, w: cw - 0.24, h: 0.3, fontFace: F, fontSize: 10, color: COR.muted, fit: 'shrink' });
        sl.addText(k[1], { x: cx + 0.12, y: cy + 0.32, w: cw - 0.24, h: 0.42, fontFace: F, fontSize: 18, bold: true, color: /^-|prejuízo/.test(k[1]) ? COR.ruim : COR.pri, fit: 'shrink' });
        if (k[2]) sl.addText(k[2], { x: cx + 0.12, y: cy + 0.72, w: cw - 0.24, h: 0.28, fontFace: F, fontSize: 9, color: COR.muted, fit: 'shrink' });
      });
      return yy + Math.ceil(lista.length / porLinha) * (h + gap);
    };
    const tabela = (t, x, yy, w) => {
      const rows = [...(t.cab ? [t.cab.map(c => ({ text: c, options: { bold: true, color: COR.muted, fill: { color: 'F1F3F7' } } }))] : []),
        ...t.linhas.map(l => l.map((c, j) => ({ text: c, options: { align: j ? 'right' : 'left', color: /^-R\$/.test(c) ? COR.ruim : COR.tx, bold: /^=/.test(l[0]) } })))];
      sl.addTable(rows, { x, y: yy, w, fontFace: F, fontSize: t.linhas.length > 8 ? 9 : 11, border: { type: 'solid', pt: 0.5, color: COR.borda }, valign: 'middle', autoPage: false });
    };
    const destaque = (txt, x, yy, w, hMax) => {
      const h = Math.min(hMax, Math.max(1.1, 0.45 + Math.ceil(txt.length / (w * 11)) * 0.26)); // altura acompanha o texto
      sl.addShape(p.ShapeType.rect, { x, y: yy, w, h, fill: { color: COR.creme }, line: { color: 'F0DCAE', width: 0.75 } });
      sl.addShape(p.ShapeType.rect, { x, y: yy, w: 0.07, h, fill: { color: COR.acento }, line: { color: COR.acento } });
      sl.addText(txt, { x: x + 0.2, y: yy + 0.1, w: w - 0.3, h: h - 0.2, fontFace: F, fontSize: 13, color: COR.tx, valign: 'top', fit: 'shrink' });
    };

    if (s.grafico) {
      sl.addChart(p.ChartType.line, s.grafico.series, {
        x: X, y, w: 7.6, h: 4.9, chartColors: [COR.receita, COR.custo, COR.fixo], lineSize: 2, lineDataSymbol: 'none',
        showLegend: true, legendPos: 'b', legendFontSize: 11, catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
        valAxisLabelFormatCode: '#,##0', showCatAxisTitle: true, catAxisTitle: s.grafico.eixo, catAxisTitleFontSize: 10, catAxisTitleColor: COR.muted
      });
      cards(s.kpis || [], X + 7.9, y, 4.2, 1, 0.9);
      return;
    }
    if (s.blocos) {
      const col = s.blocos.length > 2 ? 2 : 1, bw = (W - 0.3 * (col - 1)) / col;
      s.blocos.slice(0, 4).forEach((bl, i) => {
        const bx = X + (i % col) * (bw + 0.3), by = y + Math.floor(i / col) * 2.55;
        sl.addText(bl.titulo, { x: bx, y: by, w: bw, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: COR.pri });
        sl.addText(bl.itens.map(t => ({ text: t, options: { bullet: true } })), { x: bx, y: by + 0.38, w: bw, h: 2.05, fontFace: F, fontSize: 11, color: COR.tx, valign: 'top', fit: 'shrink', paraSpaceAfter: 4 });
      });
      return;
    }
    if (s.itens) {
      sl.addText(s.itens.map(t => ({ text: t, options: { bullet: true } })), { x: X, y, w: W, h: 4.9, fontFace: F, fontSize: 16, color: COR.tx, valign: 'top', fit: 'shrink', paraSpaceAfter: 10 });
      return;
    }
    if (s.kpis?.length) y = cards(s.kpis, X, y, W, Math.min(4, s.kpis.length)) + 0.1;
    const resta = 6.8 - y;
    if (s.tabela && (s.destaque || s.tabela2)) {
      tabela(s.tabela, X, y, 7.4);
      if (s.tabela2) tabela(s.tabela2, X + 7.7, y, 4.4);
      if (s.destaque) destaque(s.destaque, X + 7.7, s.tabela2 ? y + 2.9 : y, 4.4, s.tabela2 ? Math.max(1.2, resta - 2.9) : Math.min(resta, 3.6));
    } else if (s.tabela) tabela(s.tabela, X, y, W);
    else if (s.destaque) destaque(s.destaque, X, y, W, Math.min(resta, 1.6));
  }

  /* ---------- modo apresentação ---------- */
  let atual = 0, lista = [];
  function htmlSlide(s, n, total) {
    if (s.capa) return `<div class="ap-slide capa"><div class="ap-kicker">${esc(s.secao)}</div><div class="ap-barra"></div><h1>${esc(s.titulo)}</h1>${s.mensagem ? `<p class="ap-msg">${esc(s.mensagem)}</p>` : ''}<p class="ap-sub">${esc(s.sub)}</p></div>`;
    const cards = ks => `<div class="ap-kpis n${Math.min(4, ks.length)}">${ks.map(k => `<div class="ap-kpi"><span>${esc(k[0])}</span><b class="${/^-|prejuízo/.test(k[1]) ? 'neg' : ''}">${esc(k[1])}</b>${k[2] ? `<small>${esc(k[2])}</small>` : ''}</div>`).join('')}</div>`;
    const tab = t => `<table class="ap-tab">${t.cab ? `<thead><tr>${t.cab.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>` : ''}<tbody>${t.linhas.map(l => `<tr class="${/^=/.test(l[0]) ? 'tot' : ''}">${l.map(c => `<td class="${/^-R\$/.test(c) ? 'neg' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    let corpo = '';
    if (s.grafico) corpo = `<div class="ap-duas g"><div class="ap-graf">${document.getElementById('graficoCVL').innerHTML}</div>${cards(s.kpis || []).replace('ap-kpis', 'ap-kpis col')}</div>`;
    else if (s.blocos) corpo = `<div class="ap-blocos">${s.blocos.slice(0, 4).map(bl => `<div><h3>${esc(bl.titulo)}</h3><ul>${bl.itens.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}</div>`;
    else if (s.itens) corpo = `<ul class="ap-itens">${s.itens.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
    else {
      if (s.kpis?.length) corpo += cards(s.kpis);
      const lado = [s.tabela2 ? tab(s.tabela2) : '', s.destaque ? `<div class="ap-dest">${esc(s.destaque)}</div>` : ''].join('');
      if (s.tabela) corpo += lado ? `<div class="ap-duas">${tab(s.tabela)}<div>${lado}</div></div>` : tab(s.tabela);
      else corpo += lado;
    }
    return `<div class="ap-slide"><div class="ap-faixa"></div><div class="ap-kicker">${esc(s.secao)}</div><h2>${esc(s.titulo)}</h2><div class="ap-corpo">${corpo}</div><div class="ap-rodape"><span>Calculadora do Controller · ${esc(D().produto || '')}</span><span>${n} / ${total}</span></div></div>`;
  }
  function mostrar() {
    el('apPalco').innerHTML = htmlSlide(lista[atual], atual + 1, lista.length);
    el('apContador').textContent = `${atual + 1} / ${lista.length}`;
    ajustar();
  }
  function ajustar() {
    const s = el('apPalco').firstElementChild;
    if (!s) return;
    const w = Math.min(innerWidth - 32, (innerHeight - 70) * 16 / 9);
    s.style.width = w + 'px'; s.style.height = (w * 9 / 16) + 'px'; s.style.fontSize = (w / 64) + 'px';
  }
  const ir = d => { atual = Math.max(0, Math.min(lista.length - 1, atual + d)); mostrar(); };
  function fechar() {
    el('apresentacao').hidden = true;
    document.removeEventListener('keydown', teclas);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
  }
  function teclas(e) {
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); ir(1); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); ir(-1); }
    else if (e.key === 'Home') { atual = 0; mostrar(); }
    else if (e.key === 'End') { atual = lista.length - 1; mostrar(); }
    else if (e.key === 'Escape') fechar();
  }
  async function apresentar() {
    const status = (t, cls = '') => { el('slStatus').innerHTML = t ? `<div class="aviso ${cls}">${esc(t)}</div>` : ''; };
    el('slApresentar').disabled = true;
    try {
      lista = await preparar(status);
      status('');
      atual = 0;
      el('apresentacao').hidden = false;
      document.addEventListener('keydown', teclas);
      el('apresentacao').requestFullscreen?.().catch(() => { });
      mostrar();
    } finally {
      el('slApresentar').disabled = false;
    }
  }

  function iniciar() {
    el('slPptx').addEventListener('click', exportarPptx);
    el('slApresentar').addEventListener('click', apresentar);
    // Atalhos no topo da página: levam ao Painel (onde aparecem as mensagens de andamento) e disparam a mesma ação
    const noPainel = () => { document.querySelector('[data-aba="painel"]').click(); el('cardInsights').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    el('hdApresentar').addEventListener('click', () => { noPainel(); apresentar(); });
    el('hdPptx').addEventListener('click', () => { noPainel(); exportarPptx(); });
    el('apAnt').addEventListener('click', () => ir(-1));
    el('apProx').addEventListener('click', () => ir(1));
    el('apFechar').addEventListener('click', fechar);
    el('apPalco').addEventListener('click', e => ir(e.clientX > innerWidth / 2 ? 1 : -1));
    addEventListener('resize', () => { if (!el('apresentacao').hidden) ajustar(); });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && !el('apresentacao').hidden) ajustar(); });
  }

  return { iniciar, roteiro };
})();

SLIDES.iniciar();
