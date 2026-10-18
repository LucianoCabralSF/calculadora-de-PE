/* Explicações dos campos: aparecem depois de 2 segundos com o mouse parado em cima */
'use strict';

const DICAS = (() => {
  const ESPERA = 2000;
  // [texto para Produtos, texto para Serviços] — um só texto quando vale para os dois
  const T = {
    produto: 'Nome do produto, linha ou negócio que está sendo analisado. Serve só para identificar a análise.',
    un: ['Como o produto é vendido e contado: litro, unidade, caixa, kg. Todos os valores "por unidade" usam essa medida.', 'Como o serviço é cobrado e contado: hora, atendimento, projeto, consulta. Todos os valores "por unidade" usam essa medida.'],
    preco: 'Quanto o cliente paga por unidade, já com impostos (receita bruta ÷ quantidade vendida).',
    cv: ['Quanto se gasta a mais para produzir UMA unidade: matéria-prima, embalagem, insumos. Se não produzir, esse gasto não existe.', 'Quanto se gasta a mais para entregar UMA unidade do serviço: profissional pago por hora/projeto, material usado, licença por uso, deslocamento.'],
    dvp: 'Gastos de venda que acompanham o preço, em % dele: impostos sobre a nota (Simples, ISS, ICMS), comissões, taxa de cartão, frete de entrega. Ex.: Simples 8% + cartão 2% = 10.',
    cfp: ['Custos da fábrica que não mudam com o volume no mês: aluguel do galpão, salários fixos da produção, depreciação das máquinas, seguro. São pagos mesmo se não produzir nada.', 'Custos da operação que não mudam com o volume no mês: salários fixos da equipe técnica, servidores, softwares, depreciação de equipamentos. São pagos mesmo sem clientes.'],
    df: 'Despesas fixas fora da produção/entrega: administrativo, sede, contador, sistemas, marketing fixo, juros. Também são pagas independentemente das vendas.',
    naoDes: 'Parte dos fixos que não sai do caixa no mês, como depreciação e amortização. É usada no ponto de equilíbrio financeiro, que olha só o dinheiro que sai de fato.',
    parc: 'Parcelas de empréstimos ou financiamentos (o principal). Não são custo, mas tiram dinheiro do caixa, por isso entram no ponto de equilíbrio financeiro.',
    lucroDes: 'Quanto os sócios esperam ganhar por mês para valer a pena investir no negócio (custo de oportunidade). Entra no ponto de equilíbrio econômico.',
    volVend: ['Quantas unidades são vendidas por mês, em média.', 'Quantas horas/atendimentos/projetos são faturados por mês, em média.'],
    volProd: 'Quantas unidades são produzidas no mês. Se for diferente do vendido, a diferença vai para o estoque e muda o lucro pela absorção.',
    cap: ['Máximo que a fábrica consegue produzir por mês com a estrutura atual, sem aumentar os custos fixos.', 'Máximo que a equipe consegue entregar por mês (horas faturáveis disponíveis), sem contratar mais gente.'],
    rec: 'Receita bruta do mês, antes de impostos e descontos (primeira linha da DRE).',
    cvT: ['Total do mês dos custos que variam com o volume: matéria-prima, mercadoria vendida, embalagens, insumos.', 'Total do mês dos custos que variam com o volume: terceirizados por demanda, materiais, repasses por procedimento.'],
    dvT: 'Total do mês das despesas que acompanham as vendas: impostos sobre a nota, comissões, taxas de cartão, fretes de entrega.',
    capR: 'Quanto daria para faturar por mês sem aumentar os custos fixos. Opcional; serve para medir a capacidade ociosa.',
    desc: 'Simula um desconto no preço: mostra a nova margem e quanto a mais seria preciso vender só para manter o lucro de hoje.',
    pDesc: 'Uma descrição curta do pedido ou proposta que está sendo avaliado.',
    pq: 'Quantidade pedida, na mesma unidade dos dados base.',
    pp: 'Preço por unidade que o cliente está oferecendo.',
    pcv: 'Custo variável por unidade do item pedido (pode ser diferente do produto principal).',
    pdv: 'Impostos, comissões e fretes deste pedido, em % do preço oferecido.',
    prat: 'O "custo fixo por unidade" que o relatório contábil (absorção) mostra. É usado só para comparar com a visão gerencial; esse fixo existe de qualquer jeito.',
    pinc: 'Gastos que só existem se aceitar o pedido: rótulo especial, frete, hora extra, setup, deslocamento.',
    pcan: 'Vendas normais que deixariam de acontecer por causa do pedido (por falta de capacidade ou porque o cliente compraria de qualquer forma). A margem perdida é descontada.',
    mixRec: 'O recurso que limita a produção/entrega: horas de máquina, de tanque, de um especialista. É por ele que se decide a prioridade.',
    mixH: 'Quanto desse recurso escasso existe por mês (ex.: 900 horas de tanque).',
    mkBase: 'De qual custo o markup parte: o custo cheio (já com fixos rateados) ou só o variável (aí os fixos entram no % de despesas fixas).',
    mkImp: 'Impostos sobre a venda, em % do preço.',
    mkCom: 'Comissões, fretes e taxas de cartão, em % do preço.',
    mkDF: 'Quanto as despesas fixas representam da receita, em %. Ex.: R$ 10 mil de despesas fixas sobre R$ 200 mil de receita = 5.',
    mkLuc: 'Lucro que se quer embutir no preço, em % do preço.',
    pMerc: 'Preço que o mercado aceita pagar (concorrência, valor percebido). É o ponto de partida do custo-meta.',
    metaMg: 'Margem que os sócios querem sobre o preço de mercado. O que sobra depois de impostos, despesas e essa margem é o custo máximo permitido.',
    // tabelas
    'mix.nome': 'Nome do produto/serviço.', 'mix.preco': 'Preço por unidade.', 'mix.cv': 'Custo variável por unidade.',
    'mix.dvp': 'Despesas variáveis em % do preço.', 'mix.dem': 'Quanto o mercado compraria por mês, no máximo.',
    'mix.h': 'Quanto do recurso escasso uma unidade consome (ex.: 0,025 hora de tanque por litro).',
    'abcP.nome': 'Produto, serviço ou tipo de cliente.', 'abcP.vol': 'Quantidade vendida por mês.', 'abcP.preco': 'Preço por unidade.',
    'abcP.cv': 'Custo variável/direto por unidade.', 'abcP.base': 'Base do rateio tradicional: horas de mão de obra direta (ou horas trabalhadas) por unidade.',
    'abcA.nome': 'Atividade de apoio que consome recursos: setup, inspeção, compras, atendimento, retrabalho...',
    'abcA.custo': 'Quanto essa atividade custa por mês (pessoas, sistemas, materiais que ela usa).',
    'abcA.dir': 'O que provoca o custo da atividade e serve para distribuí-lo: nº de setups, de inspeções, de pedidos, de chamados.',
    'abcA.q': 'Quantas vezes o direcionador acontece para este produto/serviço no mês.',
    'lin.d': 'Nome da linha como está no documento.', 'lin.v': 'Valor mensal da linha (sempre positivo).',
    'lin.g': 'Grupo da linha. Ao trocar, os totais e os dados base se recalculam. "Subtotal" não é somado, para não contar duas vezes.',
    iaArquivo: 'Escolha um ou mais arquivos: PDF, Word, Excel, CSV ou fotos/prints (JPG, PNG) de uma DRE, planilha ou slide. PDF escaneado também funciona.',
    iaCaso: 'Escreva ou cole o caso com suas palavras: a situação da empresa, os números que você conhece e a decisão a tomar. A IA interpreta e preenche a calculadora; depois o Controller consultivo avalia o caso com você.',
    iaExtra: 'Opcional: diga à IA no que focar. Ex.: "use só a linha IPA", "valores de julho", "a capacidade é 2.000 horas".',
    chatTexto: 'Pergunte sobre os números que estão na calculadora. Enter envia; Shift+Enter quebra a linha.'
  };

  let timer = null, alvo = null;
  const balao = document.createElement('div');
  balao.className = 'dica'; balao.hidden = true; balao.setAttribute('role', 'tooltip');
  document.body.appendChild(balao);

  function chave(el) {
    const campo = el.closest('[data-k],[data-arr],[data-lin],[data-q],#iaArquivo,#iaExtra,#iaCaso,#chatTexto') ||
      el.closest('label.f, div.f')?.querySelector('[data-k],#iaArquivo,#iaExtra,#iaCaso');
    if (!campo) return [null, null];
    let k = campo.dataset.k || campo.id;
    if (campo.dataset.arr) k = campo.dataset.arr + '.' + (campo.dataset.q !== undefined ? 'q' : campo.dataset.f);
    if (campo.dataset.lin !== undefined) k = 'lin.' + campo.dataset.f;
    return [k, campo.closest('label.f, div.f, td') || campo];
  }
  function texto(k) {
    const t = T[k];
    return Array.isArray(t) ? t[isServ() ? 1 : 0] : t;
  }
  function mostrar(k, perto) {
    const t = texto(k);
    if (!t) return;
    balao.textContent = t;
    balao.hidden = false;
    const r = perto.getBoundingClientRect(), b = balao.getBoundingClientRect();
    let top = r.bottom + 6;
    if (top + b.height > innerHeight - 8) top = r.top - b.height - 6;
    const left = Math.max(8, Math.min(r.left, innerWidth - b.width - 8));
    balao.style.top = top + 'px'; balao.style.left = left + 'px';
  }
  function esconder() { clearTimeout(timer); timer = null; alvo = null; balao.hidden = true; }

  let mx = -1, my = -1;
  function contar(alvoEl) {
    const [k, perto] = chave(alvoEl);
    if (!k) { if (alvo || !balao.hidden) esconder(); return; }
    if (perto === alvo && !balao.hidden) return;
    if (perto !== alvo) balao.hidden = true;
    alvo = perto;
    clearTimeout(timer);
    timer = setTimeout(() => mostrar(k, perto), ESPERA);
  }
  // Cada movimento reinicia a contagem: o balão só abre com o mouse parado 2 s sobre o campo
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; contar(e.target); });
  // Ao rolar a página, o campo sob o mouse muda: esconde e recomeça a contar a partir de onde o mouse está
  document.addEventListener('scroll', () => {
    esconder();
    if (mx < 0) return;
    const sob = document.elementFromPoint(mx, my);
    if (sob) contar(sob);
  }, true);
  ['keydown', 'mousedown'].forEach(ev => document.addEventListener(ev, esconder, true));

  return { esconder };
})();
