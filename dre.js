/* Linhas do documento (DRE): cada linha com seu grupo; os totais alimentam os dados base */
'use strict';

const DRE = (() => {
  const GRUPOS = [
    ['receita', 'Receita bruta'],
    ['custo_variavel', 'Custo variável'],
    ['despesa_variavel', 'Despesa variável (impostos s/ venda, comissões, cartão)'],
    ['custo_fixo', 'Custo fixo'],
    ['despesa_fixa', 'Despesa fixa'],
    ['depreciacao', 'Depreciação / amortização (fixo que não sai do caixa)'],
    ['parcela', 'Parcela de empréstimo (sai do caixa, não é custo)'],
    ['investimento', 'Investimento (fora do resultado)'],
    ['perda', 'Perda anormal (fora da análise)'],
    ['ignorar', 'Subtotal / total (não somar)']
  ];
  const NOME = Object.fromEntries(GRUPOS);
  const el = id => document.getElementById(id);
  const fmt = v => (Math.round(v * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false });

  function totais(linhas) {
    const t = Object.fromEntries(GRUPOS.map(([k]) => [k, 0]));
    (linhas || []).forEach(l => { if (l.g in t) t[l.g] += Math.abs(parse(l.v)); });
    return t;
  }

  // Escreve os totais das linhas nos campos dos dados base do modo indicado
  function sincronizar(alvo) {
    if (!alvo.linhas || !alvo.linhas.length) return;
    const t = totais(alvo.linhas);
    alvo.cfp = fmt(t.custo_fixo + t.depreciacao);
    alvo.df = fmt(t.despesa_fixa);
    alvo.naoDes = fmt(t.depreciacao);
    alvo.parc = fmt(t.parcela);
    alvo.rec = fmt(t.receita);
    alvo.cvT = fmt(t.custo_variavel);
    alvo.dvT = fmt(t.despesa_variavel);
    const vol = parse(alvo.volVend);
    if (alvo.forma !== 'dre' && vol > 0 && t.receita > 0) {
      alvo.preco = fmt(t.receita / vol);
      alvo.cv = fmt(t.custo_variavel / vol);
      alvo.dvp = fmt(t.despesa_variavel / t.receita * 100);
    }
  }

  function render() {
    const linhas = D().linhas || [];
    el('cardLinhas').hidden = !linhas.length;
    if (!linhas.length) return;
    el('tabLinhas').innerHTML = `<thead><tr><th>Linha</th><th>Valor (R$/mês)</th><th>Grupo</th><th></th></tr></thead><tbody>` +
      linhas.map((l, i) => `<tr><td><input data-lin="${i}" data-f="d" value="${esc(l.d)}"></td><td><input data-lin="${i}" data-f="v" value="${esc(l.v)}"></td>` +
        `<td><select data-lin="${i}" data-f="g">${GRUPOS.map(([k, n]) => `<option value="${k}"${k === l.g ? ' selected' : ''}>${n}</option>`).join('')}</select></td>` +
        `<td><button class="btn x" data-dellin="${i}" title="Remover">×</button></td></tr>`).join('') + '</tbody>';
    resumo();
  }

  function resumo() {
    const t = totais(D().linhas);
    const varT = t.custo_variavel + t.despesa_variavel, mc = t.receita - varT, fixos = t.custo_fixo + t.depreciacao + t.despesa_fixa;
    const imc = t.receita ? mc / t.receita : NaN;
    el('resLinhas').innerHTML = `<div class="kpis" style="margin-top:12px">${[
      kpi('Receita bruta', brl(t.receita)),
      kpi('Custos e despesas variáveis', brl(varT), `${brl(t.custo_variavel)} custos + ${brl(t.despesa_variavel)} despesas`),
      kpi('Margem de contribuição', brl(mc), `IMC ${pct(imc)}`, mc >= 0 ? 'bom' : 'ruim'),
      kpi('Fixos (CF + DF)', brl(fixos), `${brl(t.custo_fixo + t.depreciacao)} custos + ${brl(t.despesa_fixa)} despesas`),
      kpi('Resultado do mês', brl(mc - fixos), 'antes de investimentos e perdas', mc - fixos >= 0 ? 'bom' : 'ruim'),
      kpi('Faturamento mínimo (PEC)', brl(imc > 0 ? fixos / imc : NaN), '(CF + DF) ÷ IMC')
    ].join('')}</div>` +
      (t.investimento || t.perda ? `<p class="mini muted">Fora da análise: ${brl(t.investimento)} de investimentos e ${brl(t.perda)} de perdas.</p>` : '') +
      (D().forma !== 'dre' && !(parse(D().volVend) > 0) ? aviso('alerta', 'Para calcular preço e custo por unidade, informe o volume vendido nos dados base ou mude a forma de informar para "Totais do mês (DRE)".') : '');
  }

  // Após mudar uma linha: atualiza totais e dados base sem redesenhar a tabela (mantém o foco)
  function mudou() {
    sincronizar(D());
    preencherCampos();
    calcular();
    resumo();
  }

  document.addEventListener('input', e => {
    const i = e.target.dataset.lin;
    if (i === undefined) return;
    D().linhas[+i][e.target.dataset.f] = e.target.value;
    mudou();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.dellin !== undefined) { D().linhas.splice(+b.dataset.dellin, 1); mudou(); render(); }
    else if (b.id === 'addLinha') { D().linhas.push({ d: 'Nova linha', v: '0', g: 'despesa_fixa' }); render(); }
    else if (b.id === 'limparLinhas') { D().linhas = []; render(); calcular(); }
  });

  return { render, sincronizar, GRUPOS: GRUPOS.map(g => g[0]) };
})();

DRE.render(); // app.js desenha antes deste arquivo carregar
