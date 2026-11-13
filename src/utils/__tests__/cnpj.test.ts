import { describe, it, expect } from 'vitest';
import { validateCNPJ, formatCNPJ } from '../validators';

describe('CNPJ', () => {
  it('aceita CNPJ válido', () => expect(validateCNPJ('11.222.333/0001-81')).toBe(true));
  it('recusa dígito verificador errado', () => expect(validateCNPJ('11.222.333/0001-82')).toBe(false));
  it('recusa dígitos repetidos', () => expect(validateCNPJ('11111111111111')).toBe(false));
  it('formata com máscara', () => expect(formatCNPJ('11222333000181')).toBe('11.222.333/0001-81'));
});
