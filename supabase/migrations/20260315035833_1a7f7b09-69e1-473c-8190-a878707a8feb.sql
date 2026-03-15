-- Fix propagate_binary_points (2 overloads)
ALTER FUNCTION public.propagate_binary_points(uuid, integer, text) SET search_path = public;
ALTER FUNCTION public.propagate_binary_points(uuid, integer, text, uuid) SET search_path = public;