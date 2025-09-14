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

// FUNÇÃO PARA FORMATAR NOME DE USUÁRIO PARA EXIBIÇÃO (APENAS PRIMEIRO E SEGUNDO NOME)
export function formatUserNameForDisplay(fullName: string): string {
  if (!fullName || fullName === 'Usuário') return 'Usuário';
  
  const nameParts = fullName.trim().split(' ').filter(part => part.length > 0);
  
  if (nameParts.length >= 2) {
    return `${nameParts[0]} ${nameParts[1]}`;
  } else if (nameParts.length === 1) {
    return nameParts[0];
  }
  
  return 'Usuário';
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
