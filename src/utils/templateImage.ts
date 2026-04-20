/**
 * Resolve a imagem de um template/leilão seguindo a estratégia mista:
 * - Se existir image_key → usa imagem do storage (product-images bucket)
 * - Caso contrário → usa image_url (gerada por IA ou upload antigo)
 * - Fallback final → placeholder
 */
const SUPABASE_URL = "https://tlcdidkkxigofdhxnzzo.supabase.co";

export function resolveTemplateImage(t: {
  image_key?: string | null;
  image_url?: string | null;
}): string {
  if (t?.image_key) {
    return `${SUPABASE_URL}/storage/v1/object/public/product-images/${t.image_key}`;
  }
  return t?.image_url || '/placeholder.svg';
}

export type ImageBadgeKind = 'storage' | 'ai' | 'none';

export function getImageBadgeKind(t: {
  image_key?: string | null;
  image_url?: string | null;
}): ImageBadgeKind {
  if (t?.image_key) return 'storage';
  if (t?.image_url) return 'ai';
  return 'none';
}
