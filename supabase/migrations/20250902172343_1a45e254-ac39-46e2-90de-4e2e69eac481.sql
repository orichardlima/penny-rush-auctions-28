-- Allow admins to delete bid purchases (needed for package deletion)
CREATE POLICY "Admins can delete all purchases" 
ON public.bid_purchases 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_admin = true
  )
);