import { Badge } from "@/components/ui/badge";
import { 
  ListChecks, 
  CreditCard, 
  Rocket, 
  BarChart3, 
  CheckCircle2 
} from "lucide-react";

const steps = [
  {
    icon: ListChecks,
    title: "Escolha seu Plano",
    description: "Selecione entre START, PRO ou ELITE conforme seu perfil de investimento."
  },
  {
    icon: CreditCard,
    title: "Faça seu Aporte",
    description: "Pagamento seguro via PIX. Valor único para ativar sua parceria."
  },
  {
    icon: Rocket,
    title: "Ative seu Contrato",
    description: "Receba acesso imediato ao dashboard exclusivo de parceiros."
  },
  {
    icon: BarChart3,
    title: "Acompanhe Repasses",
    description: "Receba repasses mensais proporcionais ao desempenho da plataforma."
  },
  {
    icon: CheckCircle2,
    title: "Encerramento Automático",
    description: "Contrato fecha automaticamente ao atingir o teto total definido."
  }
];

export const InvestmentTimeline = () => {
  return (
    <section className="py-16 sm:py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
            Processo Simples
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold text-foreground mb-4">
            Como Funciona
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Em 5 passos simples você se torna um parceiro e começa a receber repasses
          </p>
        </div>

        {/* Desktop Timeline */}
        <div className="hidden lg:block max-w-6xl mx-auto">
          <div className="relative">
            {/* Connection line */}
            <div className="absolute top-12 left-0 right-0 h-1 bg-gradient-to-r from-primary via-amber-500 to-green-500 rounded-full" />
            
            <div className="flex justify-between relative">
              {steps.map((step, index) => (
                <div key={index} className="flex flex-col items-center w-1/5 px-2">
                  <div className="relative z-10 w-24 h-24 bg-background rounded-2xl border-2 border-primary/20 flex items-center justify-center shadow-lg mb-4">
                    <step.icon className="w-10 h-10 text-primary" />
                    <div className="absolute -top-3 -right-3 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
                      {index + 1}
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-foreground text-center mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground text-center leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Timeline */}
        <div className="lg:hidden max-w-md mx-auto">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-amber-500 to-green-500" />
            
            <div className="space-y-8">
              {steps.map((step, index) => (
                <div key={index} className="flex gap-4 relative">
                  <div className="relative z-10 w-12 h-12 bg-background rounded-xl border-2 border-primary/20 flex items-center justify-center shadow-lg flex-shrink-0">
                    <step.icon className="w-6 h-6 text-primary" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-xs">
                      {index + 1}
                    </div>
                  </div>
                  <div className="pt-1">
                    <h3 className="text-base font-semibold text-foreground mb-1">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
