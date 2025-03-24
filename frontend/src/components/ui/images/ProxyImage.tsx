// components/NextImage.jsx
"use client";
import Image, { ImageProps } from 'next/image';

interface ProxyImageProps extends Omit<ImageProps, 'src'> {
  src: string;
  alt: string;
}

export default function ProxyImage({ src, alt, ...props }: ProxyImageProps) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const fullSrc = src.startsWith('/') ? `${basePath}${src}` : src;
  
  return <Image src={fullSrc} alt={alt} {...props} />;
}
// import NextImage from '../path/to/NextImage';

// <NextImage
//   width={80}
//   height={80}
//   src="/images/user/avatar.png"
//   alt="user"
// />
