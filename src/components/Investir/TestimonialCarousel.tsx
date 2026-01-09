import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Carlos M.",
    plan: "PRO",
    months: 8,
    quote: "Já recebi mais de R$ 4.000 em repasses. A transparência do dashboard é o maior diferencial. Acompanho tudo em tempo real.",
    initials: "CM"
  },
  {
    name: "Ana Paula S.",
    plan: "ELITE",
    months: 6,
    quote: "Comecei com o plano START e fiz upgrade para ELITE. O processo foi super simples e o suporte é excelente.",
    initials: "AS"
  },
  {
    name: "Roberto F.",
    plan: "START",
    months: 4,
    quote: "Mesmo com o plano inicial, os repasses são consistentes. Pretendo fazer upgrade em breve!",
    initials: "RF"
  },
  {
    name: "Marina L.",
    plan: "PRO",
    months: 10,
    quote: "A possibilidade de indicar novos parceiros e ganhar bônus é incrível. Já indiquei 3 amigos.",
    initials: "ML"
  }
];

export const TestimonialCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const currentTestimonial = testimonials[currentIndex];

  return (
    <section className="py-16 sm:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
            Depoimentos
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold text-foreground mb-4">
            O Que Nossos Parceiros Dizem
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Histórias reais de pessoas que estão fazendo parte do nosso crescimento
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Card className="border-2 border-primary/10 shadow-xl relative overflow-hidden">
            {/* Decorative quote */}
            <div className="absolute top-4 right-4 opacity-10">
              <Quote className="w-24 h-24 text-primary" />
            </div>

            <CardContent className="p-8 sm:p-12">
              <div className="flex flex-col items-center text-center">
                <Avatar className="w-20 h-20 mb-6 border-4 border-primary/20">
                  <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                    {currentTestimonial.initials}
                  </AvatarFallback>
                </Avatar>

                <blockquote className="text-lg sm:text-xl text-foreground leading-relaxed mb-6 italic">
                  "{currentTestimonial.quote}"
                </blockquote>

                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-foreground">
                    {currentTestimonial.name}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    Plano {currentTestimonial.plan}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  Parceiro há {currentTestimonial.months} meses
                </span>
              </div>
            </CardContent>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4 pb-8">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={prevTestimonial}
                className="rounded-full"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex gap-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentIndex 
                        ? 'bg-primary w-6' 
                        : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                    }`}
                  />
                ))}
              </div>

              <Button 
                variant="outline" 
                size="icon" 
                onClick={nextTestimonial}
                className="rounded-full"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-4">
            *Depoimentos de parceiros reais. Resultados podem variar conforme o desempenho da plataforma.
          </p>
        </div>
      </div>
    </section>
  );
};
