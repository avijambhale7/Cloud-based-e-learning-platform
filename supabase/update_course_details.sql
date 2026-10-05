-- CloudLearn update: course details + fixed HTML & CSS video
-- Run this once in Supabase: SQL Editor → New query → paste → Run
-- (Safe to run more than once.)

-- New columns for the course details section
alter table public.courses add column if not exists instructor   text;
alter table public.courses add column if not exists about        text;
alter table public.courses add column if not exists outcomes     text[] not null default '{}';
alter table public.courses add column if not exists requirements text;

update public.courses set
  instructor   = 'Simplilearn',
  about        = 'A beginner-friendly introduction to cloud computing. Understand what the cloud is, why companies use it, and how the main service and deployment models work.',
  outcomes     = array['Explain what cloud computing is', 'Compare IaaS, PaaS and SaaS with examples', 'Describe public, private and hybrid clouds', 'List the main benefits and risks of the cloud'],
  requirements = 'No experience needed.'
where title = 'Introduction to Cloud Computing';

update public.courses set
  instructor   = 'freeCodeCamp.org',
  about        = 'Learn the core Amazon Web Services used in the real world, and prepare for the AWS Certified Cloud Practitioner exam.',
  outcomes     = array['Create and secure an AWS account', 'Launch virtual servers with EC2', 'Store and share files with S3', 'Manage users and permissions with IAM'],
  requirements = 'Basic computer skills. Introduction to Cloud Computing is recommended first.'
where title = 'AWS for Beginners';

update public.courses set
  instructor   = 'Programming with Mosh',
  about        = 'Learn Python from scratch. It is one of the most popular programming languages, used for web apps, automation, data science and cloud scripting.',
  outcomes     = array['Write and run Python programs', 'Use variables, conditions and loops', 'Create reusable functions', 'Work with lists, dictionaries and files'],
  requirements = 'No programming experience needed.'
where title = 'Python Programming';

update public.courses set
  instructor   = 'freeCodeCamp.org',
  video_url    = 'https://www.youtube.com/embed/mU6anWqZJcc',
  about        = 'Build your first web pages. HTML gives a page its structure and CSS makes it look good; together they are the starting point of all web development.',
  outcomes     = array['Structure web pages with HTML5', 'Add text, links and images', 'Style pages with CSS selectors', 'Build layouts with Flexbox and Grid'],
  requirements = 'No experience needed.'
where title = 'HTML & CSS Basics';

update public.courses set
  instructor   = 'Programming with Mosh',
  about        = 'Make websites interactive with JavaScript, the programming language of the web.',
  outcomes     = array['Use variables, functions and objects', 'Change web pages with the DOM', 'Respond to clicks and other events', 'Fetch data from online APIs'],
  requirements = 'Basic HTML & CSS.'
where title = 'JavaScript Essentials';

update public.courses set
  instructor   = 'freeCodeCamp.org',
  about        = 'Understand how relational databases store data, and write SQL queries to read and change it, the same skills used with cloud databases like Supabase.',
  outcomes     = array['Understand tables, rows and keys', 'Query data with SELECT', 'Insert, update and delete records', 'Combine tables with joins'],
  requirements = 'No experience needed.'
where title = 'SQL & Databases';

-- Tell the Supabase API to pick up the new columns right away
notify pgrst, 'reload schema';
