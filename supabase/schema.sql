-- CloudLearn database schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run
-- After this, also run update_course_details.sql to add course details.

-- ---------- Courses (public catalog) ----------
create table if not exists public.courses (
  id          serial primary key,
  title       text not null,
  category    text not null,
  level       text not null default 'Beginner',
  icon        text not null default '📘',
  duration    text,
  description text,
  video_url   text,
  lessons     text[] not null default '{}'
);

-- ---------- Enrollments (one row per student per course) ----------
create table if not exists public.enrollments (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id         int  not null references public.courses (id) on delete cascade,
  completed_lessons int[] not null default '{}',
  enrolled_at       timestamptz not null default now(),
  primary key (user_id, course_id)
);

-- ---------- Row Level Security ----------
alter table public.courses     enable row level security;
alter table public.enrollments enable row level security;

-- Anyone can view the course catalog
drop policy if exists "Courses are public" on public.courses;
create policy "Courses are public" on public.courses
  for select using (true);

-- Students can only see and change their own enrollments
drop policy if exists "Read own enrollments" on public.enrollments;
create policy "Read own enrollments" on public.enrollments
  for select using (auth.uid() = user_id);

drop policy if exists "Enroll self" on public.enrollments;
create policy "Enroll self" on public.enrollments
  for insert with check (auth.uid() = user_id);

drop policy if exists "Update own progress" on public.enrollments;
create policy "Update own progress" on public.enrollments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Unenroll self" on public.enrollments;
create policy "Unenroll self" on public.enrollments
  for delete using (auth.uid() = user_id);

-- ---------- Sample courses ----------
insert into public.courses (title, category, level, icon, duration, description, video_url, lessons)
select * from (values
  ('Introduction to Cloud Computing', 'Cloud', 'Beginner', '☁️', '4 hours',
   'Learn cloud basics: IaaS, PaaS, SaaS and deployment models.',
   'https://www.youtube.com/embed/M988_fsOSWo',
   array['What is Cloud Computing?', 'Service Models (IaaS, PaaS, SaaS)', 'Deployment Models', 'Benefits and Challenges']),
  ('AWS for Beginners', 'Cloud', 'Beginner', '🟧', '6 hours',
   'Get started with Amazon Web Services: EC2, S3 and more.',
   'https://www.youtube.com/embed/3hLmDS179YE',
   array['AWS Account Setup', 'EC2 Virtual Machines', 'S3 Storage', 'IAM Users and Roles', 'Hosting a Website']),
  ('Python Programming', 'Programming', 'Beginner', '🐍', '8 hours',
   'Master Python from basics to functions and file handling.',
   'https://www.youtube.com/embed/_uQrJ0TkZlc',
   array['Variables and Data Types', 'Conditions and Loops', 'Functions', 'Lists and Dictionaries', 'File Handling']),
  ('HTML & CSS Basics', 'Web', 'Beginner', '🌐', '5 hours',
   'Build beautiful web pages with HTML and CSS.',
   'https://www.youtube.com/embed/mU6anWqZJcc',
   array['HTML Structure', 'Text, Links and Images', 'CSS Selectors', 'Flexbox and Grid']),
  ('JavaScript Essentials', 'Web', 'Intermediate', '⚡', '6 hours',
   'Add interactivity to websites using JavaScript.',
   'https://www.youtube.com/embed/W6NZfCO5SIk',
   array['Variables and Functions', 'DOM Manipulation', 'Events', 'Fetching Data from APIs']),
  ('SQL & Databases', 'Database', 'Intermediate', '🗄️', '5 hours',
   'Understand relational databases and write SQL queries.',
   'https://www.youtube.com/embed/HXV3zeQKqGY',
   array['What is a Database?', 'SELECT Queries', 'INSERT, UPDATE, DELETE', 'Joins', 'Cloud Databases (Supabase / Postgres)'])
) as seed
where not exists (select 1 from public.courses);

-- Tell the Supabase API to pick up the new tables right away
notify pgrst, 'reload schema';
