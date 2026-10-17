/* Importar com IA: lê PDF, Word ou planilha e preenche a calculadora.
   O texto vai para o servidor (api/ler.js), que guarda a chave e conversa com o Claude. */
'use strict';

const IA = (() => {
  const CDN = {
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    xlsx: 'vendor/xlsx.full.min.js' // SheetJS 0.20.3 (a 0.18.5 do npm/cdnjs tem falhas conhecidas)
  };
  const LIMITE = 150000; // caracteres de texto enviados ao Claude
  let desfazer = null, ctl = null;

  const el = id => document.getElementById(id);
  const status = (html, cls = '') => { el('iaStatus').innerHTML = html ? `<div class="aviso ${cls}">${html}</div>` : ''; };
  const carregar = src => new Promise((ok, erro) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => erro(new Error('Não foi possível carregar ' + src));
    document.head.appendChild(s);
  });

  /* ---------- 1. extrair texto do arquivo ---------- */
  async function lerArquivo(file) {
    const nome = file.name.toLowerCase();
    if (nome.endsWith('.pdf')) {
      await carregar(CDN.pdf);
      pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
      const partes = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i);
        const c = await pg.getTextContent();
        partes.push(`--- Página ${i} ---\n` + c.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join(''));
      }
      return partes.join('\n');
    }
    if (nome.endsWith('.docx')) {
      await carregar(CDN.mammoth);
      const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return r.value;
    }
    if (/\.(xlsx|xlsm|xls|ods|csv)$/.test(nome)) {
      await carregar(CDN.xlsx);
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      return wb.SheetNames.map(n => `--- Aba "${n}" ---\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n], { FS: ';', blankrows: false })).join('\n\n');
    }
    if (/\.(txt|md)$/.test(nome)) return await file.text();
    throw new Error('Formato não suportado. Use PDF, Word (.docx), Excel (.xlsx/.xls), CSV ou TXT.');
  }

  /* ---------- 2. pedir ao servidor ---------- */
  async function perguntarClaude(texto, nome, extra) {
    const r = await fetch('api/ler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto, nome, extra }),
      signal: ctl.signal
    });
    let dados = null;
    try { dados = await r.json(); } catch (e) { }
    if (!r.ok) throw { code: dados?.code || (r.status === 404 || r.status === 501 ? 'sem_servidor' : 'upstream_error') };
    return dados;
  }

  const MSG = {
    sem_servidor: 'A leitura com IA só funciona na versão publicada (calculadora-de-pe.vercel.app).',
    sem_chave: 'A IA está desligada no momento (chave não configurada ou expirada). Avise o professor.',
    sem_credito: 'Os créditos da IA acabaram. Avise o professor.',
    rate_limited: 'Muitos pedidos em pouco tempo. Espere alguns minutos e tente de novo.',
    prompt_too_large: 'O documento é grande demais. Envie um arquivo menor ou só as páginas com números.',
    refused: 'O Claude não quis processar este documento. Tente outro arquivo.',
    invalid_json: 'A resposta veio incompleta. Clique em "Ler e preencher" de novo.',
    vazio: 'Não encontrei texto no arquivo. Se for um PDF escaneado (foto), exporte como texto ou planilha e tente de novo.'
  };

  /* ---------- 3. aplicar na ferramenta ---------- */
  const NOMES = {
    produto: 'Produto/serviço', un: 'Unidade', preco: 'Preço', cv: 'Custo variável', dvp: 'Despesas variáveis %', cfp: 'Custos fixos',
    df: 'Despesas fixas', naoDes: 'Não desembolsáveis', parc: 'Parcelas de empréstimo', lucroDes: 'Lucro desejado', volVend: 'Volume vendido', volProd: 'Volume produzido', cap: 'Capacidade',
    pDesc: 'Pedido: descrição', pq: 'Pedido: quantidade', pp: 'Pedido: preço', pcv: 'Pedido: custo variável', pdv: 'Pedido: desp. variáveis %',
    prat: 'Pedido: rateio', pinc: 'Pedido: gastos extras', pcan: 'Pedido: vendas perdidas',
    mkImp: 'Impostos %', mkCom: 'Comissões %', mkDF: 'Desp. fixas %', mkLuc: 'Lucro %', pMerc: 'Preço de mercado', metaMg: 'Margem desejada %',
    mixRec: 'Recurso escasso', mixH: 'Recurso disponível',
    rec: 'Receita bruta (mês)', cvT: 'Custos variáveis (mês)', dvT: 'Despesas variáveis (mês)'
  };
  const temValor = v => typeof v === 'string' && v.trim() !== '';

  function aplicar(r) {
    desfazer = clone(ST);
    const modo = r.modo === 'servicos' ? 'servicos' : 'produtos';
    ST.modo = modo;
    const alvo = ST[modo], antes = clone(alvo);
    const copia = grupo => Object.entries(grupo || {}).forEach(([k, v]) => {
      if (temValor(v) && k in NOMES) alvo[k] = v.trim();
    });
    copia(r.base); copia(r.pedido); copia(r.preco); copia({ mixRec: r.mixRec, mixH: r.mixH });
    const listas = [];
    if (Array.isArray(r.mix) && r.mix.length) { alvo.mix = r.mix.map(x => ({ nome: x.nome || 'Item', preco: x.preco || '0', cv: x.cv || '0', dvp: x.dvp || '0', dem: x.dem || '0', h: x.h || '0' })); listas.push(`${r.mix.length} itens no Mix`); }
    if (Array.isArray(r.abcP) && r.abcP.length) {
      alvo.abcP = r.abcP.map(x => ({ nome: x.nome || 'Item', vol: x.vol || '0', preco: x.preco || '0', cv: x.cv || '0', base: x.base || '0' }));
      listas.push(`${r.abcP.length} itens no ABC`);
    }
    const n = alvo.abcP.length;
    if (Array.isArray(r.abcA) && r.abcA.length) {
      alvo.abcA = r.abcA.map(a => ({ nome: a.nome || 'Atividade', custo: a.custo || '0', dir: a.dir || 'nº de ocorrências', q: Array.from({ length: n }, (_, j) => (a.q || [])[j] || '0') }));
      listas.push(`${r.abcA.length} atividades no ABC`);
    } else {
      alvo.abcA.forEach(a => { a.q = Array.from({ length: n }, (_, j) => a.q[j] || '0'); });
    }
    // Linhas da DRE: viram a tabela de classificação e definem os totais
    if (Array.isArray(r.linhas) && r.linhas.length) {
      alvo.linhas = r.linhas.filter(l => temValor(l.valor)).map(l => ({ d: l.descricao || 'Linha', v: l.valor.trim(), g: DRE.GRUPOS.includes(l.grupo) ? l.grupo : 'ignorar' }));
      alvo.forma = parse(alvo.volVend) > 0 && temValor(r.base?.volVend) ? 'unidade' : 'dre';
      DRE.sincronizar(alvo);
      listas.push(`${alvo.linhas.length} linhas classificadas`);
    }
    const mud = Object.keys(NOMES).filter(k => (antes[k] ?? '') !== (alvo[k] ?? '')).map(k => [NOMES[k], antes[k] ?? '', alvo[k]]);
    if (antes.forma !== alvo.forma) mud.unshift(['Forma de informar', antes.forma === 'dre' ? 'Totais do mês' : 'Por unidade', alvo.forma === 'dre' ? 'Totais do mês (DRE)' : 'Por unidade']);
    tudo();
    return { mud, listas, modo };
  }

  /* ---------- fluxo do botão ---------- */
  async function executar() {
    const file = el('iaArquivo').files[0];
    if (!file) { status('Escolha um arquivo primeiro.', 'alerta'); return; }
    ctl = new AbortController();
    el('iaIr').disabled = true; el('iaParar').hidden = false; el('iaResultado').innerHTML = '';
    try {
      status(`Lendo <strong>${esc(file.name)}</strong>...`);
      let texto = (await lerArquivo(file)).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      if (texto.length < 20) throw { code: 'vazio' };
      let avisoTam = '';
      if (texto.length > LIMITE) {
        avisoTam = `<p class="mini">Atenção: o documento tem ${num(texto.length)} caracteres; foram analisados só os primeiros ${num(LIMITE)}. Se faltar algo, envie só as páginas com os números.</p>`;
        texto = texto.slice(0, LIMITE);
      }
      status('O Claude está analisando o documento. Isso pode levar até um minuto...');
      const r = await perguntarClaude(texto, file.name, el('iaExtra').value.trim());
      if (!r || typeof r !== 'object') throw { code: 'invalid_json' };
      const { mud, listas, modo } = aplicar(r);
      status('');
      el('iaResultado').innerHTML = aviso(mud.length || listas.length ? 'ok' : 'alerta',
        `<strong>${mud.length || listas.length ? 'Pronto! Dados aplicados no modo ' + (modo === 'servicos' ? 'Serviços' : 'Produtos') + '.' : 'Nenhum número aproveitável foi encontrado.'}</strong> ${esc(r.resumo || '')}`) + avisoTam +
        (mud.length ? `<details><summary>Ver os ${mud.length} campos alterados</summary><table class="tab"><thead><tr><th>Campo</th><th>Antes</th><th>Agora</th></tr></thead><tbody>${mud.map(m => `<tr><td>${m[0]}</td><td>${esc(m[1])}</td><td><strong>${esc(m[2])}</strong></td></tr>`).join('')}</tbody></table></details>` : '') +
        (listas.length ? `<p class="mini">Também preenchido: ${listas.join(', ')}.</p>` : '') +
        `<p class="mini muted">Confira os valores: a IA pode errar ao interpretar o documento.</p><button class="btn mini" id="iaDesfazer">Desfazer importação</button>`;
    } catch (e) {
      if (e?.name === 'AbortError') status('Leitura interrompida.', 'alerta');
      else if (e instanceof Error) status(e.message.startsWith('Formato') ? esc(e.message) : 'Sem conexão com o servidor. Verifique a internet e tente de novo.', 'ruim');
      else status(MSG[e?.code] || 'Não foi possível concluir agora. Tente de novo em instantes.', 'ruim');
    } finally {
      el('iaIr').disabled = false; el('iaParar').hidden = true;
    }
  }

  function iniciar() {
    el('iaIr').addEventListener('click', executar);
    el('iaParar').addEventListener('click', () => ctl?.abort());
    el('iaResultado').addEventListener('click', e => {
      if (e.target.id === 'iaDesfazer' && desfazer) {
        ST = desfazer; desfazer = null; tudo();
        el('iaResultado').innerHTML = aviso('ok', 'Importação desfeita. Os valores anteriores voltaram.');
      }
    });
  }

  return { iniciar };
})();

IA.iniciar();
