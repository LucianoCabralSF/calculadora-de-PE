// Instruções e formato de resposta usados pelo servidor (api/ler.js)
const S = { type: 'string' };
const obj = props => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
const campos = ks => obj(Object.fromEntries(ks.map(k => [k, S])));
export const SCHEMA = obj({
  modo: { type: 'string', enum: ['produtos', 'servicos'] },
  resumo: S,
  base: campos(['produto', 'un', 'preco', 'cv', 'dvp', 'cfp', 'df', 'naoDes', 'parc', 'lucroDes', 'volVend', 'volProd', 'cap']),
  pedido: campos(['pDesc', 'pq', 'pp', 'pcv', 'pdv', 'prat', 'pinc', 'pcan']),
  preco: campos(['mkImp', 'mkCom', 'mkDF', 'mkLuc', 'pMerc', 'metaMg']),
  mixRec: S, mixH: S,
  mix: { type: 'array', items: campos(['nome', 'preco', 'cv', 'dvp', 'dem', 'h']) },
  abcP: { type: 'array', items: campos(['nome', 'vol', 'preco', 'cv', 'base']) },
  abcA: { type: 'array', items: obj({ nome: S, custo: S, dir: S, q: { type: 'array', items: S } }) }
});

export function montarPrompt(texto, nomeArq, extra) {
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
- base.cfp: custos fixos de produção/operação por MÊS; base.df: despesas fixas administrativas/comerciais por MÊS; base.naoDes: parte dos fixos que é depreciação/amortização por MÊS; base.parc: parcelas de empréstimos/financiamentos pagas por MÊS (saem do caixa, não são custo); base.lucroDes: lucro desejado por MÊS.
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
