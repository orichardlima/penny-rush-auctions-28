type ErrorType = 
  | 'auth'
  | 'network'
  | 'database'
  | 'validation'
  | 'permission'
  | 'unknown';

interface UserFriendlyError {
  title: string;
  description: string;
  type: ErrorType;
}

export function handleError(error: unknown): UserFriendlyError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Erros de autenticação
  if (lowerMessage.includes('invalid login') || lowerMessage.includes('invalid password')) {
    return {
      title: "Credenciais inválidas",
      description: "E-mail ou senha incorretos. Verifique e tente novamente.",
      type: 'auth'
    };
  }

  if (lowerMessage.includes('email not confirmed')) {
    return {
      title: "E-mail não confirmado",
      description: "Verifique sua caixa de entrada e confirme seu e-mail.",
      type: 'auth'
    };
  }

  if (lowerMessage.includes('user already registered') || lowerMessage.includes('already been registered')) {
    return {
      title: "E-mail já cadastrado",
      description: "Este e-mail já está em uso. Tente fazer login ou use outro e-mail.",
      type: 'auth'
    };
  }

  if (lowerMessage.includes('password') && lowerMessage.includes('weak')) {
    return {
      title: "Senha fraca",
      description: "A senha deve ter pelo menos 6 caracteres.",
      type: 'validation'
    };
  }

  // Erros de rede
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('failed to fetch')) {
    return {
      title: "Erro de conexão",
      description: "Verifique sua conexão com a internet e tente novamente.",
      type: 'network'
    };
  }

  if (lowerMessage.includes('timeout')) {
    return {
      title: "Tempo esgotado",
      description: "A operação demorou muito. Verifique sua conexão e tente novamente.",
      type: 'network'
    };
  }

  // Erros de banco de dados
  if (lowerMessage.includes('duplicate key') || lowerMessage.includes('23505')) {
    return {
      title: "Registro duplicado",
      description: "Este registro já existe no sistema.",
      type: 'database'
    };
  }

  if (lowerMessage.includes('foreign key') || lowerMessage.includes('23503')) {
    return {
      title: "Erro de referência",
      description: "Não foi possível completar a operação. Dados relacionados não encontrados.",
      type: 'database'
    };
  }

  if (lowerMessage.includes('null value') || lowerMessage.includes('23502')) {
    return {
      title: "Dados incompletos",
      description: "Preencha todos os campos obrigatórios.",
      type: 'validation'
    };
  }

  if (lowerMessage.includes('check constraint') || lowerMessage.includes('23514')) {
    return {
      title: "Dados inválidos",
      description: "Os dados informados não são válidos. Verifique e tente novamente.",
      type: 'validation'
    };
  }

  // Erros de permissão
  if (lowerMessage.includes('permission denied') || lowerMessage.includes('rls') || lowerMessage.includes('policy')) {
    return {
      title: "Acesso negado",
      description: "Você não tem permissão para realizar esta ação.",
      type: 'permission'
    };
  }

  if (lowerMessage.includes('jwt') || lowerMessage.includes('token') || lowerMessage.includes('unauthorized')) {
    return {
      title: "Sessão expirada",
      description: "Sua sessão expirou. Faça login novamente.",
      type: 'auth'
    };
  }

  // Erros específicos de leilão
  if (lowerMessage.includes('saldo') || lowerMessage.includes('balance')) {
    return {
      title: "Saldo insuficiente",
      description: "Você não tem lances suficientes. Compre mais lances para continuar.",
      type: 'validation'
    };
  }

  // Erro genérico
  return {
    title: "Ops! Algo deu errado",
    description: "Ocorreu um erro inesperado. Tente novamente em alguns instantes.",
    type: 'unknown'
  };
}

// Helper para usar com toast
export function getErrorToast(error: unknown) {
  const { title, description } = handleError(error);
  return { title, description, variant: "destructive" as const };
}
