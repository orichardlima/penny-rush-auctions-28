import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ValidationResult {
  available: boolean;
  exists: boolean;
  value: string;
  error?: string;
}

interface FieldValidation {
  email: ValidationResult | null;
  cpf: ValidationResult | null;
}

export const useFieldValidation = () => {
  const [validationState, setValidationState] = useState<FieldValidation>({
    email: null,
    cpf: null,
  });
  const [isValidating, setIsValidating] = useState({
    email: false,
    cpf: false,
  });

  const checkAvailability = useCallback(async (email?: string, cpf?: string) => {
    if (!email && !cpf) return;

    const fieldToValidate = email ? 'email' : 'cpf';
    setIsValidating(prev => ({ ...prev, [fieldToValidate]: true }));

    try {
      const { data, error } = await supabase.functions.invoke('check-availability', {
        body: { email, cpf }
      });

      if (error) {
        console.error('Error checking availability:', error);
        // Set error state instead of showing toast
        setValidationState(prev => ({
          ...prev,
          [fieldToValidate]: {
            available: false,
            exists: false,
            value: email || cpf || '',
            error: 'Erro na verificação'
          }
        }));
        return;
      }

      setValidationState(prev => ({
        ...prev,
        email: email ? data.email : prev.email,
        cpf: cpf ? data.cpf : prev.cpf,
      }));

    } catch (error) {
      console.error('Error checking availability:', error);
      // Set error state instead of showing toast
      setValidationState(prev => ({
        ...prev,
        [fieldToValidate]: {
          available: false,
          exists: false,
          value: email || cpf || '',
          error: 'Erro na conexão'
        }
      }));
    } finally {
      setIsValidating(prev => ({ ...prev, [fieldToValidate]: false }));
    }
  }, []);

  const validateEmail = useCallback((email: string) => {
    if (!email || !email.includes('@')) return;
    checkAvailability(email);
  }, [checkAvailability]);

  const validateCPF = useCallback((cpf: string) => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return;
    checkAvailability(undefined, cpf);
  }, [checkAvailability]);

  const clearValidation = useCallback((field: 'email' | 'cpf') => {
    setValidationState(prev => ({
      ...prev,
      [field]: null,
    }));
  }, []);

  return {
    validationState,
    isValidating,
    validateEmail,
    validateCPF,
    clearValidation,
  };
};