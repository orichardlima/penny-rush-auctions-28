import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Link as LinkIcon,
  MousePointerClick,
  UserPlus,
  ShoppingCart,
  Gavel,
  Users,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Copy,
  Smartphone,
  Share2,
  QrCode,
  CalendarCheck,
  Info,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const PartnerGuide = () => {
  const navigate = useNavigate();

  const handleBuyBids = () => {
    navigate("/pacotes");
  };

  const exampleLink = "showdelances.com/r/SEUCODIGO";

  const scoringCards = [
    {
      icon: <MousePointerClick className="w-6 h-6" />,
      title: "Clique único qualificado",
      points: "0,2 ponto",
      description: "Cada visitante real que acessar seu link. Cliques repetidos do mesmo IP ou dispositivo não contam.",
    },
    {
      icon: <UserPlus className="w-6 h-6" />,
      title: "Novo cadastro validado",
      points: "5 pontos",
      description: "Quando alguém se cadastra na plataforma através do seu link e é um usuário real.",
    },
    {
      icon: <ShoppingCart className="w-6 h-6" />,
      title: "Compra de créditos/lances",
      points: "8 pontos",
      description: "Quando seu indicado compra pacotes de lances e o pagamento é confirmado.",
    },
    {
      icon: <Gavel className="w-6 h-6" />,
      title: "Participação em leilão",
      points: "4 pontos",
      description: "Quando o usuário indicado por você participa ativamente de um leilão.",
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Novo parceiro de expansão",
      points: "10 pontos",
      description: "Quando alguém se torna parceiro de expansão através do seu link.",
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Aporte/plano aprovado",
      points: "20 pontos",
      description: "Quando o novo parceiro realiza o aporte e ativa seu plano. Pode qualificar automaticamente.",
    },
  ];

  const sharingTips = [
    {
      icon: <Smartphone className="w-5 h-5" />,
      title: "Stories e redes sociais",
      text: "Compartilhe seu link nos stories do Instagram, TikTok, WhatsApp e status. Quanto mais pessoas reais visualizarem, maior a chance de conversão.",
    },
    {
      icon: <Share2 className="w-5 h-5" />,
      title: "Grupos e comunidades",
      text: "Envie para grupos de amigos, familiares e comunidades que tenham interesse em leilões ou em ser parceiro.",
    },
    {
      icon: <QrCode className="w-5 h-5" />,
      title: "QR Code (em breve)",
      text: "Futuramente você poderá gerar um QR Code do seu link para divulgação presencial, eventos e materiais impressos.",
    },
  ];

  const faqItems = [
    {
      q: "Onde encontro meu link de divulgação?",
      a: "Seu link pessoal estará disponível no painel do parceiro, na área 'Minha Divulgação' ou 'Central de Performance'. O formato será algo como showdelances.com/r/SEUCODIGO.",
    },
    {
      q: "Posso clicar no meu próprio link?",
      a: "Não. Cliques do próprio parceiro são registrados, mas não geram pontos e podem ser marcados como suspeitos. O sistema identifica isso automaticamente.",
    },
    {
      q: "O que é um clique qualificado?",
      a: "É um clique real de um visitante diferente do parceiro, sem repetição excessiva do mesmo IP/dispositivo e sem comportamento de bot. Cliques brutos sozinhos não garantem pontos.",
    },
    {
      q: "Como funciona a pontuação semanal?",
      a: "A semana de apuração vai de segunda-feira a domingo, no horário de Brasília/Bahia. Você acumula pontos com base nos eventos reais gerados pelo seu link. A pontuação é recalculada automaticamente durante a semana.",
    },
    {
      q: "O que é 'dia ativo'?",
      a: "É um dia em que você gerou pelo menos 1 ponto qualificado na plataforma através do seu link. A constância ajuda, mas conversões reais têm muito mais peso.",
    },
    {
      q: "Preciso postar todo dia?",
      a: "Não obrigatoriamente. O objetivo é performance real. Se você gerar uma conversão forte (compra, novo parceiro com aporte, etc.), pode se qualificar mesmo sem postar todos os dias.",
    },
    {
      q: "Comprovação por print ou OCR?",
      a: "Não. A nova Central de Performance não exige print, OCR nem conferência manual de postagens. Ela mede resultados reais: cliques, cadastros, compras e novos parceiros.",
    },
    {
      q: "Pagamento pendente conta como compra?",
      a: "Não. Só pontua quando o pagamento for realmente aprovado. Se for cancelado, reembolsado ou chargeback, os pontos podem ser revertidos.",
    },
    {
      q: "Como sei se estou elegível aos 100% dos repasses?",
      a: "No painel do parceiro você acompanha: pontos acumulados, meta semanal, dias ativos e status de elegibilidade. A meta inicial sugerida é 20 pontos semanais, com pelo menos 3 dias ativos, mas conversões fortes podem qualificar automaticamente.",
    },
    {
      q: "A Central de Performance já está ativa?",
      a: "Atualmente a Central de Performance está em fase de acompanhamento e observação. Os dados estão sendo coletados e validados. A conexão definitiva com os repasses semanais será ativada apenas após aprovação, quando os dados reais mostrarem consistência.",
    },
    {
      q: "Posso usar anúncios pagos?",
      a: "Sim, desde que respeite as regras antifraude. Não é permitido gerar cliques falsos, cadastros fictícios ou qualquer manipulação. Anúncios legítimos em plataformas como Meta Ads, Google Ads e TikTok Ads são bem-vindos.",
    },
    {
      q: "E se alguém clicar no link de outro parceiro depois do meu?",
      a: "A atribuição inicial será por último clique (last click), dentro da janela de atribuição configurada. O histórico completo fica salvo para auditoria.",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Guia do Parceiro - Central de Performance"
        description="Aprenda como divulgar a Show de Lances, acompanhar suas métricas e entender o que conta para a elegibilidade aos repasses semanais."
      />
      <Header userBids={0} onBuyBids={handleBuyBids} />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 sm:py-24 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 max-w-4xl text-center">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              Central de Performance
            </Badge>
            <h1 className="text-3xl sm:text-5xl font-bold text-foreground mb-6">
              Guia do Parceiro de Expansão
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Aprenda a compartilhar seu link de divulgação, acompanhar seus resultados em tempo real e entender o que realmente conta para sua elegibilidade.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/parceiro">
                <Button size="lg">
                  Quero ser parceiro
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/minha-parceria">
                <Button size="lg" variant="outline">
                  Acessar painel do parceiro
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Modo relatório alert */}
        <section className="py-6">
          <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-foreground mb-1">Fase de acompanhamento</h2>
                <p className="text-sm text-muted-foreground">
                  A Central de Performance está em modo de observação. Os dados estão sendo coletados e validados. A conexão com os repasses semanais será ativada gradualmente após análise dos dados reais.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Como funciona o link */}
        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                Como funciona seu link de divulgação
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Cada parceiro tem um link único e rastreável. Quando alguém acessa, se cadastra, compra ou se torna parceiro por meio dele, tudo é contabilizado de forma automática.
              </p>
            </div>

            <Card className="mb-8">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Exemplo de link pessoal
                    </label>
                    <div className="flex items-center gap-2 bg-muted rounded-lg px-4 py-3 font-mono text-sm break-all">
                      <LinkIcon className="w-4 h-4 text-primary flex-shrink-0" />
                      {exampleLink}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="flex-shrink-0"
                    onClick={() => navigator.clipboard.writeText(exampleLink)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar exemplo
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {sharingTips.map((tip, index) => (
                    <div key={index} className="bg-muted/50 rounded-lg p-4">
                      <div className="bg-primary/10 text-primary w-10 h-10 rounded-lg flex items-center justify-center mb-3">
                        {tip.icon}
                      </div>
                      <h3 className="font-semibold mb-2">{tip.title}</h3>
                      <p className="text-sm text-muted-foreground">{tip.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* O que pontua */}
        <section className="py-12 sm:py-16 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                O que gera pontos na Central de Performance
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                A pontuação premia resultados reais. Cliques sozinhos valem pouco. Cadastros, compras, participação em leilões e novos parceiros aprovados têm peso maior.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {scoringCards.map((card, index) => (
                <Card key={index} className="h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="bg-primary/10 text-primary w-12 h-12 rounded-lg flex items-center justify-center">
                        {card.icon}
                      </div>
                      <Badge variant="secondary">{card.points}</Badge>
                    </div>
                    <h3 className="font-semibold mb-2">{card.title}</h3>
                    <p className="text-sm text-muted-foreground">{card.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8 p-4 bg-background rounded-lg border border-border">
              <div className="flex items-start gap-3">
                <CalendarCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Semana de apuração</h3>
                  <p className="text-sm text-muted-foreground">
                    A apuração é semanal, de segunda a domingo, no horário de Brasília/Bahia. A meta inicial sugerida é <strong>20 pontos</strong> na semana, com pelo menos <strong>3 dias ativos</strong>. Esses valores podem ser ajustados pelo administrador.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Como acompanhar */}
        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                Como acompanhar sua performance
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                No painel do parceiro você terá acesso a métricas claras e atualizadas sobre seus resultados de divulgação.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">Métricas da semana</h3>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <MousePointerClick className="w-4 h-4 text-primary" />
                      Cliques brutos e cliques qualificados
                    </li>
                    <li className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-primary" />
                      Cadastros gerados
                    </li>
                    <li className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-primary" />
                      Compras de créditos/lances aprovadas
                    </li>
                    <li className="flex items-center gap-2">
                      <Gavel className="w-4 h-4 text-primary" />
                      Usuários que participaram de leilões
                    </li>
                    <li className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Novos parceiros e aportes aprovados
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">Status de elegibilidade</h3>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Pontos acumulados na semana
                    </li>
                    <li className="flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 text-primary" />
                      Dias ativos contabilizados
                    </li>
                    <li className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary" />
                      Meta semanal e percentual alcançado
                    </li>
                    <li className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      Indicadores de segurança e antifraude
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Regras antifraude */}
        <section className="py-12 sm:py-16 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
            <div className="flex items-start gap-4">
              <div className="bg-destructive/10 text-destructive w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Regras antifraude
                </h2>
                <p className="text-muted-foreground mb-6">
                  A integridade dos dados é fundamental. Eventos manipulados ou falsos não geram pontos e podem resultar em bloqueio da elegibilidade.
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">•</span>
                    Não clique no seu próprio link.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">•</span>
                    Não crie cadastros falsos.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">•</span>
                    Não utilize bots ou automações.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">•</span>
                    Não incentive cliques em massa.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">•</span>
                    Não realize autoindicação com CPF, e-mail ou telefone repetido.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">•</span>
                    Não use e-mails descartáveis para indicar.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
                Dúvidas Frequentes
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                Perguntas e Respostas
              </h2>
              <p className="text-muted-foreground">
                Tudo o que você precisa saber sobre a Central de Performance.
              </p>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
              {faqItems.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="bg-card border border-border rounded-lg px-6 shadow-sm"
                >
                  <AccordionTrigger className="text-left hover:no-underline py-4">
                    <span className="font-medium text-foreground pr-4">
                      {item.q}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-12 sm:py-16 bg-primary/5">
          <div className="container mx-auto px-4 sm:px-6 max-w-3xl text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              Pronto para começar a divulgar?
            </h2>
            <p className="text-muted-foreground mb-8">
              Acesse sua área de parceiro, copie seu link e comece a transformar sua divulgação em resultados reais.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/parceiro">
                <Button size="lg">
                  Tornar-se parceiro
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/faq">
                <Button size="lg" variant="outline">
                  Ver FAQ geral
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default PartnerGuide;
