import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authentication required");

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await caller.auth.getUser();
    if (userError || !user) throw new Error("Invalid authentication");

    const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: admin, error: adminError } = await adminClient.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminError) throw adminError;
    if (!admin) throw new Error("Platform admin access required");

    const body = await req.json();
    const orgName = String(body.org_name || "").trim();
    const ownerName = String(body.owner_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!orgName || !ownerName || !email || password.length < 8) {
      throw new Error("Organization, owner name, email and an 8+ character password are required");
    }

    const slugBase = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "oldskool";
    const slug = slugBase + "-" + crypto.randomUUID().slice(0, 8);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: ownerName, org_name: orgName, platform_created: true },
    });
    if (createError) throw createError;
    const ownerUser = created.user;

    try {
      const { data: org, error: orgError } = await adminClient.from("organizations")
        .insert({ name: orgName, slug, created_by: ownerUser.id }).select().single();
      if (orgError) throw orgError;

      const { error: profileError } = await adminClient.from("profiles")
        .upsert({ id: ownerUser.id, full_name: ownerName, must_change_password: true });
      if (profileError) throw profileError;

      const { error: memberError } = await adminClient.from("organization_members")
        .insert({ organization_id: org.id, user_id: ownerUser.id, role: "owner", status: "active" });
      if (memberError) throw memberError;

      await adminClient.from("audit_logs").insert({
        organization_id: org.id,
        actor_user_id: user.id,
        action: "created_owner_workspace",
        entity_type: "organization",
        entity_id: org.id,
        metadata: { owner_user_id: ownerUser.id, owner_email: email },
      });

      return new Response(JSON.stringify({
        success: true, organization_id: org.id, owner_user_id: ownerUser.id,
      }), { status: 200, headers: cors });
    } catch (innerError) {
      await adminClient.from("organizations").delete().eq("created_by", ownerUser.id);
      await adminClient.auth.admin.deleteUser(ownerUser.id);
      throw innerError;
    }
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unable to create owner",
    }), { status: 400, headers: cors });
  }
});