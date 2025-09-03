import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// FUNÇÃO PARA FORMATAR PREÇOS EM REAIS (agora direto do banco)
export function formatPrice(priceInReais: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(priceInReais || 0);
}

// FUNÇÃO PARA CALCULAR PARTICIPANTES FICTÍCIOS (÷7) APENAS PARA USUÁRIOS
export function getDisplayParticipants(totalBids: number, realParticipants: number, isAdmin: boolean = false) {
  // Se é admin, mostra dados reais
  if (isAdmin) {
    return realParticipants;
  }
  
  // Se é usuário regular, mostra proporção fictícia de ~7 lances por participante
  return Math.max(1, Math.floor(totalBids / 7));
}
