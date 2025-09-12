import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, X, Sparkles } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';

export const SignupBonusWelcome: React.FC = () => {
  const { profile, user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);

  useEffect(() => {
    const checkSignupBonus = async () => {
      if (!user || !profile) return;

      // Melhor detecção: verificar se recebeu bônus e se foi nos últimos 3 dias
      const bonusReceived = profile.signup_bonus_received || false;
      const bonusDate = profile.signup_bonus_date ? new Date(profile.signup_bonus_date) : null;
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      // Check if user already dismissed the welcome message
      const dismissed = localStorage.getItem(`signup-bonus-dismissed-${user.id}`);

      // Mostrar se: recebeu bônus + foi nos últimos 3 dias + não foi dispensado
      const shouldShow = bonusReceived && 
                        bonusDate && 
                        bonusDate > threeDaysAgo && 
                        !dismissed;

      if (shouldShow) {
        const amount = profile.signup_bonus_amount || 0;
        if (amount > 0) {
          setBonusAmount(amount);
          setShowWelcome(true);
        }
      }
    };

    checkSignupBonus();
  }, [user, profile]);

  const handleDismiss = () => {
    if (user) {
      localStorage.setItem(`signup-bonus-dismissed-${user.id}`, 'true');
    }
    setShowWelcome(false);
  };

  if (!showWelcome) {
    return null;
  }

  return (
    <Card className="border-primary bg-gradient-to-r from-primary/5 to-secondary/5 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Gift className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Bem-vindo(a)!
                <Sparkles className="h-4 w-4 text-yellow-500" />
              </CardTitle>
              <CardDescription>
                Você recebeu um bônus especial de cadastro
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="bg-background/60 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-lg">
                🎉 {bonusAmount} lances gratuitos!
              </p>
              <p className="text-sm text-muted-foreground">
                Você recebeu <strong>{bonusAmount} lances gratuitos</strong> como bônus de boas-vindas! Use-os para participar dos leilões e ganhar produtos incríveis com descontos de até 95%.
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {bonusAmount}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Lances
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={handleDismiss} size="sm">
            Entendi, vamos começar!
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};