import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMAIL_DOMAIN = "kpointbar.local";
const toEmail = (u: string) => `${u}@${EMAIL_DOMAIN}`;
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const strong = (p: string) => p.length >= 10 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);

/**
 * Idempotent bootstrap: creates the initial Super Admin only when no Super Admin exists.
 * Never resets an existing password. Safe to call repeatedly.
 */
export const ensureBootstrapAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin");
  if (error) throw new Error("Bootstrap check failed");
  if ((count ?? 0) > 0) return { created: false };

  const username = process.env["BOOTSTRAP_ADMIN_USERNAME"] || "superadmin";
  const password = process.env["BOOTSTRAP_ADMIN_PASSWORD"] || "KPoint@Admin2026!";
  let userId: string | undefined;
  const created = await supabaseAdmin.auth.admin.createUser({
    email: toEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (created.error) {
    // user may already exist without role (partial earlier run)
    const list = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    userId = list.data.users.find((u) => u.email === toEmail(username))?.id;
    if (!userId) throw new Error("Bootstrap failed");
  } else {
    userId = created.data.user.id;
  }
  await supabaseAdmin.from("profiles").upsert(
    { id: userId, username, full_name: "Super Admin", must_change_password: true, active: true },
    { onConflict: "id", ignoreDuplicates: true },
  );
  await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "super_admin" }, { onConflict: "user_id,role" });
  await supabaseAdmin.from("audit_logs").insert({ user_id: userId, action: "bootstrap_admin", entity: "profile", entity_id: userId });
  return { created: true };
});

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!data) throw new Error("Forbidden");
  const { data: prof } = await supabase.from("profiles").select("active").eq("id", userId).single();
  if (!prof?.active) throw new Error("Forbidden");
}

type NewEmployee = {
  username: string;
  full_name: string;
  password: string;
  can_receive_stock: boolean;
  can_record_expenses: boolean;
  can_export: boolean;
};

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: NewEmployee) => {
    const username = String(d.username ?? "").trim().toLowerCase();
    if (!USERNAME_RE.test(username)) throw new Error("Username must be 3-32 chars: letters, numbers, . _ -");
    if (!strong(String(d.password ?? ""))) throw new Error("Weak password");
    const full_name = String(d.full_name ?? "").trim().slice(0, 120);
    if (!full_name) throw new Error("Full name required");
    return { ...d, username, full_name, can_receive_stock: !!d.can_receive_stock, can_record_expenses: !!d.can_record_expenses, can_export: !!d.can_export };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("username", data.username).maybeSingle();
    if (existing) throw new Error("Username already exists");
    const created = await supabaseAdmin.auth.admin.createUser({
      email: toEmail(data.username),
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username },
    });
    if (created.error) throw new Error(created.error.message);
    const id = created.data.user.id;
    const { error } = await supabaseAdmin.from("profiles").insert({
      id,
      username: data.username,
      full_name: data.full_name,
      must_change_password: true,
      can_receive_stock: data.can_receive_stock,
      can_record_expenses: data.can_record_expenses,
      can_export: data.can_export,
    });
    if (error) {
      await supabaseAdmin.auth.admin.deleteUser(id);
      throw new Error(error.message);
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: id, role: "sales_manager" });
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: "employee_created", entity: "profile", entity_id: id, details: { username: data.username },
    });
    return { id };
  });

export const resetEmployeePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; password: string }) => {
    if (!strong(String(d.password ?? ""))) throw new Error("Weak password");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", data.userId);
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: "employee_password_reset", entity: "profile", entity_id: data.userId,
    });
    return { ok: true };
  });

export const setEmployeeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot deactivate yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ active: data.active }).eq("id", data.userId);
    // Banning terminates future sign-ins and token refreshes
    await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: data.active ? "none" : "876000h" });
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: data.active ? "employee_activated" : "employee_deactivated", entity: "profile", entity_id: data.userId,
    });
    return { ok: true };
  });
