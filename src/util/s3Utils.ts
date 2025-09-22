export const getS3LogoUrl = (logoName: string): string => {
  return `${import.meta.env.S3_BASE_URL}/${logoName}.svg`;
};
