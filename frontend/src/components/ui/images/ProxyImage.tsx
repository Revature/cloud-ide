// components/ProxyImage.tsx
"use client";

import Image, { ImageProps } from 'next/image';

interface ProxyImageProps extends Omit<ImageProps, 'src'> {
  src: string;
  alt: string;
}

export default function ProxyImage({ src, alt, ...props }: ProxyImageProps) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/ui';
  
  // Handle paths differently based on their format
  let fullSrc = src;
  
  if (src.startsWith('/')) {
    // For absolute paths, add the base path but avoid double slashes
    fullSrc = `${basePath}${src}`;
  } else if (!src.startsWith('http') && !src.startsWith('data:') && !src.startsWith(basePath)) {
    // For relative paths that don't already have the base path and aren't external URLs or data URIs
    fullSrc = `${basePath}/${src}`;
  }
  
  // Normalize any double slashes (except after protocol)
  fullSrc = fullSrc.replace(/([^:])\/\//g, '$1/');
  
  return <Image src={fullSrc} alt={alt} {...props} />;
}