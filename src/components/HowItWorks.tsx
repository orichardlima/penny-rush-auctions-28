import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Gavel, Timer, Trophy, DollarSign, Users } from "lucide-react";

export const HowItWorks = () => {
  const steps = [
    {
      icon: <ShoppingCart className="w-8 h-8" />,
      title: "Compre Lances",
      description: "Adquira pacotes de lances a partir de R$ 15. Cada lance custa R$ 1,00 para usar.",
      highlight: "R$ 1,00 por lance"
    },
    {
      icon: <Gavel className="w-8 h-8" />,
      title: "Dê Seus Lances",
      description: "Participe dos leilões ativos. Cada lance aumenta o preço em R$ 0,01.",
      highlight: "+R$ 0,01 por lance"
    },
    {
      icon: <Timer className="w-8 h-8" />,
      title: "Timer Reseta",
      description: "Cada lance reinicia o cronômetro para 15 segundos. Fique atento!",
      highlight: "15 segundos"
    },
    {
      icon: <Trophy className="w-8 h-8" />,
      title: "Ganhe o Produto",
      description: "Seja o último a dar lance quando o tempo acabar e leve o produto!",
      highlight: "Você venceu!"
    }
  ];

  const tips = [
    {
      icon: <DollarSign className="w-5 h-5" />,
      title: "Economia Real",
      text: "Produtos de R$ 5.000 podem ser seus por menos de R$ 50!"
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: "Comunidade Ativa",
      text: "Milhares de pessoas participando 24/7"
    },
    {
      icon: <Timer className="w-5 h-5" />,
      title: "Ação Constante",
      text: "Leilões finalizando a cada minuto"
    }
  ];

  return (
    <section className="py-16 bg-background" id="como-funciona">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            Como Funciona o Leilão de Centavos
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            É simples, rápido e emocionante! Siga estes passos e comece a ganhar produtos incríveis.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {steps.map((step, index) => (
            <Card key={index} className="p-6 text-center hover:shadow-elegant transition-all duration-300 hover:-translate-y-1">
              <div className="bg-gradient-primary text-primary-foreground w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-glow">
                {step.icon}
              </div>
              <Badge variant="secondary" className="mb-3">
                Passo {index + 1}
              </Badge>
              <h3 className="text-lg font-semibold mb-3">{step.title}</h3>
              <p className="text-muted-foreground text-sm mb-3">{step.description}</p>
              <Badge variant="outline" className="text-xs">
                {step.highlight}
              </Badge>
            </Card>
          ))}
        </div>

        {/* Tips */}
        <div className="bg-muted/50 rounded-lg p-8">
          <h3 className="text-xl font-semibold text-center mb-6">Por que escolher o LeilãoCentavos?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tips.map((tip, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="bg-accent text-accent-foreground p-2 rounded-lg flex-shrink-0">
                  {tip.icon}
                </div>
                <div>
                  <h4 className="font-semibold mb-1">{tip.title}</h4>
                  <p className="text-sm text-muted-foreground">{tip.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};