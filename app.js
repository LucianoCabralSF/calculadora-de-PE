/* Calculadora do Controller — custos, custeio e preço para produtos e serviços */
'use strict';

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const ok = v => typeof v === 'number' && isFinite(v);
const brl = v => ok(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const num = (v, d = 0) => ok(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const pct = (v, d = 1) => ok(v) ? (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%' : '—';
const sinal = v => ok(v) ? `<span class="${v >= 0 ? 'pos' : 'neg'}">${brl(v)}</span>` : '—';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Aceita "300.000", "300000", "12,50", "1.234,56", "R$ 8"
function parse(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').replace(/[R$\s%]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return isFinite(n) ? n : 0;
}
const plural = u => /[aeiou]$/i.test(u) ? u + 's' : /m$/i.test(u) ? u.slice(0, -1) + 'ns' : /[rz]$/i.test(u) ? u + 'es' : u;

/* ---------- exemplos de cada modo ---------- */
const EXEMPLOS = {
  produtos: {
    produto: 'Linha clássica (média)', un: 'litro', preco: '12', cv: '5', dvp: '0',
    cfp: '300.000', df: '0', naoDes: '40.000', parc: '0', lucroDes: '50.000',
    volVend: '60.000', volProd: '60.000', cap: '120.000', desc: '10',
    pDesc: 'Chopp Pilsen — festival da rede de supermercados', pq: '10.000', pp: '8', pcv: '5', pdv: '0', prat: '5', pinc: '0', pcan: '0',
    chk: { marca: true, precedente: true, avista: true },
    mixRec: 'horas de tanque', mixH: '900',
    mix: [
      { nome: 'Pilsen', preco: '8', cv: '5', dvp: '0', dem: '30.000', h: '0,010' },
      { nome: 'IPA', preco: '16', cv: '7', dvp: '0', dem: '20.000', h: '0,025' },
      { nome: 'Stout com café', preco: '18', cv: '8', dvp: '0', dem: '10.000', h: '0,030' },
      { nome: 'Envelhecida em barril', preco: '30', cv: '12', dvp: '0', dem: '3.000', h: '0,080' }
    ],
    abcP: [
      { nome: 'Pilsen', vol: '40.000', preco: '8', cv: '5', base: '0,010' },
      { nome: 'IPA', vol: '15.000', preco: '16', cv: '7', base: '0,012' },
      { nome: 'Envelhecida em barril', vol: '2.000', preco: '30', cv: '12', base: '0,015' }
    ],
    abcA: [
      { nome: 'Setup de brassagem', custo: '60.000', dir: 'nº de setups', q: ['10', '15', '25'] },
      { nome: 'Inspeção de qualidade', custo: '40.000', dir: 'nº de inspeções', q: ['20', '30', '50'] },
      { nome: 'Compras de insumos especiais', custo: '30.000', dir: 'nº de pedidos de compra', q: ['5', '10', '25'] },
      { nome: 'Manuseio de barris / envelhecimento', custo: '50.000', dir: 'horas de manuseio', q: ['0', '0', '500'] },
      { nome: 'Envase', custo: '70.000', dir: 'nº de lotes envasados', q: ['40', '15', '5'] }
    ],
    mkBase: 'cheio', mkImp: '15', mkCom: '3', mkDF: '5', mkLuc: '12', pMerc: '15', metaMg: '12'
  },
  servicos: {
    produto: 'Consultoria (hora técnica)', un: 'hora', preco: '180', cv: '60', dvp: '10',
    cfp: '90.000', df: '30.000', naoDes: '5.000', parc: '0', lucroDes: '25.000',
    volVend: '1.400', volProd: '1.400', cap: '2.000', desc: '10',
    pDesc: 'Projeto pontual de 200 horas para um cliente novo', pq: '200', pp: '110', pcv: '60', pdv: '10', prat: '64,29', pinc: '1.500', pcan: '0',
    chk: { precedente: true, escopo: true, antecipado: true },
    mixRec: 'horas de consultor sênior', mixH: '600',
    mix: [
      { nome: 'Diagnóstico estratégico (projeto)', preco: '12.000', cv: '3.000', dvp: '10', dem: '6', h: '60' },
      { nome: 'Auditoria de processos (projeto)', preco: '8.000', cv: '2.500', dvp: '10', dem: '10', h: '25' },
      { nome: 'Treinamento in company (turma)', preco: '5.000', cv: '1.500', dvp: '10', dem: '12', h: '12' },
      { nome: 'Mentoria mensal (contrato)', preco: '3.000', cv: '600', dvp: '10', dem: '20', h: '10' }
    ],
    abcP: [
      { nome: 'Contabilidade PME (cliente)', vol: '80', preco: '1.500', cv: '300', base: '6' },
      { nome: 'Folha de pagamento (cliente)', vol: '40', preco: '800', cv: '150', base: '3' },
      { nome: 'Consultoria tributária (cliente)', vol: '5', preco: '6.000', cv: '1.500', base: '30' }
    ],
    abcA: [
      { nome: 'Atendimento e chamados', custo: '25.000', dir: 'nº de chamados', q: ['400', '150', '60'] },
      { nome: 'Reuniões com cliente', custo: '15.000', dir: 'nº de reuniões', q: ['40', '10', '30'] },
      { nome: 'Retrabalho e correções', custo: '12.000', dir: 'nº de correções', q: ['60', '20', '40'] },
      { nome: 'Onboarding de clientes novos', custo: '8.000', dir: 'nº de onboardings', q: ['6', '4', '3'] },
      { nome: 'Pesquisa de legislação', custo: '20.000', dir: 'horas de pesquisa', q: ['20', '10', '170'] }
    ],
    mkBase: 'cheio', mkImp: '10', mkCom: '2', mkDF: '12', mkLuc: '15', pMerc: '180', metaMg: '15'
  }
};

/* ---------- textos que mudam com o modo ({u} = unidade, {us} = plural) ---------- */
const TXT = {
  produtos: {
    baseSub: '(alimentam Painel 360, Absorção x Variável, Equilíbrio, Pedido especial e Preço)',
    produto: 'Produto / linha analisada', un: 'ex.: litro, unidade, caixa',
    preco: 'Preço de venda (R$/{u})', cv: 'Custo variável (R$/{u})', cvH: 'matéria-prima, embalagem, insumos',
    dvpH: 'impostos s/ venda, comissões, frete', cfp: 'Custos fixos de produção (R$/mês)', cfpH: 'aluguel da fábrica, equipe fixa, depreciação',
    volVend: 'Volume vendido ({us}/mês)', volProd: 'Volume produzido ({us}/mês)',
    cap: 'Capacidade instalada ({us}/mês)', capH: 'máximo que a fábrica consegue produzir',
    abaPedido: 'Pedido especial', tituloUnit: 'Custo por {u}',
    infoAbs: '<strong>A armadilha do rateio.</strong> No custeio por absorção, os custos fixos da fábrica entram no custo de cada {u}. Isso é exigido pela contabilidade oficial (estoques, impostos), mas para decisões de curto prazo pode enganar: o fixo continua existindo mesmo que o produto deixe de ser fabricado. No custeio variável, o fixo é custo do período e aparece a <em>margem de contribuição</em>.',
    volumeTxt: 'O custo variável por {u} fica igual; o fixo por {u} cai quando a produção sobe.',
    infoPed: '<strong>Pedido especial com capacidade ociosa.</strong> Se há tanques, máquinas e equipe parados e o fixo já está pago, a pergunta certa é: <em>quanto o lucro da empresa muda se eu aceitar?</em> Entra na conta só o que muda com a decisão: receita, custos variáveis, gastos extras do pedido e vendas normais que se perderiam.',
    tituloPed: 'Dados do pedido', pq: 'Quantidade ({us})', pp: 'Preço oferecido (R$/{u})', pcv: 'Custo variável do item (R$/{u})',
    prat: 'Rateio de fixos no relatório (R$/{u})', pincH: 'rótulo, frete, hora extra, setup', pcan: 'Vendas normais que se perderiam ({us})',
    infoMix: '<strong>Gestão de gargalos.</strong> Quando um recurso é limitado (horas de máquina, tanques, mão de obra especializada), o produto que dá mais lucro <em>por unidade</em> nem sempre é o melhor. Deve-se priorizar a maior <em>margem de contribuição por unidade do recurso escasso</em>.',
    tituloMix: 'Produtos', tituloAbcP: 'Produtos', abcBase: 'Horas de MOD por un', abcBaseNome: 'horas de mão de obra direta',
    infoAbc: '<strong>Custeio Baseado em Atividades (ABC).</strong> Produtos consomem atividades, e as atividades consomem recursos. Em vez de ratear todo o custo indireto por horas de mão de obra, cada custo é distribuído pelo que realmente o provoca (nº de setups, de inspeções, de pedidos...). Produtos simples de alto volume costumam parecer piores do que são no rateio tradicional; os complexos de baixo volume, melhores.',
    pMerc: 'Preço aceito pelo mercado (R$/{u})', cpv: 'Custo dos produtos vendidos'
  },
  servicos: {
    baseSub: '(alimentam Painel 360, Absorção x Variável, Equilíbrio, Proposta especial e Preço)',
    produto: 'Serviço / linha analisada', un: 'ex.: hora, atendimento, projeto',
    preco: 'Preço de venda (R$/{u})', cv: 'Custo direto variável (R$/{u})', cvH: 'profissional pago por hora/projeto, licença por uso, deslocamento',
    dvpH: 'impostos s/ nota (ISS, Simples), comissões', cfp: 'Custos fixos da operação (R$/mês)', cfpH: 'equipe técnica fixa, servidores, softwares, depreciação',
    volVend: 'Volume faturado ({us}/mês)', volProd: 'Volume entregue ({us}/mês)',
    cap: 'Capacidade da equipe ({us}/mês)', capH: '{us} faturáveis disponíveis da equipe',
    abaPedido: 'Proposta especial', tituloUnit: 'Custo por {u}',
    infoAbs: '<strong>A armadilha do rateio.</strong> No custeio por absorção, os custos fixos da operação (equipe fixa, sistemas, estrutura) são divididos por {u} entregue. Serve para a contabilidade oficial, mas engana em decisões de curto prazo: o salário da equipe fixa e o aluguel continuam existindo mesmo que um cliente ou serviço deixe de existir. No custeio variável, o fixo é custo do período e aparece a <em>margem de contribuição</em>.',
    volumeTxt: 'O custo direto variável por {u} fica igual; o fixo por {u} cai quando a equipe fica mais ocupada.',
    infoPed: '<strong>Proposta especial com equipe ociosa.</strong> Hora de equipe parada não volta: serviço não vai para estoque. Se o time fixo tem horas livres e o fixo já está pago, a pergunta certa é: <em>quanto o lucro da empresa muda se eu aceitar?</em> Entra na conta só o que muda: receita, custos diretos variáveis, gastos extras da proposta e horas que deixariam de ser vendidas a outros clientes.',
    tituloPed: 'Dados da proposta', pq: 'Quantidade ({us})', pp: 'Preço oferecido (R$/{u})', pcv: 'Custo direto variável (R$/{u})',
    prat: 'Rateio de fixos no relatório (R$/{u})', pincH: 'deslocamento, hospedagem, licença extra', pcan: '{us} de outros clientes que se perderiam',
    infoMix: '<strong>Gestão de gargalos.</strong> Em serviços, o recurso escasso costuma ser a hora do profissional mais disputado (sócio, especialista, sênior). O serviço que dá mais margem <em>por contrato</em> nem sempre é o melhor: priorize a maior <em>margem de contribuição por hora do profissional escasso</em>.',
    tituloMix: 'Serviços', tituloAbcP: 'Serviços / tipos de cliente', abcBase: 'Horas diretas por un', abcBaseNome: 'horas diretas trabalhadas',
    infoAbc: '<strong>Custeio Baseado em Atividades (ABC).</strong> Serviços e clientes consomem atividades (chamados, reuniões, retrabalho, pesquisa), e as atividades consomem recursos. Em vez de ratear a estrutura só por horas trabalhadas, cada custo é distribuído pelo que realmente o provoca. É comum descobrir que o cliente "grande e exigente" dá menos lucro do que parecia, e o "simples e padronizado" dá mais.',
    pMerc: 'Preço aceito pelo mercado (R$/{u})', cpv: 'Custo dos serviços prestados'
  }
};

const CHECKS = {
  produtos: [
    { id: 'marca', peso: 3, t: 'Sairá com a nossa marca premium (risco de diluir o posicionamento)' },
    { id: 'precedente', peso: 3, t: 'O preço baixo pode virar referência para outros clientes e pedidos futuros' },
    { id: 'canal', peso: 2, t: 'Pode irritar bares, empórios e distribuidores que pagam mais caro' },
    { id: 'dependencia', peso: 2, t: 'Esse cliente pode virar parcela relevante do faturamento (dependência)' },
    { id: 'operacao', peso: 2, t: 'Fora do portfólio: exige receita, insumos ou setups diferentes e tira o foco da equipe técnica' },
    { id: 'prazo', peso: 2, t: 'Prazo apertado, com risco de falha de qualidade ou entrega' },
    { id: 'avista', peso: -1, t: 'Pagamento à vista melhora o caixa no período de baixa' },
    { id: 'semMarca', peso: -2, t: 'Dá para vender sem marca (marca do cliente) ou com marca secundária' },
    { id: 'pontual', peso: -2, t: 'Pedido pontual, com contrato e sigilo sobre o preço' },
    { id: 'ocupacao', peso: -1, t: 'Mantém a equipe fixa ocupada e abre porta para um novo canal' }
  ],
  servicos: [
    { id: 'marca', peso: 2, t: 'Associar a marca a serviço "barato" pode prejudicar o posicionamento' },
    { id: 'precedente', peso: 3, t: 'O preço reduzido pode virar referência para clientes atuais na renovação' },
    { id: 'escopo', peso: 3, t: 'Escopo pouco definido: risco de horas extras não cobradas' },
    { id: 'senior', peso: 2, t: 'Pode desviar profissionais-chave de clientes estratégicos' },
    { id: 'dependencia', peso: 2, t: 'Esse cliente pode virar parcela relevante do faturamento (dependência)' },
    { id: 'qualidade', peso: 1, t: 'Cliente de preço baixo tende a exigir atendimento de nível premium' },
    { id: 'antecipado', peso: -1, t: 'Pagamento antecipado ou à vista' },
    { id: 'escopoFechado', peso: -2, t: 'Contrato com escopo fechado, entregáveis e limite de horas' },
    { id: 'novoMercado', peso: -2, t: 'Abre porta para cliente ou setor novo com chance de recorrência' },
    { id: 'ociosa', peso: -1, t: 'A equipe ficaria parada nesse período' }
  ]
};

/* ---------- estado ---------- */
const CHAVE = 'calcController.v1';
const clone = o => JSON.parse(JSON.stringify(o));
let ST = { modo: 'produtos', aba: 'painel', produtos: clone(EXEMPLOS.produtos), servicos: clone(EXEMPLOS.servicos) };
try {
  const salvo = JSON.parse(localStorage.getItem(CHAVE));
  if (salvo && salvo.produtos && salvo.servicos) ST = { ...ST, ...salvo };
} catch (e) { /* sem armazenamento: segue com o exemplo */ }
const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(ST)); } catch (e) { } };
const D = () => ST[ST.modo];
const g = k => parse(D()[k]);
const isServ = () => ST.modo === 'servicos';
const U = () => esc((D().un || 'un').trim() || 'un');
const t = k => (TXT[ST.modo][k] || '').replace(/\{us\}/g, plural(U())).replace(/\{u\}/g, U());

/* ---------- cálculos base ---------- */
function base() {
  const preco = g('preco'), cv = g('cv'), dvp = g('dvp') / 100;
  const cfp = g('cfp'), df = g('df'), naoDes = g('naoDes'), parc = g('parc'), lucroDes = g('lucroDes');
  const volVend = g('volVend'), volProd = isServ() ? volVend : g('volProd'), cap = g('cap');
  const dvu = preco * dvp, cvt = cv + dvu, mcu = preco - cvt, mcp = preco ? mcu / preco : NaN;
  const F = cfp + df;
  const pec = mcu > 0 ? F / mcu : NaN, pef = mcu > 0 ? Math.max(0, F - naoDes + parc) / mcu : NaN, pee = mcu > 0 ? (F + lucroDes) / mcu : NaN;
  const lucro = mcu * volVend - F;
  // IMC = margem de contribuição total ÷ receita bruta total; PE em R$ = (CF + DF) ÷ IMC
  const imc = volVend > 0 && preco > 0 ? (mcu * volVend) / (preco * volVend) : mcp;
  const pecR = imc > 0 ? F / imc : NaN, pefR = imc > 0 ? Math.max(0, F - naoDes + parc) / imc : NaN, peeR = imc > 0 ? (F + lucroDes) / imc : NaN;
  const ms = volVend ? (volVend - pec) / volVend : NaN;
  const gao = lucro > 0 ? (mcu * volVend) / lucro : NaN;
  const cfu = volProd ? cfp / volProd : NaN, cheio = cv + cfu;
  const ocup = cap ? volProd / cap : NaN;
  const piso = dvp < 1 ? cv / (1 - dvp) : NaN;
  return { preco, cv, dvp, dvu, cvt, mcu, mcp, cfp, df, F, naoDes, parc, lucroDes, imc, pecR, pefR, peeR, volVend, volProd, cap, pec, pef, pee, lucro, ms, gao, cfu, cheio, ocup, piso };
}

function markup(b) {
  const imp = g('mkImp') / 100, com = g('mkCom') / 100, dfp = g('mkDF') / 100, luc = g('mkLuc') / 100;
  const custo = D().mkBase === 'cv' ? b.cv : b.cheio;
  const soma = imp + com + dfp + luc, div = 1 - soma;
  return { imp, com, dfp, luc, custo, soma, div, mult: div > 0 ? 1 / div : NaN, preco: div > 0 ? custo / div : NaN };
}

/* ---------- componentes ---------- */
const kpi = (rot, val, sub = '', cls = '') => `<div class="kpi ${cls}"><span>${rot}</span><b>${val}</b><span>${sub}</span></div>`;
const aviso = (cls, html) => `<div class="aviso ${cls}">${html}</div>`;
const linhas = rows => rows.map(r => `<tr class="${r[2] || ''}"><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');

/* ---------- PAINEL 360 ---------- */
function renderPainel(b) {
  const u = U(), us = plural(u), m = markup(b);
  $('#kpis360').innerHTML = [
    kpi(`Margem de contribuição por ${u}`, brl(b.mcu), `${pct(b.mcp)} do preço`, b.mcu > 0 ? 'bom' : 'ruim'),
    kpi(`Custo variável total por ${u}`, brl(b.cvt), 'custo + despesas variáveis'),
    kpi(`Custo cheio por ${u} (absorção)`, brl(b.cheio), `inclui ${brl(b.cfu)} de fixo rateado`),
    kpi('Lucro do mês', brl(b.lucro), 'visão gerencial', b.lucro >= 0 ? 'bom' : 'ruim'),
    kpi('Equilíbrio contábil', `${num(Math.ceil(b.pec))} ${us}`, brl(b.pecR) + ' de faturamento mínimo'),
    kpi('Equilíbrio financeiro', `${num(Math.ceil(b.pef))} ${us}`, 'cobre só o que sai do caixa'),
    kpi('Equilíbrio econômico', `${num(Math.ceil(b.pee))} ${us}`, `inclui lucro de ${brl(b.lucroDes)}`),
    kpi('Margem de segurança', pct(b.ms), 'quanto as vendas podem cair', b.ms >= .2 ? 'bom' : 'ruim'),
    kpi('Uso da capacidade', pct(b.ocup), `${num(Math.max(0, b.cap - b.volProd))} ${us} livres`),
    kpi('Alavancagem operacional', ok(b.gao) ? num(b.gao, 1) + 'x' : '—', '+1% vendas = +GAO% lucro'),
    kpi(`Preço piso por ${u}`, brl(b.piso), 'abaixo disso, cada venda dá prejuízo'),
    kpi(`Preço pelo markup`, brl(m.preco), `multiplicador ${num(m.mult, 2)}`)
  ].join('');

  const resAbsU = b.preco - b.cheio - b.dvu;
  const ang = [
    ['Contábil (absorção)', `Quanto custa cada ${u} com tudo rateado?`, `${brl(b.cheio)} → resultado de ${sinal(resAbsU)} por ${u}`],
    ['Gerencial (variável)', `Quanto sobra de cada venda, por ${u}, para pagar a estrutura?`, `${sinal(b.mcu)} por ${u} (${pct(b.mcp)} do preço)`],
    ['Equilíbrio contábil', 'Quanto vender para lucro zero?', `${num(Math.ceil(b.pec))} ${us}/mês`],
    ['Caixa (sobrevivência)', 'Quanto vender para não faltar dinheiro?', `${num(Math.ceil(b.pef))} ${us}/mês`],
    ['Sócios (econômico)', 'Quanto vender para remunerar o capital?', `${num(Math.ceil(b.pee))} ${us}/mês ${b.pee > b.cap ? '<span class="neg">(acima da capacidade!)</span>' : ''}`],
    ['Risco', 'Quanto as vendas podem cair antes do prejuízo?', `${pct(b.ms)} (${num(Math.max(0, b.volVend - b.pec))} ${us})`],
    ['Capacidade', 'Quanto da estrutura estou usando?', `${pct(b.ocup)} — ${num(Math.max(0, b.cap - b.volProd))} ${us} livres`],
    ['Sensibilidade', 'Se as vendas subirem 10%, o lucro sobe quanto?', ok(b.gao) ? `cerca de ${pct(b.gao * .1)} (${brl(b.mcu * b.volVend * .1)})` : '—'],
    ['Preço (curto prazo)', `Qual o menor preço aceitável com capacidade sobrando?`, `${brl(b.piso)} por ${u} (margem de contribuição zero)`],
    ['Preço (longo prazo)', 'Qual preço cobre tudo e dá o lucro desejado?', `${brl(m.preco)} pelo markup; atual ${brl(b.preco)}`]
  ];
  $('#angulos').innerHTML = ang.map(r => `<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');

  const L = [];
  if (b.mcu <= 0) L.push(`<span class="neg">O preço não cobre nem o custo variável.</span> Cada venda aumenta o prejuízo. Rever preço ou custo variável é urgente.`);
  else if (resAbsU < 0) L.push(`<strong>Armadilha do rateio:</strong> pelo custo cheio, cada ${u} parece dar prejuízo de ${brl(-resAbsU)}, mas a margem de contribuição é positiva (${brl(b.mcu)}). Cortar vendas pioraria o resultado, porque o fixo continua.`);
  if (b.lucro < 0 && b.mcu > 0) L.push(`A operação está abaixo do equilíbrio: faltam <strong>${num(Math.ceil(b.pec - b.volVend))} ${us}</strong> por mês para zerar o prejuízo.`);
  else if (b.mcu > 0 && b.ms < .15) L.push(`Margem de segurança baixa (${pct(b.ms)}): uma queda pequena nas vendas já leva ao prejuízo.`);
  if (b.ocup < .75) L.push(`Há ${pct(1 - b.ocup)} de capacidade ociosa. Pedidos com margem de contribuição positiva ajudam a pagar o fixo que já existe (veja a aba ${t('abaPedido')}).`);
  if (b.pee > b.cap) L.push(`<span class="neg">O lucro desejado não cabe na capacidade atual</span>: seriam necessárias ${num(Math.ceil(b.pee))} ${us}. Caminhos: aumentar preço, reduzir custos ou rever a meta.`);
  if (!isServ() && b.volProd > b.volVend) L.push(`Produção acima das vendas: ${brl((b.volProd - b.volVend) * b.cfu)} de custo fixo ficam "guardados" no estoque e inflam o lucro pela absorção.`);
  if (ok(b.gao) && b.gao > 3) L.push(`Alavancagem alta (${num(b.gao, 1)}x): o lucro é muito sensível ao volume — bom na alta, perigoso na baixa.`);
  if (b.mcu > 0 && b.pef < b.volVend && b.lucro < 0) L.push('Apesar do prejuízo contábil, o caixa ainda se paga (volume acima do equilíbrio financeiro).');
  if (!L.length) L.push('Indicadores saudáveis: margem positiva, acima do equilíbrio e com folga de segurança.');
  $('#leituras360').innerHTML = L.map(x => `<li>${x}</li>`).join('');
}

/* ---------- ABSORÇÃO x VARIÁVEL ---------- */
function renderAbsorcao(b) {
  const u = U(), us = plural(u);
  const resAbsU = b.preco - b.cheio - b.dvu;
  $('#tabUnit').innerHTML = `<thead><tr><th>Item</th><th>R$/${u}</th></tr></thead><tbody>` + linhas([
    ['Preço de venda', brl(b.preco)],
    [isServ() ? '(−) Custo direto variável' : '(−) Custo variável', brl(-b.cv)],
    ['(−) Despesas variáveis', brl(-b.dvu)],
    ['= Margem de contribuição', sinal(b.mcu), 'sub'],
    ['(−) Fixo rateado por ' + esc(u), brl(-b.cfu)],
    ['= Resultado por ' + esc(u) + ' (absorção)', sinal(resAbsU), 'total'],
    ['Custo cheio (variável + rateio)', brl(b.cheio)]
  ]) + '</tbody>';

  $('#alertaAbs').innerHTML = b.mcu <= 0
    ? aviso('ruim', `Margem de contribuição negativa: o preço não paga nem o variável. Aqui as duas visões concordam: há prejuízo real em cada ${u}.`)
    : resAbsU < 0
      ? aviso('alerta', `<strong>Atenção à armadilha.</strong> O relatório contábil mostra prejuízo de ${brl(-resAbsU)} por ${u}. Mas cada venda deixa <strong>${brl(b.mcu)}</strong> por ${u} para pagar a estrutura. Os ${brl(b.cfu)} de rateio continuariam existindo se a venda parasse.`)
      : aviso('ok', `As duas visões indicam resultado positivo. A margem de contribuição de ${brl(b.mcu)} por ${u} cobre o rateio de ${brl(b.cfu)}.`);

  const niveis = [.25, .5, .75, 1].map(p => ({ rot: pct(p, 0) + ' da capacidade', v: b.cap * p }));
  niveis.push({ rot: '<strong>Volume atual</strong>', v: b.volProd });
  niveis.sort((a, c) => a.v - c.v);
  $('#tabVolume').innerHTML = `<thead><tr><th>Volume</th><th>${us}</th><th>Fixo/${u}</th><th>Custo cheio</th><th>Resultado/${u}</th></tr></thead><tbody>` +
    niveis.map(n => {
      const fu = n.v ? b.cfp / n.v : NaN;
      return `<tr><td>${n.rot}</td><td>${num(n.v)}</td><td>${brl(fu)}</td><td>${brl(b.cv + fu)}</td><td>${sinal(b.preco - b.cv - fu - b.dvu)}</td></tr>`;
    }).join('') + '</tbody>';

  const rec = b.preco * b.volVend, cvT = b.cv * b.volVend, dvT = b.dvu * b.volVend;
  const cpvAbs = (b.cv + b.cfu) * b.volVend, lbAbs = rec - cpvAbs, loAbs = lbAbs - dvT - b.df;
  const mcT = rec - cvT - dvT, loVar = mcT - b.cfp - b.df;
  $('#dreAbs').innerHTML = `<thead><tr><th>Custeio por absorção (oficial)</th><th>R$</th></tr></thead><tbody>` + linhas([
    ['Receita', brl(rec)],
    ['(−) ' + t('cpv') + ' (variável + fixo rateado)', brl(-cpvAbs)],
    ['= Lucro bruto', brl(lbAbs), 'sub'],
    ['(−) Despesas variáveis', brl(-dvT)],
    ['(−) Despesas fixas', brl(-b.df)],
    ['= Lucro operacional', sinal(loAbs), 'total']
  ]) + '</tbody>';
  $('#dreVar').innerHTML = `<thead><tr><th>Custeio variável (gerencial)</th><th>R$</th></tr></thead><tbody>` + linhas([
    ['Receita', brl(rec)],
    ['(−) Custos variáveis', brl(-cvT)],
    ['(−) Despesas variáveis', brl(-dvT)],
    ['= Margem de contribuição total', brl(mcT), 'sub'],
    ['(−) Custos fixos ' + (isServ() ? 'da operação' : 'de produção'), brl(-b.cfp)],
    ['(−) Despesas fixas', brl(-b.df)],
    ['= Lucro operacional', sinal(loVar), 'total']
  ]) + '</tbody>';

  const dif = loAbs - loVar;
  $('#alertaEstoque').innerHTML = Math.abs(dif) < 0.5
    ? aviso('ok', isServ()
      ? 'Em serviços não há estoque: tudo o que se entrega no mês é faturado no mês, por isso os dois métodos dão o mesmo lucro total. A diferença está no <em>custo por unidade</em>, que pode enganar decisões.'
      : 'Produção igual às vendas: os dois métodos dão o mesmo lucro total. A diferença aparece no custo por unidade e quando produção e vendas se descolam.')
    : aviso('alerta', `<strong>Diferença de ${brl(dif)} entre os métodos.</strong> ${dif > 0
      ? `Produzindo mais do que vende, a absorção "guarda" parte do custo fixo no estoque e mostra lucro maior, sem que entre um real a mais no caixa. Cuidado com metas que premiam produção.`
      : `Vendendo mais do que produziu, a absorção puxa para o resultado fixos de meses anteriores que estavam no estoque.`}`);
}

/* ---------- EQUILÍBRIO e CVL ---------- */
function renderEquilibrio(b) {
  const u = U(), us = plural(u);
  const ff = 'CF + DF';
  $('#kpisPE').innerHTML = [
    kpi(`Margem de contribuição por ${u}`, brl(b.mcu), `preço − custos e despesas variáveis`, b.mcu > 0 ? 'bom' : 'ruim'),
    kpi('IMC — índice de margem de contribuição', pct(b.imc), `MC total ${brl(b.mcu * b.volVend)} ÷ receita bruta ${brl(b.preco * b.volVend)}`, b.imc > 0 ? 'bom' : 'ruim'),
    kpi(`PEC em ${us} (volume de esforço)`, `${num(Math.ceil(b.pec))} ${us}`, `(${ff}) ${brl(b.F)} ÷ MC por ${u} ${brl(b.mcu)}`),
    kpi('PEC em R$ (faturamento mínimo)', brl(b.pecR), `(${ff}) ${brl(b.F)} ÷ IMC ${pct(b.imc)}`),
    kpi('Equilíbrio financeiro', `${num(Math.ceil(b.pef))} ${us}`, `${brl(b.pefR)} · (${ff} − ${brl(b.naoDes)} não desembolsáveis + ${brl(b.parc)} parcelas)`),
    kpi('Equilíbrio econômico', `${num(Math.ceil(b.pee))} ${us}`, `${brl(b.peeR)} · (${ff} + lucro de ${brl(b.lucroDes)})`),
    kpi('Volume atual', `${num(b.volVend)} ${us}`, `lucro de ${brl(b.lucro)}`, b.lucro >= 0 ? 'bom' : 'ruim'),
    kpi('Margem de segurança', pct(b.ms), `${num(Math.max(0, b.volVend - b.pec))} ${us} acima do equilíbrio`, b.ms >= .2 ? 'bom' : 'ruim')
  ].join('');

  // Prova: monta o resultado do mês em cada ponto e mostra que fecha
  const pontos = [['Contábil', b.pec], ['Financeiro', b.pef], ['Econômico', b.pee], ['Atual', b.volVend]];
  const linha = (rot, f, cls = '') => `<tr class="${cls}"><td>${rot}</td>${pontos.map(([, v]) => `<td>${ok(v) ? f(v) : '—'}</td>`).join('')}</tr>`;
  const luc = v => b.mcu * v - b.F, caixa = v => luc(v) + b.naoDes - b.parc;
  $('#provaPE').innerHTML = `<thead><tr><th></th>${pontos.map(p => `<th>${p[0]}</th>`).join('')}</tr></thead><tbody>` +
    linha(`Volume (${us})`, v => num(v, 1)) +
    linha('Receita bruta', v => brl(b.preco * v)) +
    linha('(−) Custos e despesas variáveis', v => brl(-b.cvt * v)) +
    linha('= Margem de contribuição', v => brl(b.mcu * v), 'sub') +
    linha('(−) Custos fixos (CF)', () => brl(-b.cfp)) +
    linha('(−) Despesas fixas (DF)', () => brl(-b.df)) +
    linha('= Lucro', v => sinal(luc(v)), 'total') +
    linha('(+) Não desembolsáveis', () => brl(b.naoDes)) +
    linha('(−) Parcelas de empréstimo', () => brl(-b.parc)) +
    linha('= Sobra de caixa', v => sinal(caixa(v)), 'total') +
    '</tbody><tfoot><tr><td colspan="5" class="muted mini">No contábil o lucro é zero; no financeiro a sobra de caixa é zero; no econômico o lucro é igual ao lucro desejado.</td></tr></tfoot>';
  desenharCVL(b);

  const d = g('desc') / 100, p2 = b.preco * (1 - d), mc2 = p2 - b.cv - p2 * b.dvp;
  if (mc2 <= 0) {
    $('#resDesc').innerHTML = aviso('ruim', `Com ${pct(d)} de desconto o preço (${brl(p2)}) não cobre o custo variável. Nenhum volume compensa.`);
    return;
  }
  const volNec = (b.F + b.lucro) / mc2, aum = volNec / b.volVend - 1;
  $('#resDesc').innerHTML = `<div class="kpis" style="margin-top:12px">${[
    kpi('Novo preço', brl(p2)),
    kpi(`Nova margem por ${u}`, brl(mc2), `antes ${brl(b.mcu)} (${pct(mc2 / b.mcu - 1)})`, 'ruim'),
    kpi('Volume para manter o lucro', `${num(Math.ceil(volNec))} ${us}`, `${aum >= 0 ? '+' : ''}${pct(aum)} sobre o atual`),
    kpi('Novo equilíbrio contábil', `${num(Math.ceil(b.F / mc2))} ${us}`)
  ].join('')}</div>` + (volNec > b.cap
    ? aviso('ruim', `Para manter o lucro com esse desconto seria preciso vender ${num(Math.ceil(volNec))} ${us}, <strong>acima da capacidade</strong> de ${num(b.cap)}. O desconto destrói resultado.`)
    : aviso('alerta', `Um desconto de ${pct(d, 0)} exige vender <strong>${pct(aum)} a mais</strong> só para empatar com o lucro de hoje. Desconto parece pequeno no preço, mas é grande na margem.`));
}

function desenharCVL(b) {
  const el = $('#graficoCVL');
  if (!(b.mcu > 0) || !(b.preco > 0)) { el.innerHTML = aviso('ruim', 'Sem margem de contribuição positiva não há ponto de equilíbrio para desenhar.'); return; }
  const W = 760, H = 320, m = { l: 70, r: 16, t: 16, b: 40 };
  const xMax = Math.max(b.cap, b.pee * 1.1, b.volVend * 1.1) || 1;
  const rec = x => b.preco * x, ct = x => b.F + b.cvt * x;
  const yMax = Math.max(rec(xMax), ct(xMax)) * 1.05;
  const X = x => m.l + (x / xMax) * (W - m.l - m.r), Y = y => H - m.b - (y / yMax) * (H - m.t - m.b);
  const fmtK = v => v >= 1e6 ? num(v / 1e6, 1) + ' mi' : v >= 1e3 ? num(v / 1e3, 0) + ' mil' : num(v, 0);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico custo-volume-lucro">`;
  for (let i = 0; i <= 4; i++) {
    const yv = yMax * i / 4, xv = xMax * i / 4;
    s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(yv)}" y2="${Y(yv)}" stroke="#e5e8ee"/>`;
    s += `<text x="${m.l - 6}" y="${Y(yv) + 4}" font-size="11" text-anchor="end" fill="#5d6676">R$ ${fmtK(yv)}</text>`;
    s += `<text x="${X(xv)}" y="${H - m.b + 16}" font-size="11" text-anchor="middle" fill="#5d6676">${fmtK(xv)}</text>`;
  }
  s += `<text x="${(W + m.l) / 2}" y="${H - 6}" font-size="11" text-anchor="middle" fill="#5d6676">${plural(U())} por mês</text>`;
  // área de lucro / prejuízo
  s += `<polygon points="${X(b.pec)},${Y(rec(b.pec))} ${X(xMax)},${Y(rec(xMax))} ${X(xMax)},${Y(ct(xMax))}" fill="rgba(31,122,77,.10)"/>`;
  s += `<polygon points="${X(0)},${Y(0)} ${X(b.pec)},${Y(rec(b.pec))} ${X(0)},${Y(ct(0))}" fill="rgba(180,35,24,.08)"/>`;
  s += `<line x1="${X(0)}" y1="${Y(b.F)}" x2="${X(xMax)}" y2="${Y(b.F)}" stroke="var(--c-fixo)" stroke-width="2"/>`;
  s += `<line x1="${X(0)}" y1="${Y(ct(0))}" x2="${X(xMax)}" y2="${Y(ct(xMax))}" stroke="var(--c-custo)" stroke-width="2.5"/>`;
  s += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(xMax)}" y2="${Y(rec(xMax))}" stroke="var(--c-receita)" stroke-width="2.5"/>`;
  const marcas = [
    { x: b.pef, r: 'Financeiro' }, { x: b.pec, r: 'Contábil' }, { x: b.pee, r: 'Econômico' }, { x: b.volVend, r: 'Atual', cor: '#c98a12' }
  ].filter(k => ok(k.x) && k.x <= xMax).sort((a, c) => a.x - c.x);
  marcas.forEach((k, i) => {
    const yl = m.t + 12 + (i % 2) * 14;
    s += `<line x1="${X(k.x)}" x2="${X(k.x)}" y1="${m.t}" y2="${H - m.b}" stroke="${k.cor || '#5d6676'}" stroke-dasharray="4 4"/>`;
    s += `<text x="${X(k.x) + 4}" y="${yl}" font-size="11" font-weight="600" fill="${k.cor || '#1d2330'}">${k.r}</text>`;
  });
  el.innerHTML = s + '</svg>';
}

/* ---------- PEDIDO / PROPOSTA ESPECIAL ---------- */
function renderPedido(b) {
  const u = U(), us = plural(u);
  const q = g('pq'), p = g('pp'), cv = g('pcv'), dvp = g('pdv') / 100, rat = g('prat'), inc = g('pinc');
  const dvu = p * dvp, mcu = p - cv - dvu;
  const ociosa = Math.max(0, b.cap - b.volProd);
  const excesso = Math.max(0, q - ociosa);
  const canib = Math.max(g('pcan'), excesso);
  const perdaCanib = canib * Math.max(0, b.mcu);
  const resAbs = (p - cv - dvu - rat) * q;
  const resGer = mcu * q - inc - perdaCanib;
  const piso = (1 - dvp) > 0 && q > 0 ? (cv + (inc + perdaCanib) / q) / (1 - dvp) : NaN;

  $('#pedAbs').innerHTML = `<table class="tab num"><tbody>` + linhas([
    ['Preço oferecido', brl(p)],
    [`Custo cheio por ${u} (variável + rateio)`, brl(cv + rat)],
    ['Despesas variáveis por ' + esc(u), brl(dvu)],
    [`Resultado por ${u}`, sinal(p - cv - rat - dvu), 'sub'],
    [`Resultado "do relatório" (${num(q)} ${us})`, sinal(resAbs), 'total']
  ]) + `</tbody></table><p class="muted mini">Rateio de fixos pela base atual: ${brl(b.cfu)} por ${u}.</p>` +
    (resAbs < 0 ? aviso('alerta', `Por esta visão, ${isServ() ? 'a proposta parece' : 'o pedido parece'} dar <strong>prejuízo</strong>. Mas os ${brl(rat * q)} de rateio são fixos que <em>já existem</em> e serão pagos de qualquer forma.`) : '');

  $('#pedVar').innerHTML = `<table class="tab num"><tbody>` + linhas([
    [`Receita (${num(q)} × ${brl(p)})`, brl(p * q)],
    ['(−) Custos variáveis', brl(-cv * q)],
    ['(−) Despesas variáveis', brl(-dvu * q)],
    ['= Margem de contribuição', sinal(mcu * q), 'sub'],
    ['(−) Gastos extras desta decisão', brl(-inc)],
    [`(−) Margem perdida de ${num(canib)} ${us} normais`, brl(-perdaCanib)],
    ['= Ganho real para a empresa', sinal(resGer), 'total']
  ]) + `</tbody></table>` +
    `<p class="muted mini">Capacidade ociosa: ${num(ociosa)} ${us}. Preço mínimo para não perder dinheiro: <strong>${brl(piso)}</strong> por ${u}.</p>` +
    (excesso > 0 ? aviso('alerta', `Faltam ${num(excesso)} ${us} de capacidade: esse volume tiraria espaço de vendas normais, e a margem perdida já foi descontada.`) : '');

  $('#pedEmpresa').innerHTML = `<div class="kpis">${[
    kpi('Lucro do mês sem aceitar', brl(b.lucro), '', b.lucro >= 0 ? 'bom' : 'ruim'),
    kpi('Lucro do mês aceitando', brl(b.lucro + resGer), '', b.lucro + resGer >= 0 ? 'bom' : 'ruim'),
    kpi('Diferença', brl(resGer), resGer >= 0 ? 'a empresa fica melhor' : 'a empresa fica pior', resGer >= 0 ? 'bom' : 'ruim'),
    kpi('Os fixos', brl(b.F), 'iguais nos dois cenários')
  ].join('')}</div>`;

  // checklist
  const lista = CHECKS[ST.modo], marc = D().chk || (D().chk = {});
  const box = $('#checklist');
  if (box.dataset.modo !== ST.modo) {
    box.dataset.modo = ST.modo;
    box.innerHTML = lista.map(c => `<label class="chk ${c.peso > 0 ? 'risco' : 'mitiga'}"><input type="checkbox" data-chk="${c.id}"><span>${c.t}</span></label>`).join('');
  }
  $$('#checklist [data-chk]').forEach(i => { i.checked = !!marc[i.dataset.chk]; });
  const score = lista.reduce((s, c) => s + (marc[c.id] ? c.peso : 0), 0);
  const nivel = score <= 2 ? 'baixo' : score <= 5 ? 'moderado' : 'alto';
  const riscos = lista.filter(c => c.peso > 0 && marc[c.id]).map(c => c.t);
  const condicoes = isServ()
    ? ['escopo fechado com limite de horas e cobrança de adicionais', 'preço tratado como condição especial e pontual, por escrito', 'alocar a equipe ociosa, preservando os profissionais-chave dos clientes estratégicos']
    : ['vender sem a marca principal (marca do cliente ou secundária)', 'contrato de lote único com sigilo sobre o preço', 'garantir que a produção regular e a qualidade não sejam afetadas'];
  let rec;
  if (resGer <= 0) rec = aviso('ruim', `<strong>Recomendação: recusar ou renegociar.</strong> Mesmo pela visão gerencial a empresa fica ${brl(-resGer)} pior. Só vale a pena acima de ${brl(piso)} por ${u}.`);
  else if (nivel === 'baixo') rec = aviso('ok', `<strong>Recomendação: aceitar.</strong> A empresa ganha ${brl(resGer)} usando estrutura que ficaria parada, e o risco qualitativo é baixo (pontuação ${score}).`);
  else if (nivel === 'moderado') rec = aviso('alerta', `<strong>Recomendação: aceitar com condições.</strong> Ganho de ${brl(resGer)} no mês, com risco qualitativo moderado (pontuação ${score}). Condições sugeridas: ${condicoes.join('; ')}.`);
  else rec = aviso('ruim', `<strong>Recomendação: só aceitar se der para reduzir os riscos.</strong> O ganho de ${brl(resGer)} é real, mas o risco estratégico é alto (pontuação ${score}). Avaliar: ${condicoes.join('; ')}.`);
  if (riscos.length) rec += `<p class="mini muted">Riscos marcados: ${riscos.join(' · ')}.</p>`;
  $('#pedRec').innerHTML = rec;
}

/* ---------- MIX e GARGALO ---------- */
function renderMixTabela() {
  const rows = D().mix;
  $('#tabMix').innerHTML = `<thead><tr><th>Nome</th><th>Preço (R$/un)</th><th>Custo variável (R$/un)</th><th>Desp. var. (%)</th><th>Demanda máx. (un/mês)</th><th>Consumo do recurso por un</th><th></th></tr></thead><tbody>` +
    rows.map((r, i) => `<tr>${['nome', 'preco', 'cv', 'dvp', 'dem', 'h'].map(f => `<td><input data-arr="mix" data-i="${i}" data-f="${f}" value="${esc(r[f])}"></td>`).join('')}<td><button class="btn x" data-del="mix" data-i="${i}" title="Remover">×</button></td></tr>`).join('') + '</tbody>';
}
function renderMix() {
  const H = g('mixH'), rec = D().mixRec || 'recurso';
  const P = D().mix.map(r => {
    const preco = parse(r.preco), cv = parse(r.cv), dv = preco * parse(r.dvp) / 100, h = parse(r.h), dem = parse(r.dem);
    const mc = preco - cv - dv;
    return { nome: r.nome, mc, h, dem, mch: h > 0 ? mc / h : NaN };
  });
  const alocar = ordem => {
    let resta = H; const q = new Map();
    ordem.forEach(p => {
      if (!(p.mc > 0) || !(p.h > 0)) { q.set(p, 0); return; }
      const n = Math.max(0, Math.min(p.dem, Math.floor(resta / p.h + 1e-9)));
      q.set(p, n); resta -= n * p.h;
    });
    return q;
  };
  const otima = alocar([...P].sort((a, c) => (c.mch || -1e18) - (a.mch || -1e18)));
  const ingenua = alocar([...P].sort((a, c) => c.mc - a.mc));
  const tot = q => P.reduce((s, p) => s + (q.get(p) || 0) * p.mc, 0);
  const horasDem = P.reduce((s, p) => s + (p.mc > 0 ? p.dem * p.h : 0), 0);
  const rank = [...P].sort((a, c) => (c.mch || -1e18) - (a.mch || -1e18));
  $('#resMix').innerHTML = `<thead><tr><th>Nome</th><th>MC por un</th><th>MC por ${esc(rec)}</th><th>Prioridade</th><th>Produzir/vender</th><th>${esc(rec)} usadas</th><th>MC total</th></tr></thead><tbody>` +
    P.map(p => `<tr><td>${esc(p.nome)}</td><td>${sinal(p.mc)}</td><td>${brl(p.mch)}</td><td>${rank.indexOf(p) + 1}º</td><td>${num(otima.get(p))} de ${num(p.dem)}</td><td>${num(otima.get(p) * p.h, 1)}</td><td>${brl(otima.get(p) * p.mc)}</td></tr>`).join('') +
    `<tr class="total"><td>Total</td><td></td><td></td><td></td><td></td><td>${num(P.reduce((s, p) => s + otima.get(p) * p.h, 0), 1)} de ${num(H)}</td><td>${brl(tot(otima))}</td></tr></tbody>`;
  const dif = tot(otima) - tot(ingenua);
  const topMC = [...P].sort((a, c) => c.mc - a.mc)[0];
  $('#resMixMsg').innerHTML = horasDem <= H
    ? aviso('ok', `Não há gargalo: atender toda a demanda usa ${num(horasDem, 1)} de ${num(H)} ${esc(rec)}. Venda tudo o que tiver margem positiva.`)
    : aviso(dif > 0.5 ? 'alerta' : 'ok', `A demanda pede ${num(horasDem, 1)} ${esc(rec)}, mas só há ${num(H)}. Priorizando pela <strong>margem por ${esc(rec)}</strong> a margem total é ${brl(tot(otima))}. ` +
      (dif > 0.5 ? `Se a prioridade fosse a maior margem por unidade (começando por "${esc(topMC?.nome)}"), seria ${brl(tot(ingenua))}: <strong>${brl(dif)} a menos</strong> por mês.` : 'Neste caso as duas formas de priorizar dão o mesmo resultado.'));
}

/* ---------- ABC ---------- */
function renderAbcTabelas() {
  const P = D().abcP, A = D().abcA;
  $('#tabAbcP').innerHTML = `<thead><tr><th>Nome</th><th>Volume/mês (un)</th><th>Preço (R$/un)</th><th>Custo variável/direto (R$/un)</th><th>${t('abcBase')}</th><th></th></tr></thead><tbody>` +
    P.map((r, i) => `<tr>${['nome', 'vol', 'preco', 'cv', 'base'].map(f => `<td><input data-arr="abcP" data-i="${i}" data-f="${f}" value="${esc(r[f])}"></td>`).join('')}<td>${P.length > 1 ? `<button class="btn x" data-del="abcP" data-i="${i}" title="Remover">×</button>` : ''}</td></tr>`).join('') +
    `</tbody><tfoot><tr><td colspan="6"><button class="btn mini" id="addAbcP">+ ${isServ() ? 'serviço' : 'produto'}</button></td></tr></tfoot>`;
  $('#tabAbcA').innerHTML = `<thead><tr><th>Atividade</th><th>Custo mensal (R$)</th><th>Direcionador</th>${P.map(p => `<th>${esc(p.nome)}</th>`).join('')}<th></th></tr></thead><tbody>` +
    A.map((a, i) => `<tr><td><input data-arr="abcA" data-i="${i}" data-f="nome" value="${esc(a.nome)}"></td><td><input data-arr="abcA" data-i="${i}" data-f="custo" value="${esc(a.custo)}"></td><td><input data-arr="abcA" data-i="${i}" data-f="dir" value="${esc(a.dir)}"></td>` +
      P.map((_, j) => `<td><input data-arr="abcA" data-i="${i}" data-q="${j}" value="${esc(a.q[j] ?? '0')}"></td>`).join('') +
      `<td><button class="btn x" data-del="abcA" data-i="${i}" title="Remover">×</button></td></tr>`).join('') + '</tbody>';
}
function renderAbc() {
  const P = D().abcP.map(p => ({ nome: p.nome, vol: parse(p.vol), preco: parse(p.preco), cv: parse(p.cv), base: parse(p.base) }));
  const A = D().abcA.map(a => ({ nome: a.nome, dir: a.dir, custo: parse(a.custo), q: P.map((_, j) => parse(a.q[j])) }));
  const totalCI = A.reduce((s, a) => s + a.custo, 0);
  const totalBase = P.reduce((s, p) => s + p.vol * p.base, 0);
  const taxaTrad = totalBase ? totalCI / totalBase : NaN;
  A.forEach(a => { const tq = a.q.reduce((s, x) => s + x, 0); a.taxa = tq ? a.custo / tq : 0; });
  const R = P.map((p, j) => {
    const ciTrad = p.vol * p.base * taxaTrad, ciAbc = A.reduce((s, a) => s + a.taxa * a.q[j], 0);
    const uT = p.vol ? ciTrad / p.vol : NaN, uA = p.vol ? ciAbc / p.vol : NaN;
    return { ...p, uT, uA, cT: p.cv + uT, cA: p.cv + uA, mT: p.preco - p.cv - uT, mA: p.preco - p.cv - uA, ciTrad, ciAbc };
  });
  $('#resAbc').innerHTML = `<thead><tr><th>Nome</th><th>Indireto/un tradicional</th><th>Indireto/un ABC</th><th>Custo total/un tradicional</th><th>Custo total/un ABC</th><th>Resultado/un tradicional</th><th>Resultado/un ABC</th><th>Resultado mensal ABC</th></tr></thead><tbody>` +
    R.map(r => `<tr><td>${esc(r.nome)}</td><td>${brl(r.uT)}</td><td>${brl(r.uA)}</td><td>${brl(r.cT)}</td><td>${brl(r.cA)}</td><td>${sinal(r.mT)}</td><td>${sinal(r.mA)}</td><td>${sinal(r.mA * r.vol)}</td></tr>`).join('') + '</tbody>' +
    `<tfoot><tr><td colspan="8" class="muted mini">Custos indiretos totais: ${brl(totalCI)}. Rateio tradicional: ${brl(taxaTrad)} por hora (${t('abcBaseNome')}). Taxas ABC: ${A.map(a => `${esc(a.nome)} = ${brl(a.taxa)} / ${esc(a.dir)}`).join(' · ')}.</td></tr></tfoot>`;

  const virou = R.filter(r => Math.sign(r.mT) !== Math.sign(r.mA) && r.vol > 0);
  const subs = R.filter(r => r.uA < r.uT * .8), sobre = R.filter(r => r.uA > r.uT * 1.2);
  let msg = '';
  if (virou.length) msg += aviso('ruim', `<strong>A decisão muda com o ABC:</strong> ` + virou.map(r => `"${esc(r.nome)}" parecia ${r.mT >= 0 ? 'dar lucro' : 'dar prejuízo'} (${brl(r.mT)}/un) e na verdade ${r.mA >= 0 ? 'dá lucro' : 'dá prejuízo'} (${brl(r.mA)}/un)`).join('; ') + '.');
  if (subs.length || sobre.length) msg += aviso('alerta', [
    sobre.length ? `No rateio tradicional, ${sobre.map(r => `"${esc(r.nome)}"`).join(', ')} ${sobre.length > 1 ? 'recebiam' : 'recebia'} menos custo indireto do que consome${sobre.length > 1 ? 'm' : ''} (era${sobre.length > 1 ? 'm' : ''} subsidiado${sobre.length > 1 ? 's' : ''}).` : '',
    subs.length ? `${subs.map(r => `"${esc(r.nome)}"`).join(', ')} ${subs.length > 1 ? 'carregavam' : 'carregava'} custo dos outros.` : ''
  ].join(' ') + ' Use isso para rever preço, mix e processos — não para cortar no impulso: parte desses custos é fixa no curto prazo.');
  if (!msg) msg = aviso('ok', 'Rateio tradicional e ABC dão resultados parecidos: o critério de horas representa bem o consumo de atividades.');
  $('#resAbcMsg').innerHTML = msg;
}

/* ---------- FORMAÇÃO DE PREÇO ---------- */
function renderPreco(b) {
  const u = U(), m = markup(b);
  const nomeBase = D().mkBase === 'cv' ? (isServ() ? 'Custo direto variável' : 'Custo variável') : 'Custo cheio';
  if (m.div <= 0) { $('#resMk').innerHTML = aviso('ruim', `As porcentagens somam ${pct(m.soma)}: não sobra nada para o custo. Reduza algum percentual.`); }
  else {
    $('#resMk').innerHTML = `<table class="tab num" style="margin-top:12px"><thead><tr><th>Composição do preço</th><th>R$/${u}</th><th>%</th></tr></thead><tbody>` +
      [[nomeBase, m.custo, m.custo / m.preco], ['Impostos', m.preco * m.imp, m.imp], ['Comissões e fretes', m.preco * m.com, m.com], ['Despesas fixas', m.preco * m.dfp, m.dfp], ['Lucro', m.preco * m.luc, m.luc]]
        .map(r => `<tr><td>${r[0]}</td><td>${brl(r[1])}</td><td>${pct(r[2])}</td></tr>`).join('') +
      `<tr class="total"><td>Preço sugerido</td><td>${brl(m.preco)}</td><td>100%</td></tr></tbody></table>` +
      `<p class="mini muted">Markup divisor ${num(m.div, 4)} · multiplicador ${num(m.mult, 4)} (custo × ${num(m.mult, 2)} = preço).</p>` +
      aviso(b.preco >= m.preco ? 'ok' : 'alerta', `Preço atual ${brl(b.preco)} está ${b.preco >= m.preco ? 'acima' : 'abaixo'} do sugerido em ${pct(Math.abs(b.preco / m.preco - 1))}. ` +
        (D().mkBase === 'cv' ? 'Partindo só do variável, os fixos precisam estar no % de despesas fixas.' : 'Lembre: o custo cheio muda com o volume; se o volume cair, o markup "pede" preço maior justo quando o mercado está fraco.'));
  }

  const pm = g('pMerc'), mg = g('metaMg') / 100;
  const ded = pm * (m.imp + m.com), dfx = pm * m.dfp, marg = pm * mg;
  const alvo = pm - ded - dfx - marg, gap = b.cheio - alvo;
  $('#resMeta').innerHTML = `<table class="tab num" style="margin-top:12px"><tbody>` + linhas([
    ['Preço aceito pelo mercado', brl(pm)],
    ['(−) Impostos, comissões e fretes', brl(-ded)],
    ['(−) Despesas fixas', brl(-dfx)],
    ['(−) Margem desejada', brl(-marg)],
    ['= Custo-meta (máximo permitido)', brl(alvo), 'total'],
    ['Custo cheio atual', brl(b.cheio)]
  ]) + '</tbody></table>' +
    (gap > 0
      ? aviso('ruim', `O custo atual está <strong>${brl(gap)} por ${u} acima do custo-meta</strong> (${pct(gap / alvo)}). Repassar ao preço tende a perder mercado: o caminho é ${isServ() ? 'rever processos, padronizar entregas, reduzir retrabalho ou ocupar melhor a equipe' : 'rever receita, compras, processos ou ocupar melhor a fábrica'}.`)
      : aviso('ok', `O custo atual está ${brl(-gap)} por ${u} abaixo do custo-meta: há folga para a margem desejada no preço de mercado.`));

  const piso = (1 - m.imp - m.com) > 0 ? b.cv / (1 - m.imp - m.com) : NaN;
  const pts = [
    { r: 'Piso (margem zero)', v: piso }, { r: 'Preço atual', v: b.preco }, { r: 'Markup', v: m.preco }, { r: 'Mercado', v: pm }
  ].filter(p => ok(p.v) && p.v > 0).sort((a, c) => a.v - c.v);
  if (!pts.length) { $('#faixa').innerHTML = ''; return; }
  const lo = pts[0].v * .85, hi = pts[pts.length - 1].v * 1.08;
  $('#faixa').innerHTML = `<div class="faixa">${pts.map((p, i) => `<div class="m ${i % 2 ? 'baixo' : ''}" style="left:${((p.v - lo) / (hi - lo)) * 100}%"><strong>${p.r}</strong><br>${brl(p.v)}</div>`).join('')}</div><div style="height:30px"></div>` +
    `<p class="mini muted">Piso calculado com os impostos e comissões do markup. Abaixo dele, cada venda tira dinheiro da empresa.</p>`;
}

/* ---------- CONCEITOS ---------- */
const GLOSSARIO = [
  ['Gasto', 'Qualquer sacrifício financeiro para obter bem ou serviço. Depois vira investimento, custo, despesa ou perda.', 'Compra de matéria-prima, computadores, folha de pagamento.', 'Compra de notebooks, assinatura de software, folha.'],
  ['Investimento', 'Gasto ativado no balanço por gerar benefícios futuros. Vira custo ou despesa com o uso (depreciação, consumo).', 'Tanques, máquinas, estoque de insumos.', 'Software próprio, equipamentos, reforma do escritório.'],
  ['Custo', 'Gasto ligado à produção do bem ou à execução do serviço principal.', 'Matéria-prima, operadores, energia das máquinas.', 'Profissionais alocados em clientes, licenças usadas na entrega.'],
  ['Despesa', 'Gasto para vender, administrar e manter a estrutura, fora do processo produtivo.', 'Comissões, marketing, salários administrativos.', 'Comercial, marketing, contador, aluguel da sede.'],
  ['Perda', 'Consumo anormal e involuntário, sem benefício. Sobras normais do processo não são perda: entram no custo.', 'Lote contaminado, incêndio, insumo vencido.', 'Retrabalho por erro grave, multa por atraso.'],
  ['Variável x fixo', 'Variável muda no total conforme o volume e é estável por unidade. Fixo é estável no total e cai por unidade quando o volume sobe.', 'Variável: insumos. Fixo: aluguel do galpão.', 'Variável: freelancer por hora. Fixo: equipe CLT.'],
  ['Direto x indireto', 'Direto é apropriado ao produto/serviço sem rateio. Indireto atende vários e precisa de critério de rateio, sempre com algum grau de arbitrariedade.', 'Direto: malte da IPA. Indireto: inspeção de qualidade.', 'Direto: horas no projeto X. Indireto: atendimento geral.'],
  ['Custeio por absorção', 'Todos os custos de produção (inclusive fixos) vão para o produto. Obrigatório para a contabilidade oficial; perigoso para decisões de curto prazo.', '', ''],
  ['Custeio variável', 'Só custos e despesas variáveis vão para o produto; fixos são custo do período. Ferramenta gerencial que revela a margem de contribuição.', '', ''],
  ['Margem de contribuição', 'Preço − custos e despesas variáveis. Quanto cada unidade deixa para pagar os fixos e, depois, gerar lucro.', '', ''],
  ['Pontos de equilíbrio', 'Contábil = (CF + DF) ÷ MC por unidade (ou por hora/projeto, em serviços). Em reais: (CF + DF) ÷ IMC, onde IMC = margem de contribuição total ÷ receita bruta total. Financeiro = (CF + DF − não desembolsáveis + parcelas de empréstimo) ÷ MC. Econômico = (CF + DF + lucro desejado) ÷ MC.', 'PEC em unidades e em faturamento mínimo.', 'PEC em horas ou projetos (volume de esforço) e em R$ (faturamento mínimo).'],
  ['Custeio ABC', 'Recursos → atividades → produtos. Distribui os indiretos pelo que de fato os provoca (direcionadores).', '', ''],
  ['Lean Accounting', 'Contabilidade simples e visual por cadeia de valor, focada em eliminar desperdício e transformar capacidade liberada em receita ou redução de custo.', '', ''],
  ['Markup', 'Fator aplicado ao custo para chegar ao preço que cobre impostos, despesas e lucro. Bom como controle e piso de segurança, mas o mercado pode não aceitar.', '', ''],
  ['Custo-meta (Target Costing)', 'Parte do preço que o mercado aceita, tira a margem desejada e chega ao custo máximo permitido. Força a empresa a se ajustar ao mercado.', '', ''],
  ['Financeira x gerencial', 'Financeira: externa, obrigatória, olha o passado, exige comprovação. Gerencial: interna, flexível, olha o futuro, privilegia rapidez e utilidade.', '', '']
];
function renderGlossario() {
  $('#glossario').innerHTML = GLOSSARIO.map(([n, d, ind, serv]) => `<div class="card glo"><h3>${n}</h3><p>${d}</p>${ind ? `<p class="mini"><strong>Indústria:</strong> ${ind}</p>` : ''}${serv ? `<p class="mini"><strong>Serviços:</strong> ${serv}</p>` : ''}</div>`).join('');
}

/* ---------- orquestração ---------- */
function aplicarTextos() {
  $$('[data-l]').forEach(el => { el.innerHTML = t(el.dataset.l); });
  $$('[data-h]').forEach(el => { el.textContent = t(el.dataset.h + 'H') || t(el.dataset.h); });
  $$('.so-prod').forEach(el => { el.style.display = isServ() ? 'none' : ''; });
  $$('.modo button').forEach(b => b.classList.toggle('ativo', b.dataset.modo === ST.modo));
}
function preencherCampos() {
  $$('[data-k]').forEach(el => { el.value = D()[el.dataset.k] ?? ''; });
}
function calcular() {
  const b = base();
  $$('[data-out="produto"]').forEach(el => { el.textContent = D().produto || ''; });
  renderPainel(b); renderAbsorcao(b); renderEquilibrio(b); renderPedido(b); renderMix(); renderAbc(); renderPreco(b);
  salvar();
}
function tudo() {
  aplicarTextos(); preencherCampos(); renderMixTabela(); renderAbcTabelas(); calcular();
}

document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.k) {
    D()[el.dataset.k] = el.value;
    if (el.dataset.k === 'un') aplicarTextos();
    if (el.dataset.k === 'mkBase') { /* select */ }
    calcular();
  } else if (el.dataset.arr) {
    const item = D()[el.dataset.arr][+el.dataset.i];
    if (el.dataset.q !== undefined) item.q[+el.dataset.q] = el.value; else item[el.dataset.f] = el.value;
    if (el.dataset.arr === 'abcP' && el.dataset.f === 'nome') {
      $$('#tabAbcA thead th').slice(3, -1).forEach((th, j) => { th.textContent = D().abcP[j]?.nome || ''; });
    }
    calcular();
  } else if (el.dataset.chk) {
    D().chk[el.dataset.chk] = el.checked; calcular();
  }
});
document.addEventListener('change', e => { if (e.target.dataset.k === 'mkBase') { D().mkBase = e.target.value; calcular(); } });

document.addEventListener('click', e => {
  const el = e.target.closest('button');
  if (!el) return;
  if (el.dataset.aba) {
    ST.aba = el.dataset.aba;
    $$('.abas button').forEach(b => b.classList.toggle('ativa', b === el));
    $$('.aba').forEach(s => s.classList.toggle('ativa', s.id === ST.aba));
    salvar();
  } else if (el.dataset.modo) {
    ST.modo = el.dataset.modo; tudo();
  } else if (el.dataset.del) {
    const arr = D()[el.dataset.del], i = +el.dataset.i;
    arr.splice(i, 1);
    if (el.dataset.del === 'abcP') D().abcA.forEach(a => a.q.splice(i, 1));
    renderMixTabela(); renderAbcTabelas(); calcular();
  } else if (el.id === 'addMix') {
    D().mix.push({ nome: 'Novo item', preco: '0', cv: '0', dvp: '0', dem: '0', h: '1' }); renderMixTabela(); calcular();
  } else if (el.id === 'addAtv') {
    D().abcA.push({ nome: 'Nova atividade', custo: '0', dir: 'nº de ocorrências', q: D().abcP.map(() => '0') }); renderAbcTabelas(); calcular();
  } else if (el.id === 'addAbcP') {
    D().abcP.push({ nome: isServ() ? 'Novo serviço' : 'Novo produto', vol: '0', preco: '0', cv: '0', base: '0' });
    D().abcA.forEach(a => a.q.push('0')); renderAbcTabelas(); calcular();
  } else if (el.id === 'btnExemplo') {
    ST[ST.modo] = clone(EXEMPLOS[ST.modo]); tudo();
  } else if (el.id === 'btnImprimir') {
    window.print();
  }
});

// abre na última aba usada
$$('.abas button').forEach(b => b.classList.toggle('ativa', b.dataset.aba === ST.aba));
$$('.aba').forEach(s => s.classList.toggle('ativa', s.id === ST.aba));
renderGlossario();
tudo();
