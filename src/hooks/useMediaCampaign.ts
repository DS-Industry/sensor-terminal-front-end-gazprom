import { useState, useEffect } from 'react';
import { env } from '../config/env';

export const useMediaCampaign = (programUrl?: string) => {
  const [attachemntUrl, setAttachemntUrl] = useState<{
    baseUrl: string;
    programUrl: string;
  }>({
    baseUrl: env.VITE_ATTACHMENT_BASE_URL || '',
    programUrl: "",
  });
  
  const [mediaStatus, setMediaStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    if (programUrl) {
      const fullProgramUrl = `${env.VITE_S3_URL}/${programUrl}`;
      
      setMediaStatus('loading');

      const img = new Image();
      
      img.onload = () => {
        setMediaStatus('loaded');
        setAttachemntUrl({
          baseUrl: env.VITE_ATTACHMENT_BASE_URL || '',
          programUrl: fullProgramUrl,
        });
      };
      
      img.onerror = () => {
        const baseImage = new Image();
        baseImage.onload = () => {
          setMediaStatus('loaded');
          setAttachemntUrl({
            baseUrl: env.VITE_ATTACHMENT_BASE_URL || '',
            programUrl: "",
          });
        };
        
        baseImage.onerror = () => {
          setMediaStatus('error');
          setAttachemntUrl({
            baseUrl: env.VITE_ATTACHMENT_BASE_URL || '',
            programUrl: "",
          });
        };
        
        baseImage.src = env.VITE_ATTACHMENT_BASE_URL || '';
      };

      img.src = fullProgramUrl;
    } else {
      const baseImage = new Image();
      baseImage.onload = () => {
        setMediaStatus('loaded');
        setAttachemntUrl({
          baseUrl: env.VITE_ATTACHMENT_BASE_URL || '',
          programUrl: "",
        });
      };
      
      baseImage.onerror = () => {
        setMediaStatus('error');
        setAttachemntUrl({
          baseUrl: env.VITE_ATTACHMENT_BASE_URL || '',
          programUrl: "",
        });
      };
      
      baseImage.src = env.VITE_ATTACHMENT_BASE_URL || '';
    }
  }, [programUrl]);

  return { 
    attachemntUrl,
    mediaStatus
  };
};