import { NextResponse } from "next/server";
import { configured, supabase } from "@/lib/supabase";

export async function GET(_request: Request, { params }: {params:Promise<{assetId:string}>}) {
  const {assetId}=await params;
  if(!/^\d{1,16}$/.test(assetId)) return new NextResponse(null,{status:400});
  if(!configured()) return new NextResponse(null,{status:503});
  const db=await supabase();
  const {data:{user}}=await db.auth.getUser();
  if(!user) return new NextResponse(null,{status:401});
  const {data:profile}=await db.from("profiles").select("role").eq("id",user.id).single();
  if(!profile) return new NextResponse(null,{status:403});
  try {
    const result=await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false`,{next:{revalidate:3600},signal:AbortSignal.timeout(8000)});
    if(!result.ok) throw Error("Thumbnail lookup failed");
    const json=await result.json();
    const item=json.data?.find((x:{targetId:number;state:string;imageUrl?:string})=>String(x.targetId)===assetId && x.state==="Completed");
    if(!item?.imageUrl) return new NextResponse(null,{status:404});
    const url=new URL(item.imageUrl);
    if(url.protocol!=="https:" || !url.hostname.endsWith(".rbxcdn.com")) throw Error("Invalid image host");
    const photo=await fetch(url,{next:{revalidate:86400},signal:AbortSignal.timeout(8000),redirect:"error"});
    if(!photo.ok || !photo.headers.get("content-type")?.startsWith("image/")) throw Error("Image unavailable");
    return new NextResponse(await photo.arrayBuffer(),{headers:{"Content-Type":photo.headers.get("content-type")!,"Cache-Control":"private, max-age=3600","X-Content-Type-Options":"nosniff"}});
  } catch { return new NextResponse(null,{status:502}); }
}
