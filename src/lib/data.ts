import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProducts(includeArchived = false) {
  return useQuery({
    queryKey: ["products", includeArchived],
    queryFn: async () => {
      let q = supabase.from("products").select("*").order("sort_order").order("name");
      if (!includeArchived) q = q.eq("archived", false);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("business_settings").select("*").eq("id", 1).maybeSingle();
      return data ?? { business_name: "K POINT BAR", currency: "RWF", address: "", phone: "", id: 1, report_deadline: "23:59" };
    },
  });
}

export function useProfilesMap() {
  return useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, username, full_name");
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name || p.username])) as Record<string, string>;
    },
  });
}

export const errMsg = (e: unknown) => (e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : String(e));
