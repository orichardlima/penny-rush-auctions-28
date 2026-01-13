import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

const SITE_NAME = "Show de Lances";
const DEFAULT_IMAGE = "/lovable-uploads/1b939d7a-c3c8-4580-96bd-d2a6f01f2491.png";

export const SEOHead = ({ 
  title, 
  description, 
  image = DEFAULT_IMAGE,
  url 
}: SEOHeadProps) => {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  return (
    <Helmet>
      {/* Title */}
      <title>{fullTitle}</title>
      
      {/* Meta Description */}
      <meta name="description" content={description} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      
      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      
      {/* Canonical URL */}
      {currentUrl && <link rel="canonical" href={currentUrl} />}
    </Helmet>
  );
};
