import Image from 'next/image';
import React from 'react';

const Logo = ({ className = "h-8 w-8" }) => (
 <Image 
  src={"/logo.png"}
  width={70}
  height={70}
  alt=''
 />
);

export default Logo;