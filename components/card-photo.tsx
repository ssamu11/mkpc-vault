"use client";
import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";
export default function CardPhoto({assetId,alt}:{assetId?:string|null;alt:string}) {
  const [failed,setFailed]=useState(false);
  return <div className="card-photo">{assetId && !failed ? <Image src={`/api/card-image/${assetId}`} alt={alt} width={52} height={70} unoptimized onError={()=>setFailed(true)}/> : <ImageOff size={20} aria-label="Photo unavailable"/>}</div>;
}
