-- Configure auction-images bucket with size limit and MIME type restrictions
UPDATE storage.buckets 
SET 
  file_size_limit = 5242880, -- 5MB in bytes
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE id = 'auction-images';