
-- ============ ROLES & PROFILES ============
create type public.app_role as enum ('super_admin', 'sales_manager');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null default '',
  language text check (language in ('rw','en','fr')),
  must_change_password boolean not null default true,
  active boolean not null default true,
  can_receive_stock boolean not null default false,
  can_record_expenses boolean not null default true,
  can_export boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'super_admin')
    and exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create or replace function public.my_perm(_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or coalesce((
    select case _perm
      when 'receive_stock' then can_receive_stock
      when 'expenses' then can_record_expenses
      when 'export' then can_export
      else false end
    from public.profiles where id = auth.uid() and active), false)
$$;

create policy "own or admin read profiles" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "own or admin update profiles" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy "own or admin read roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Non-admins may only change their own language / full name
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('app.bypass', true) = 'on' or auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.username <> old.username or new.active <> old.active
     or new.must_change_password <> old.must_change_password
     or new.can_receive_stock <> old.can_receive_stock
     or new.can_record_expenses <> old.can_record_expenses
     or new.can_export <> old.can_export then
    raise exception 'Not allowed to change protected profile fields';
  end if;
  return new;
end $$;
create trigger trg_guard_profile before update on public.profiles
  for each row execute function public.guard_profile_update();

create or replace function public.mark_password_changed()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.bypass', 'on', true);
  update public.profiles set must_change_password = false where id = auth.uid();
end $$;

-- ============ AUDIT ============
create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "admin read audit" on public.audit_logs for select to authenticated using (public.is_admin());

create or replace function public.log_audit(_action text, _entity text, _entity_id text, _details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs(user_id, action, entity, entity_id, details)
  values (auth.uid(), _action, _entity, _entity_id, coalesce(_details, '{}'::jsonb));
$$;

-- ============ SETTINGS ============
create table public.business_settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'K POINT BAR',
  currency text not null default 'RWF',
  address text not null default '',
  phone text not null default '',
  report_deadline time not null default '23:59'
);
grant select, update on public.business_settings to authenticated;
grant all on public.business_settings to service_role;
alter table public.business_settings enable row level security;
create policy "read settings" on public.business_settings for select to authenticated using (public.is_active_user());
create policy "admin update settings" on public.business_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
insert into public.business_settings(id) values (1);

-- ============ PRODUCTS ============
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sku text unique,
  category text not null check (category in ('drinks','kitchen')),
  unit text not null default 'pcs',
  min_stock numeric(14,3) not null default 0 check (min_stock >= 0),
  cost_price numeric(14,2) check (cost_price >= 0),
  selling_price numeric(14,2) check (selling_price >= 0),
  current_stock numeric(14,3) not null default 0,
  avg_cost numeric(14,4) not null default 0,
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "active read products" on public.products for select to authenticated using (public.is_active_user());
create policy "admin insert products" on public.products for insert to authenticated with check (public.is_admin());
create policy "admin update products" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- current_stock / avg_cost may only change through stock functions
create or replace function public.guard_product_stock()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_setting('app.stock', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.current_stock := 0; new.avg_cost := coalesce(new.cost_price, 0);
  elsif new.current_stock <> old.current_stock or new.avg_cost <> old.avg_cost then
    raise exception 'Stock can only be changed through stock movements';
  end if;
  return new;
end $$;
create trigger trg_guard_product_stock before insert or update on public.products
  for each row execute function public.guard_product_stock();

insert into public.products(name, category, sku, sort_order)
select n, 'drinks', 'DRK-' || lpad(o::text, 3, '0'), o from unnest(array[
 'MITZIG','P MITZIG','AMSTEL','HEINEKEN','PRIMUS','KNOWLESS','TURBO','G FANTA','S FANTA','LEGEND','G SKOL','P SKOL','GATANU','G PANACHE','P PANACHE','LAGER','V MIST','TUSKIER MALT','GUINESS','SMIRNOFF ICE','TUSKER LAGER','PLASTIC FANTA','JUICE','ENERGY','GUARANA','BAVARIA','SAVANNA','SKOL CANETTE','G AMAZI','S AMAZI','DUNHILL','INTORE'
]) with ordinality as t(n, o);
insert into public.products(name, category, sku, sort_order)
select n, 'kitchen', 'KIT-' || lpad(o::text, 3, '0'), 100 + o from unnest(array[
 'BROCHETTE','ZINGARO','IBITI','FISH FILET','INKOKO','IFI','NYAMACOMA','URUKWAVU','IKIDALI','ITAKO','IGITOKI','IKIRAYI','CHIPS','BOILLON','AGATOGO','UMURETI'
]) with ordinality as t(n, o);

-- ============ SUPPLIERS ============
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.suppliers to authenticated;
grant all on public.suppliers to service_role;
alter table public.suppliers enable row level security;
create policy "read suppliers" on public.suppliers for select to authenticated using (public.is_active_user());
create policy "admin write suppliers" on public.suppliers for insert to authenticated with check (public.is_admin());
create policy "admin update suppliers" on public.suppliers for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============ STOCK MOVEMENTS ============
create table public.stock_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products(id),
  movement_type text not null check (movement_type in ('opening','purchase','sale','adjustment','wastage','count')),
  quantity numeric(14,3) not null check (quantity <> 0),
  unit_cost numeric(14,4) not null default 0,
  business_date date not null default (now() at time zone 'Africa/Kigali')::date,
  ref_table text,
  ref_id uuid,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index stock_movements_ref_uniq on public.stock_movements(ref_table, ref_id, product_id, movement_type) where ref_id is not null;
create index on public.stock_movements(product_id, business_date);
grant select on public.stock_movements to authenticated;
grant all on public.stock_movements to service_role;
alter table public.stock_movements enable row level security;
create policy "active read movements" on public.stock_movements for select to authenticated using (public.is_active_user());

create or replace function public._apply_movement(_product uuid, _type text, _qty numeric, _cost numeric, _date date,
  _ref_table text, _ref_id uuid, _reason text, _allow_negative boolean)
returns void language plpgsql security definer set search_path = public as $$
declare p public.products%rowtype; new_stock numeric; new_avg numeric;
begin
  select * into p from public.products where id = _product for update;
  if not found then raise exception 'Product not found'; end if;
  new_stock := p.current_stock + _qty;
  if new_stock < 0 and not _allow_negative then
    raise exception 'Insufficient stock for % (available %, requested %)', p.name, p.current_stock, -_qty;
  end if;
  new_avg := p.avg_cost;
  if _qty > 0 and _type in ('purchase','opening') then
    if new_stock > 0 then
      new_avg := (greatest(p.current_stock,0) * p.avg_cost + _qty * coalesce(_cost,0)) / (greatest(p.current_stock,0) + _qty);
    end if;
  end if;
  insert into public.stock_movements(product_id, movement_type, quantity, unit_cost, business_date, ref_table, ref_id, reason, created_by)
  values (_product, _type, _qty, coalesce(case when _qty > 0 and _type in ('purchase','opening') then _cost else p.avg_cost end, 0),
          coalesce(_date, (now() at time zone 'Africa/Kigali')::date), _ref_table, _ref_id, _reason, auth.uid());
  perform set_config('app.stock', 'on', true);
  update public.products set current_stock = new_stock, avg_cost = new_avg where id = _product;
  perform set_config('app.stock', 'off', true);
end $$;
revoke all on function public._apply_movement from public, anon, authenticated;

create or replace function public.adjust_stock(_product uuid, _type text, _qty numeric, _cost numeric, _reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the Super Admin can adjust stock'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'A reason is required'; end if;
  if _type not in ('opening','adjustment','wastage') then raise exception 'Invalid adjustment type'; end if;
  if _type = 'wastage' and _qty > 0 then _qty := -_qty; end if;
  perform public._apply_movement(_product, _type, _qty, _cost, null, null, null, _reason, false);
  perform public.log_audit('stock_' || _type, 'product', _product::text, jsonb_build_object('qty', _qty, 'cost', _cost, 'reason', _reason));
end $$;

-- ============ SALES ============
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_date date not null default (now() at time zone 'Africa/Kigali')::date,
  employee_id uuid not null,
  payment_method text not null default 'cash' check (payment_method in ('cash','momo','card','bank','credit')),
  reference text not null default '',
  notes text not null default '',
  total numeric(14,2) not null default 0,
  cost_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  unit_cost numeric(14,4) not null default 0,
  line_total numeric(14,2) not null
);
create index on public.sales(business_date);
create index on public.sale_items(sale_id);
grant select on public.sales, public.sale_items to authenticated;
grant all on public.sales, public.sale_items to service_role;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
create policy "read sales" on public.sales for select to authenticated using (public.is_admin() or (employee_id = auth.uid() and public.is_active_user()));
create policy "read sale items" on public.sale_items for select to authenticated using (
  exists (select 1 from public.sales s where s.id = sale_id and (public.is_admin() or (s.employee_id = auth.uid() and public.is_active_user()))));

create or replace function public.record_sale(_items jsonb, _payment_method text, _reference text, _notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid := gen_random_uuid(); it jsonb; p public.products%rowtype; q numeric; tot numeric := 0; ctot numeric := 0;
  bdate date := (now() at time zone 'Africa/Kigali')::date;
begin
  if not public.is_active_user() then raise exception 'Not authorized'; end if;
  if jsonb_array_length(coalesce(_items,'[]'::jsonb)) = 0 then raise exception 'No items'; end if;
  if exists (select 1 from public.daily_reports where business_date = bdate and status = 'approved') then
    raise exception 'Today''s report is already approved';
  end if;
  insert into public.sales(id, business_date, employee_id, payment_method, reference, notes)
  values (sid, bdate, auth.uid(), coalesce(_payment_method,'cash'), coalesce(_reference,''), coalesce(_notes,''));
  for it in select * from jsonb_array_elements(_items) loop
    q := (it->>'quantity')::numeric;
    if q is null or q <= 0 then raise exception 'Invalid quantity'; end if;
    select * into p from public.products where id = (it->>'product_id')::uuid and not archived;
    if not found then raise exception 'Product not found'; end if;
    if p.selling_price is null then raise exception 'No selling price set for %', p.name; end if;
    insert into public.sale_items(sale_id, product_id, quantity, unit_price, unit_cost, line_total)
    values (sid, p.id, q, p.selling_price, p.avg_cost, round(q * p.selling_price, 2));
    perform public._apply_movement(p.id, 'sale', -q, null, bdate, 'sales', sid, null, false);
    tot := tot + round(q * p.selling_price, 2);
    ctot := ctot + round(q * p.avg_cost, 2);
  end loop;
  update public.sales set total = tot, cost_total = ctot where id = sid;
  perform public.log_audit('sale_recorded', 'sale', sid::text, jsonb_build_object('total', tot));
  return sid;
end $$;

-- ============ PURCHASES ============
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id),
  invoice_no text not null default '',
  business_date date not null default (now() at time zone 'Africa/Kigali')::date,
  payment_status text not null default 'unpaid' check (payment_status in ('paid','unpaid','partial')),
  payment_method text not null default 'cash',
  status text not null default 'draft' check (status in ('draft','received','cancelled')),
  total numeric(14,2) not null default 0,
  created_by uuid not null default auth.uid(),
  received_by uuid,
  received_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  line_total numeric(14,2) generated always as (round(quantity * unit_cost, 2)) stored
);
grant select, insert, update, delete on public.purchases, public.purchase_items to authenticated;
grant all on public.purchases, public.purchase_items to service_role;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
create policy "read purchases" on public.purchases for select to authenticated using (public.is_admin() or public.my_perm('receive_stock'));
create policy "insert purchases" on public.purchases for insert to authenticated with check (public.my_perm('receive_stock') and status = 'draft');
create policy "update draft purchases" on public.purchases for update to authenticated using (public.my_perm('receive_stock') and status = 'draft') with check (status in ('draft','cancelled'));
create policy "read purchase items" on public.purchase_items for select to authenticated using (public.is_admin() or public.my_perm('receive_stock'));
create policy "write draft purchase items" on public.purchase_items for insert to authenticated with check (
  public.my_perm('receive_stock') and exists (select 1 from public.purchases p where p.id = purchase_id and p.status = 'draft'));
create policy "delete draft purchase items" on public.purchase_items for delete to authenticated using (
  public.my_perm('receive_stock') and exists (select 1 from public.purchases p where p.id = purchase_id and p.status = 'draft'));

create or replace function public.receive_purchase(_purchase uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pr public.purchases%rowtype; it record; tot numeric := 0;
begin
  if not public.my_perm('receive_stock') then raise exception 'Not authorized'; end if;
  select * into pr from public.purchases where id = _purchase for update;
  if not found then raise exception 'Purchase not found'; end if;
  if pr.status <> 'draft' then raise exception 'Purchase already %', pr.status; end if;
  for it in select * from public.purchase_items where purchase_id = _purchase loop
    perform public._apply_movement(it.product_id, 'purchase', it.quantity, it.unit_cost, pr.business_date, 'purchases', _purchase, null, false);
    perform set_config('app.stock', 'on', true);
    update public.products set cost_price = it.unit_cost where id = it.product_id;
    perform set_config('app.stock', 'off', true);
    tot := tot + it.line_total;
  end loop;
  if tot = 0 then raise exception 'Purchase has no items'; end if;
  update public.purchases set status = 'received', total = tot, received_by = auth.uid(), received_at = now() where id = _purchase;
  perform public.log_audit('purchase_received', 'purchase', _purchase::text, jsonb_build_object('total', tot));
end $$;

-- ============ EXPENSES & INCOME ============
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_date date not null default (now() at time zone 'Africa/Kigali')::date,
  category text not null,
  description text not null default '',
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null default 'cash',
  employee_id uuid not null default auth.uid(),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
create policy "read expenses" on public.expenses for select to authenticated using (public.is_admin() or (employee_id = auth.uid() and public.is_active_user()));
create policy "insert expenses" on public.expenses for insert to authenticated with check (public.my_perm('expenses') and employee_id = auth.uid() and (status = 'pending' or public.is_admin()));
create policy "admin update expenses" on public.expenses for update to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.other_income (
  id uuid primary key default gen_random_uuid(),
  business_date date not null default (now() at time zone 'Africa/Kigali')::date,
  source text not null check (source in ('room','other')),
  description text not null default '',
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null default 'cash',
  employee_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
grant select, insert on public.other_income to authenticated;
grant all on public.other_income to service_role;
alter table public.other_income enable row level security;
create policy "read income" on public.other_income for select to authenticated using (public.is_admin() or (employee_id = auth.uid() and public.is_active_user()));
create policy "insert income" on public.other_income for insert to authenticated with check (public.is_active_user() and employee_id = auth.uid());

-- ============ DAILY REPORTS ============
create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  business_date date not null unique,
  submitted_by uuid,
  status text not null default 'submitted' check (status in ('submitted','approved','returned')),
  drinks_sales numeric(14,2) not null default 0,
  kitchen_sales numeric(14,2) not null default 0,
  total_sales numeric(14,2) not null default 0,
  cogs numeric(14,2) not null default 0,
  total_purchases numeric(14,2) not null default 0,
  total_expenses numeric(14,2) not null default 0,
  other_income numeric(14,2) not null default 0,
  cash_expected numeric(14,2) not null default 0,
  cash_counted numeric(14,2) not null default 0,
  notes text not null default '',
  admin_comment text not null default '',
  submitted_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz
);
create table public.report_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  product_id uuid not null references public.products(id),
  opening numeric(14,3) not null,
  purchased numeric(14,3) not null,
  adjustments numeric(14,3) not null,
  sold numeric(14,3) not null,
  expected numeric(14,3) not null,
  physical numeric(14,3),
  unit_price numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  unique (report_id, product_id)
);
grant select on public.daily_reports, public.report_items to authenticated;
grant all on public.daily_reports, public.report_items to service_role;
alter table public.daily_reports enable row level security;
alter table public.report_items enable row level security;
create policy "read reports" on public.daily_reports for select to authenticated using (public.is_active_user());
create policy "read report items" on public.report_items for select to authenticated using (public.is_active_user());

-- Per-product closing sheet computed from the ledger for a given date
create or replace function public.closing_sheet(_date date)
returns table(product_id uuid, name text, category text, opening numeric, purchased numeric, adjustments numeric,
  sold numeric, expected numeric, unit_price numeric, total numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.category,
    coalesce(sum(m.quantity) filter (where m.business_date < _date), 0),
    coalesce(sum(m.quantity) filter (where m.business_date = _date and m.movement_type = 'purchase'), 0),
    coalesce(sum(m.quantity) filter (where m.business_date = _date and m.movement_type in ('opening','adjustment','wastage','count')), 0),
    coalesce(-sum(m.quantity) filter (where m.business_date = _date and m.movement_type = 'sale'), 0),
    coalesce(sum(m.quantity) filter (where m.business_date <= _date), 0),
    coalesce((select sum(si.line_total)/nullif(sum(si.quantity),0) from sale_items si join sales s on s.id = si.sale_id
              where si.product_id = p.id and s.business_date = _date), p.selling_price, 0),
    coalesce((select sum(si.line_total) from sale_items si join sales s on s.id = si.sale_id
              where si.product_id = p.id and s.business_date = _date), 0)
  from products p
  left join stock_movements m on m.product_id = p.id
  where public.is_active_user() and (not p.archived or exists (select 1 from stock_movements x where x.product_id = p.id and x.business_date = _date))
  group by p.id
  order by p.sort_order, p.name
$$;

create or replace function public.submit_daily_report(_date date, _counts jsonb, _cash numeric, _notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid; r record; ds numeric; ks numeric; cg numeric; pu numeric; ex numeric; oi numeric; cash_sales numeric; cash_exp numeric; cash_oi numeric; existing public.daily_reports%rowtype;
begin
  if not public.is_active_user() then raise exception 'Not authorized'; end if;
  select * into existing from public.daily_reports where business_date = _date for update;
  if found and existing.status = 'approved' then raise exception 'Report already approved'; end if;
  if found and existing.status = 'submitted' and not public.is_admin() and existing.submitted_by <> auth.uid() then
    raise exception 'Report already submitted by another user';
  end if;
  select coalesce(sum(si.line_total) filter (where p.category='drinks'),0), coalesce(sum(si.line_total) filter (where p.category='kitchen'),0),
         coalesce(sum(round(si.quantity*si.unit_cost,2)),0)
    into ds, ks, cg from sale_items si join sales s on s.id=si.sale_id join products p on p.id=si.product_id where s.business_date=_date;
  select coalesce(sum(total),0) into pu from purchases where business_date=_date and status='received';
  select coalesce(sum(amount),0) into ex from expenses where business_date=_date and status <> 'rejected';
  select coalesce(sum(amount),0) into oi from other_income where business_date=_date;
  select coalesce(sum(total),0) into cash_sales from sales where business_date=_date and payment_method='cash';
  select coalesce(sum(amount),0) into cash_exp from expenses where business_date=_date and status <> 'rejected' and payment_method='cash';
  select coalesce(sum(amount),0) into cash_oi from other_income where business_date=_date and payment_method='cash';

  if found then
    rid := existing.id;
    update public.daily_reports set submitted_by=auth.uid(), status='submitted', drinks_sales=ds, kitchen_sales=ks, total_sales=ds+ks, cogs=cg,
      total_purchases=pu, total_expenses=ex, other_income=oi, cash_expected=cash_sales+cash_oi-cash_exp, cash_counted=coalesce(_cash,0),
      notes=coalesce(_notes,''), submitted_at=now() where id=rid;
    delete from public.report_items where report_id = rid;
  else
    insert into public.daily_reports(business_date, submitted_by, drinks_sales, kitchen_sales, total_sales, cogs, total_purchases, total_expenses,
      other_income, cash_expected, cash_counted, notes)
    values (_date, auth.uid(), ds, ks, ds+ks, cg, pu, ex, oi, cash_sales+cash_oi-cash_exp, coalesce(_cash,0), coalesce(_notes,''))
    returning id into rid;
  end if;
  for r in select * from public.closing_sheet(_date) loop
    insert into public.report_items(report_id, product_id, opening, purchased, adjustments, sold, expected, physical, unit_price, total)
    values (rid, r.product_id, r.opening, r.purchased, r.adjustments, r.sold, r.expected,
      (select (c->>'physical')::numeric from jsonb_array_elements(coalesce(_counts,'[]'::jsonb)) c where (c->>'product_id')::uuid = r.product_id and c->>'physical' is not null and c->>'physical' <> '' limit 1),
      r.unit_price, r.total);
  end loop;
  perform public.log_audit('report_submitted', 'daily_report', rid::text, jsonb_build_object('date', _date));
  return rid;
end $$;

create or replace function public.review_daily_report(_report uuid, _approve boolean, _comment text)
returns void language plpgsql security definer set search_path = public as $$
declare rep public.daily_reports%rowtype; it record;
begin
  if not public.is_admin() then raise exception 'Only the Super Admin can review reports'; end if;
  select * into rep from public.daily_reports where id = _report for update;
  if not found then raise exception 'Report not found'; end if;
  if rep.status <> 'submitted' then raise exception 'Report is %', rep.status; end if;
  if _approve then
    -- Physical counts become auditable count adjustments
    for it in select * from public.report_items where report_id = _report and physical is not null and physical <> expected loop
      perform public._apply_movement(it.product_id, 'count', it.physical - it.expected, null, rep.business_date, 'daily_reports', _report,
        'Physical count variance', true);
    end loop;
  end if;
  update public.daily_reports set status = case when _approve then 'approved' else 'returned' end,
    admin_comment = coalesce(_comment,''), reviewed_by = auth.uid(), reviewed_at = now() where id = _report;
  perform public.log_audit(case when _approve then 'report_approved' else 'report_returned' end, 'daily_report', _report::text,
    jsonb_build_object('comment', _comment));
end $$;

create or replace function public.reopen_daily_report(_report uuid, _comment text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if coalesce(trim(_comment),'') = '' then raise exception 'A reason is required'; end if;
  update public.daily_reports set status = 'returned', admin_comment = _comment, reviewed_by = auth.uid(), reviewed_at = now()
  where id = _report and status = 'approved';
  if not found then raise exception 'Only approved reports can be reopened'; end if;
  perform public.log_audit('report_reopened', 'daily_report', _report::text, jsonb_build_object('reason', _comment));
end $$;

-- audit for product/price edits
create or replace function public.audit_product_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('app.stock', true) = 'on' then return new; end if;
  perform public.log_audit(lower(tg_op) || '_product', 'product', new.id::text,
    jsonb_build_object('name', new.name, 'cost_price', new.cost_price, 'selling_price', new.selling_price, 'archived', new.archived));
  return new;
end $$;
create trigger trg_audit_product after insert or update on public.products for each row execute function public.audit_product_change();

revoke execute on function public.adjust_stock, public.record_sale, public.receive_purchase, public.submit_daily_report,
  public.review_daily_report, public.reopen_daily_report, public.mark_password_changed, public.closing_sheet from anon, public;
grant execute on function public.adjust_stock, public.record_sale, public.receive_purchase, public.submit_daily_report,
  public.review_daily_report, public.reopen_daily_report, public.mark_password_changed, public.closing_sheet to authenticated;
