/* Importar com IA: lê PDF, Word ou planilha e preenche a calculadora */
'use strict';

const IA = (() => {
  const CDN = {
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    sdk: 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm'
  };
  const LIMITE = 150000; // caracteres de texto enviados ao Claude
  const CHAVE_API = 'calcController.apiKey';
  let sample = null, desfazer = null;

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
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
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

  /* ---------- 2. o que o Claude deve devolver ---------- */
  const S = { type: 'string' };
  const obj = props => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
  const campos = ks => obj(Object.fromEntries(ks.map(k => [k, S])));
  const SCHEMA = obj({
    modo: { type: 'string', enum: ['produtos', 'servicos'] },
    resumo: S,
    base: campos(['produto', 'un', 'preco', 'cv', 'dvp', 'cfp', 'df', 'naoDes', 'lucroDes', 'volVend', 'volProd', 'cap']),
    pedido: campos(['pDesc', 'pq', 'pp', 'pcv', 'pdv', 'prat', 'pinc', 'pcan']),
    preco: campos(['mkImp', 'mkCom', 'mkDF', 'mkLuc', 'pMerc', 'metaMg']),
    mixRec: S, mixH: S,
    mix: { type: 'array', items: campos(['nome', 'preco', 'cv', 'dvp', 'dem', 'h']) },
    abcP: { type: 'array', items: campos(['nome', 'vol', 'preco', 'cv', 'base']) },
    abcA: { type: 'array', items: obj({ nome: S, custo: S, dir: S, q: { type: 'array', items: S } }) }
  });

  function montarPrompt(texto, nomeArq, extra) {
    return `Você é um controller experiente. Leia o documento abaixo (arquivo "${nomeArq}") e extraia os dados para uma calculadora de custos e formação de preço.

CONCEITOS (use para classificar):
- Custo = gasto da produção ou da entrega do serviço. Despesa = vender, administrar, manter a estrutura. Investimento = ativado no balanço (não entra como custo do mês, só a depreciação). Perda = anormal (ignore).
- Variável = muda com o volume (matéria-prima, embalagem, insumos, profissional pago por hora/projeto). Fixo = não muda com o volume (aluguel, salários fixos, depreciação, sistemas).
- Despesas variáveis (impostos sobre venda, comissões, fretes) vão como % do preço.
- Não desembolsáveis = depreciação e amortização (fazem parte dos fixos).

CAMPOS:
- modo: "produtos" (indústria/comércio) ou "servicos".
- base.produto: nome do produto/serviço analisado; base.un: unidade de venda (litro, unidade, hora, projeto...).
- base.preco: preço de venda por unidade; base.cv: custo variável por unidade; base.dvp: despesas variáveis em % do preço.
- base.cfp: custos fixos de produção/operação por MÊS; base.df: despesas fixas administrativas/comerciais por MÊS; base.naoDes: parte dos fixos que é depreciação/amortização por MÊS; base.lucroDes: lucro desejado por MÊS.
- base.volVend: volume vendido por mês; base.volProd: volume produzido por mês (em serviços, igual ao vendido); base.cap: capacidade máxima por mês.
- pedido.*: só se o documento trouxer um pedido/proposta especial: pDesc descrição, pq quantidade, pp preço oferecido por unidade, pcv custo variável por unidade do item, pdv despesas variáveis %, prat rateio de fixos por unidade que o relatório contábil mostra, pinc gastos extras só desse pedido (R$), pcan vendas normais que se perderiam (unidades).
- preco.*: mkImp impostos %, mkCom comissões e fretes %, mkDF despesas fixas % da receita, mkLuc lucro desejado % do preço, pMerc preço aceito pelo mercado/concorrência, metaMg margem desejada %.
- mix: lista de produtos/serviços com nome, preco, cv (custo variável), dvp (%), dem (demanda máxima por mês) e h (consumo do recurso escasso por unidade); mixRec: nome do recurso escasso (ex.: horas de máquina); mixH: quantidade disponível por mês.
- abcP: produtos/serviços para custeio ABC com nome, vol (volume por mês), preco, cv, base (horas de mão de obra direta por unidade).
- abcA: atividades indiretas com nome, custo (R$ por mês), dir (direcionador, ex.: "nº de setups") e q (quantidade do direcionador consumida por cada item de abcP, na mesma ordem).

REGRAS:
- Valores mensais: se vierem anuais, divida por 12 e diga isso no resumo.
- Números em formato brasileiro, SEM separador de milhar: "300000", "12,50". Percentuais sem o símbolo: "15" para 15%.
- Se um dado não estiver no documento e não puder ser calculado com segurança a partir dele, deixe "" (texto vazio). Nunca invente. Listas sem dados ficam [].
- Se o documento tiver vários produtos, use a média ponderada ou o principal na base e coloque todos em mix/abcP quando houver dados.
- resumo: em português simples, 3 a 6 frases: o que foi encontrado, contas que você fez (ex.: anual ÷ 12, soma de itens) e o que ficou faltando.
${extra ? `\nINSTRUÇÃO DO USUÁRIO: ${extra}\n` : ''}
Responda somente com o JSON, sem texto antes ou depois.

DOCUMENTO:
<<<
${texto}
>>>`;
  }

  /* ---------- 3. chamar o Claude ---------- */
  async function perguntarClaude(prompt, ctl) {
    if (sample) return sample.json(prompt, { signal: ctl.signal, modelTier: 'default' });
    let chave = '';
    try { chave = localStorage.getItem(CHAVE_API) || ''; } catch (e) { }
    chave = chave || el('iaChave').value.trim();
    if (!chave) throw { code: 'sem_chave' };
    const { default: Anthropic } = await import(CDN.sdk);
    const client = new Anthropic({ apiKey: chave, dangerouslyAllowBrowser: true });
    const resp = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: prompt }]
    }, { signal: ctl.signal });
    if (resp.stop_reason === 'refusal') throw { code: 'refused' };
    if (resp.stop_reason === 'max_tokens') throw { code: 'invalid_json' };
    const txt = resp.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return JSON.parse(txt);
  }

  const MSG = {
    sem_chave: 'Cole a chave da API da Anthropic no campo acima para usar a IA fora do claude.ai.',
    not_granted: 'O uso do Claude não foi autorizado nesta página.',
    sampling_disabled: 'O Claude não está disponível para esta conta.',
    rate_limited: 'Muitos pedidos em pouco tempo ou limite de uso atingido. Tente de novo daqui a pouco.',
    prompt_too_large: 'O documento é grande demais. Envie um arquivo menor ou só as páginas com números.',
    refused: 'O Claude não quis processar este documento. Tente outro arquivo.',
    invalid_json: 'A resposta veio incompleta. Clique em "Ler e preencher" de novo.',
    session_expired: 'Sua sessão no Claude expirou. Entre de novo e tente outra vez.'
  };
  const msgErro = e => {
    if (e?.status === 401) return 'Chave da API inválida. Confira a chave e tente de novo.';
    if (e?.status === 429) return MSG.rate_limited;
    if (e?.status === 400 && /credit/i.test(e?.message || '')) return 'A conta da API está sem créditos.';
    return MSG[e?.code] || `Não foi possível concluir (${esc(e?.code || e?.message || 'erro desconhecido')}).`;
  };

  /* ---------- 4. aplicar na ferramenta ---------- */
  const NOMES = {
    produto: 'Produto/serviço', un: 'Unidade', preco: 'Preço', cv: 'Custo variável', dvp: 'Despesas variáveis %', cfp: 'Custos fixos',
    df: 'Despesas fixas', naoDes: 'Não desembolsáveis', lucroDes: 'Lucro desejado', volVend: 'Volume vendido', volProd: 'Volume produzido', cap: 'Capacidade',
    pDesc: 'Pedido: descrição', pq: 'Pedido: quantidade', pp: 'Pedido: preço', pcv: 'Pedido: custo variável', pdv: 'Pedido: desp. variáveis %',
    prat: 'Pedido: rateio', pinc: 'Pedido: gastos extras', pcan: 'Pedido: vendas perdidas',
    mkImp: 'Impostos %', mkCom: 'Comissões %', mkDF: 'Desp. fixas %', mkLuc: 'Lucro %', pMerc: 'Preço de mercado', metaMg: 'Margem desejada %',
    mixRec: 'Recurso escasso', mixH: 'Recurso disponível'
  };
  const temValor = v => typeof v === 'string' && v.trim() !== '';

  function aplicar(r) {
    desfazer = clone(ST);
    const modo = r.modo === 'servicos' ? 'servicos' : 'produtos';
    ST.modo = modo;
    const alvo = ST[modo], mud = [];
    const copia = grupo => Object.entries(grupo || {}).forEach(([k, v]) => {
      if (temValor(v) && k in NOMES) { mud.push([NOMES[k], alvo[k], v.trim()]); alvo[k] = v.trim(); }
    });
    copia(r.base); copia(r.pedido); copia(r.preco); copia({ mixRec: r.mixRec, mixH: r.mixH });
    const listas = [];
    if (Array.isArray(r.mix) && r.mix.length) { alvo.mix = r.mix.map(x => ({ nome: x.nome || 'Item', preco: x.preco || '0', cv: x.cv || '0', dvp: x.dvp || '0', dem: x.dem || '0', h: x.h || '0' })); listas.push(`${r.mix.length} itens no Mix`); }
    if (Array.isArray(r.abcP) && r.abcP.length) {
      alvo.abcP = r.abcP.map(x => ({ nome: x.nome || 'Item', vol: x.vol || '0', preco: x.preco || '0', cv: x.cv || '0', base: x.base || '0' }));
      listas.push(`${r.abcP.length} itens no ABC`);
    }
    if (Array.isArray(r.abcA) && r.abcA.length) {
      const n = alvo.abcP.length;
      alvo.abcA = r.abcA.map(a => ({ nome: a.nome || 'Atividade', custo: a.custo || '0', dir: a.dir || 'nº de ocorrências', q: Array.from({ length: n }, (_, j) => (a.q || [])[j] || '0') }));
      listas.push(`${r.abcA.length} atividades no ABC`);
    } else if (listas.some(l => l.includes('ABC'))) {
      alvo.abcA.forEach(a => { a.q = Array.from({ length: alvo.abcP.length }, (_, j) => a.q[j] || '0'); });
    }
    tudo();
    return { mud, listas, modo };
  }

  /* ---------- fluxo do botão ---------- */
  let ctl = null;
  async function executar() {
    const file = el('iaArquivo').files[0];
    if (!file) { status('Escolha um arquivo primeiro.', 'alerta'); return; }
    if (!sample) {
      const k = el('iaChave').value.trim();
      if (k) { try { localStorage.setItem(CHAVE_API, k); } catch (e) { } }
    }
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
      const r = await perguntarClaude(montarPrompt(texto, file.name, el('iaExtra').value.trim()), ctl);
      if (!r || typeof r !== 'object') throw { code: 'invalid_json' };
      const { mud, listas, modo } = aplicar(r);
      status('');
      el('iaResultado').innerHTML = aviso(mud.length || listas.length ? 'ok' : 'alerta',
        `<strong>${mud.length || listas.length ? 'Pronto! Dados aplicados no modo ' + (modo === 'servicos' ? 'Serviços' : 'Produtos') + '.' : 'Nenhum número aproveitável foi encontrado.'}</strong> ${esc(r.resumo || '')}`) + avisoTam +
        (mud.length ? `<details><summary>Ver os ${mud.length} campos alterados</summary><table class="tab"><thead><tr><th>Campo</th><th>Antes</th><th>Agora</th></tr></thead><tbody>${mud.map(m => `<tr><td>${m[0]}</td><td>${esc(m[1])}</td><td><strong>${esc(m[2])}</strong></td></tr>`).join('')}</tbody></table></details>` : '') +
        (listas.length ? `<p class="mini">Também preenchido: ${listas.join(', ')}.</p>` : '') +
        `<p class="mini muted">Confira os valores: a IA pode errar ao interpretar o documento.</p><button class="btn mini" id="iaDesfazer">Desfazer importação</button>`;
    } catch (e) {
      if (e?.code === 'cancelled' || e?.name === 'AbortError') status('Leitura interrompida.', 'alerta');
      else if (e?.code === 'vazio') status('Não encontrei texto no arquivo. Se for um PDF escaneado (foto), exporte como texto ou planilha e tente de novo.', 'ruim');
      else if (e instanceof Error && !e.status) status(esc(e.message), 'ruim');
      else status(msgErro(e), 'ruim');
    } finally {
      el('iaIr').disabled = false; el('iaParar').hidden = true;
    }
  }

  async function iniciar() {
    el('iaIr').addEventListener('click', executar);
    el('iaParar').addEventListener('click', () => ctl?.abort());
    el('iaResultado').addEventListener('click', e => {
      if (e.target.id === 'iaDesfazer' && desfazer) {
        ST = desfazer; desfazer = null; tudo();
        el('iaResultado').innerHTML = aviso('ok', 'Importação desfeita. Os valores anteriores voltaram.');
      }
    });
    el('iaEsquecer').addEventListener('click', () => {
      try { localStorage.removeItem(CHAVE_API); } catch (e) { }
      el('iaChave').value = ''; status('Chave apagada deste navegador.', 'ok');
    });
    let salva = '';
    try { salva = localStorage.getItem(CHAVE_API) || ''; } catch (e) { }
    if (salva) el('iaChave').placeholder = 'chave salva neste navegador';
    // Dentro do claude.ai a IA usa a conta Claude de quem abre; fora dele, pede a chave da API.
    if (window.claude?.use) {
      el('iaModo').textContent = 'Conectando ao Claude...';
      try { sample = await window.claude.use('sample'); } catch (e) { sample = null; }
    }
    el('iaChaveBox').hidden = !!sample;
    el('iaModo').textContent = sample
      ? 'Usando a sua conta Claude (será pedida autorização no primeiro uso).'
      : 'Fora do claude.ai: informe uma chave da API da Anthropic (fica salva só neste navegador).';
  }

  return { iniciar };
})();

IA.iniciar();
