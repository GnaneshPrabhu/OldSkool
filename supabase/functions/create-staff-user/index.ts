import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return new Response(JSON.stringify({error:"Method not allowed"}), {status:405,headers:{"content-type":"application/json"}});
    const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
    if(!token) return new Response(JSON.stringify({error:"Missing authorization"}),{status:401,headers:{"content-type":"application/json"}});
    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:{user},error:authError}=await admin.auth.getUser(token);
    if(authError||!user) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{"content-type":"application/json"}});
    const body=await req.json();
    const {organization_id,email,password,full_name,phone,role,branch_id,specialty,joining_date}=body;
    if(!organization_id||!email||!password||!full_name||!branch_id) throw new Error("organization_id, email, password, full_name and branch_id are required");
    if(!["trainer","manager"].includes(role)) throw new Error("Invalid staff role");
    const {data:owner}=await admin.from("organization_members").select("role").eq("organization_id",organization_id).eq("user_id",user.id).eq("status","active").maybeSingle();
    if(owner?.role!=="owner") return new Response(JSON.stringify({error:"Only an organization owner can create staff accounts"}),{status:403,headers:{"content-type":"application/json"}});
    const {data:newUser,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name,phone:phone||null}});
    if(createError) throw createError;
    const {error:profileError}=await admin.from("profiles").upsert({id:newUser.user.id,full_name,phone:phone||null,must_change_password:true});
    if(profileError) throw profileError;
    const {error:memberError}=await admin.from("organization_members").insert({organization_id,user_id:newUser.user.id,role,branch_id,status:"active",title:role==="manager"?"Manager":"Trainer",specialty:specialty||null,joining_date:joining_date||new Date().toISOString().slice(0,10)});
    if(memberError) throw memberError;
    return new Response(JSON.stringify({ok:true,user_id:newUser.user.id}),{status:200,headers:{"content-type":"application/json"}});
  } catch(e) {
    return new Response(JSON.stringify({error:e?.message||"Unable to create staff user"}),{status:400,headers:{"content-type":"application/json"}});
  }
});