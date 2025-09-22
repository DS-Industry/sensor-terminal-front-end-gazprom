import { useState } from 'react';
import { getS3LogoUrl } from '../../util/s3Utils';

interface ClientLogoProps {
  client?: string;
  alt?: string;
  className?: string;
}

export default function ClientLogo({ 
  client, 
  alt, 
  className = '', 
}: ClientLogoProps) {
  const [hasError, setHasError] = useState(false);
  
  const logoUrl = client ? getS3LogoUrl(client.toLowerCase()) : "";
  
  const handleError = () => {
    setHasError(true);
  };

  if (hasError || !logoUrl) {
    return (
      <div 
        className={`rounded flex items-center justify-center ${className}`}
      >
        <span className="text-gray-900 text-xl font-medium">
          РОБОТ-МОЙКА
        </span>
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={alt || "logo-client"}
      className={className || "h-12"} 
      onError={handleError}
      loading="lazy"
    />
  );
}