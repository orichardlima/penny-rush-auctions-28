import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Eye, 
  Shield, 
  ArrowUpCircle, 
  Users, 
  Headphones 
} from "lucide-react";

const benefits = [
  {
    icon: TrendingUp,
    title: "Repasses Proporcionais",
    description: "Distribuição justa baseada no valor do seu aporte em relação ao fundo total de parceiros.",
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20"
  },
  {
    icon: Eye,
    title: "100% Transparente",
    description: "Dashboard exclusivo com acompanhamento em tempo real de todos os seus repasses e métricas.",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20"
  },
  {
    icon: Shield,
    title: "Segurança Jurídica",
    description: "Contrato claro com termos definidos. Você sabe exatamente o que esperar.",
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20"
  },
  {
    icon: ArrowUpCircle,
    title: "Upgrade Disponível",
    description: "Possibilidade de migrar para planos maiores pagando apenas a diferença.",
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20"
  },
  {
    icon: Users,
    title: "Indicação Remunerada",
    description: "Ganhe bônus de 5% sobre o aporte de cada novo parceiro que você indicar.",
    color: "text-pink-600",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20"
  },
  {
    icon: Headphones,
    title: "Suporte Prioritário",
    description: "Atendimento exclusivo e prioritário para todos os parceiros da plataforma.",
    color: "text-cyan-600",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20"
  }
];

export const InvestmentBenefits = () => {
  return (
    <section className="py-16 sm:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
            Vantagens Exclusivas
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold text-foreground mb-4">
            Por que ser um Parceiro?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Benefícios exclusivos para quem faz parte do crescimento da plataforma
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {benefits.map((benefit, index) => (
            <Card 
              key={index} 
              className={`border-2 ${benefit.borderColor} hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
            >
              <CardContent className="p-6">
                <div className={`w-12 h-12 ${benefit.bgColor} rounded-xl flex items-center justify-center mb-4`}>
                  <benefit.icon className={`w-6 h-6 ${benefit.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
