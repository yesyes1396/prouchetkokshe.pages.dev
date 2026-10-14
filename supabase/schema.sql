create extension if not exists pgcrypto;

create table if not exists public.admin_users (
    user_id uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    );
$$;

create table if not exists public.content_cards (
    id uuid primary key default gen_random_uuid(),
    section text not null check (section in ('benefits', 'faq')),
    icon text not null default 'fa-solid fa-circle-check',
    title text not null,
    body text not null,
    sort_order integer not null default 0,
    is_published boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (section, title)
);

create table if not exists public.courses (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    category text not null default 'Бухгалтерия',
    title text not null,
    icon text not null default 'fa-solid fa-book-open',
    short_description text not null default '',
    description text not null default '',
    curriculum jsonb not null default '[]'::jsonb check (jsonb_typeof(curriculum) = 'array'),
    duration text not null default '',
    price numeric(12, 2) not null default 0 check (price >= 0),
    currency text not null default 'KZT',
    payment_instructions text not null default '',
    kaspi_qr_url text not null default '',
    payment_methods jsonb not null default '[]'::jsonb check (jsonb_typeof(payment_methods) = 'array'),
    sort_order integer not null default 0,
    is_published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.applications (
    id uuid primary key default gen_random_uuid(),
    full_name text not null check (char_length(trim(full_name)) between 2 and 160),
    phone text not null check (char_length(trim(phone)) between 7 and 32),
    course_id uuid references public.courses (id) on delete set null,
    course_title text not null default '',
    status text not null default 'unread' check (status in ('unread', 'viewed', 'archived')),
    payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'rejected')),
    admin_notes text not null default '',
    viewed_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists content_cards_section_order_idx
    on public.content_cards (section, sort_order);
create index if not exists courses_published_order_idx
    on public.courses (is_published, sort_order);
create index if not exists applications_created_at_idx
    on public.applications (created_at desc);
create index if not exists applications_phone_idx
    on public.applications (phone);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists content_cards_set_updated_at on public.content_cards;
create trigger content_cards_set_updated_at
before update on public.content_cards
for each row execute function public.set_updated_at();

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.content_cards enable row level security;
alter table public.courses enable row level security;
alter table public.applications enable row level security;

drop policy if exists "admins can manage admin users" on public.admin_users;
create policy "admins can manage admin users"
on public.admin_users for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public can read published cards" on public.content_cards;
create policy "public can read published cards"
on public.content_cards for select to anon, authenticated
using (is_published or public.is_admin());

drop policy if exists "admins can manage cards" on public.content_cards;
create policy "admins can manage cards"
on public.content_cards for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public can read published courses" on public.courses;
create policy "public can read published courses"
on public.courses for select to anon, authenticated
using (is_published or public.is_admin());

drop policy if exists "admins can manage courses" on public.courses;
create policy "admins can manage courses"
on public.courses for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public can create applications" on public.applications;
create policy "public can create applications"
on public.applications for insert to anon, authenticated
with check (status = 'unread' and payment_status = 'pending' and admin_notes = '');

drop policy if exists "admins can read applications" on public.applications;
create policy "admins can read applications"
on public.applications for select to authenticated
using (public.is_admin());

drop policy if exists "admins can update applications" on public.applications;
create policy "admins can update applications"
on public.applications for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins can delete applications" on public.applications;
create policy "admins can delete applications"
on public.applications for delete to authenticated
using (public.is_admin());

grant execute on function public.is_admin() to anon, authenticated;
grant select on public.content_cards, public.courses to anon, authenticated;
grant insert on public.applications to anon, authenticated;
grant select, update, delete on public.applications to authenticated;
grant select, insert, update, delete on public.content_cards, public.courses to authenticated;
grant select, insert, update, delete on public.admin_users to authenticated;

insert into storage.buckets (id, name, public)
values ('course-payment-qr', 'course-payment-qr', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public can view course payment QR" on storage.objects;
create policy "public can view course payment QR"
on storage.objects for select to anon, authenticated
using (bucket_id = 'course-payment-qr');

drop policy if exists "admins can upload course payment QR" on storage.objects;
create policy "admins can upload course payment QR"
on storage.objects for insert to authenticated
with check (bucket_id = 'course-payment-qr' and public.is_admin());

drop policy if exists "admins can update course payment QR" on storage.objects;
create policy "admins can update course payment QR"
on storage.objects for update to authenticated
using (bucket_id = 'course-payment-qr' and public.is_admin())
with check (bucket_id = 'course-payment-qr' and public.is_admin());

drop policy if exists "admins can delete course payment QR" on storage.objects;
create policy "admins can delete course payment QR"
on storage.objects for delete to authenticated
using (bucket_id = 'course-payment-qr' and public.is_admin());

insert into public.content_cards (section, icon, title, body, sort_order)
values
    ('benefits', 'fa-solid fa-laptop-code', 'Облачная 1С', 'Практика в самой свежей версии 8.3 без установки программ на компьютер.', 1),
    ('benefits', 'fa-solid fa-rocket', 'Быстрый старт', 'Выходим на первый доход в профессии уже через 2 месяца обучения.', 2),
    ('benefits', 'fa-solid fa-shield-halved', 'Поддержка', 'Личный куратор-эксперт отвечает на вопросы в течение 15 минут.', 3),
    ('faq', 'fa-solid fa-circle-question', 'Какие курсы вы предлагаете?', 'Мы предлагаем базовый, стандартный и PRO-level курсы по бухгалтерии и налогам.', 1),
    ('faq', 'fa-solid fa-circle-question', 'Нужен ли опыт для начала обучения?', 'Нет, опыт не требуется. Курсы подходят начинающим и тем, кто хочет обновить знания.', 2),
    ('faq', 'fa-solid fa-circle-question', 'Как долго длится обучение?', 'Длительность курсов варьируется от 1 до 2 месяцев в зависимости от программы.', 3),
    ('faq', 'fa-solid fa-circle-question', 'Вы помогаете с трудоустройством?', 'Да, выпускникам предоставляется помощь в поиске работы и подготовке резюме.', 4),
    ('faq', 'fa-solid fa-circle-question', 'Можно ли учиться онлайн?', 'Да, можно учиться онлайн в удобном темпе с поддержкой преподавателя.', 5)
on conflict (section, title) do nothing;

insert into public.courses (slug, category, title, icon, short_description, description, curriculum, duration, price, currency, sort_order, is_published)
values
    ('basic', 'Бухгалтерия', 'Basic', 'fa-solid fa-book-open', 'Основы бухгалтерии и налогов ИП', 'Базовая программа для уверенного старта в бухгалтерии.', '["Понимание основ бухгалтерского учета", "Знание налогов ИП", "Отчетность 910/911", "Требования Налогового кодекса РК", "Сертификат Basic"]'::jsonb, 'Уточняется', 99000, 'KZT', 1, true),
    ('standard', 'Бухгалтерия', 'Standart', 'fa-solid fa-calculator', 'Бухгалтер ИП и ТОО', 'Практическая программа по ведению ИП и ТОО.', '["Ведение ИП и ТОО", "КПН, ИПН и НДС", "Отчетность 100/200/300", "Расчет заработной платы и налогов", "Практика на реальных кейсах", "Сертификат Standard"]'::jsonb, 'Уточняется', 199000, 'KZT', 2, true),
    ('pro', 'Бухгалтерия', 'PRO', 'fa-solid fa-chart-line', 'Профессиональный бухгалтер и налоговые проверки', 'Продвинутая программа для будущих главных бухгалтеров.', '["Уровень главного бухгалтера", "Налоговое планирование", "Продвинутый НДС", "Подготовка и сопровождение проверок", "Работа в 1С", "Ведение клиентов на аутсорсе", "Итоговый проект", "Сертификат PRO"]'::jsonb, 'Уточняется', 269000, 'KZT', 3, true)
on conflict (slug) do nothing;