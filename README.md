# OldSkool — Fitness Studio

OldSkool is a multi-branch gym management SaaS.

## Architecture
- Frontend: browser HTML/CSS/JavaScript
- Authentication: Supabase Auth
- Database: Supabase PostgreSQL
- Authorization: PostgreSQL Row Level Security
- Realtime: Supabase Realtime
- Hosting: Netlify later, after finalization

## Supabase project
OldSkool has its own Supabase project. Existing projects are not used.

## Development rule
Business data must come from Supabase. Do not add demo members, branches, payments, passwords, or other business records to the frontend source.

## Roles
- Owner: organization-wide
- Manager: assigned branch
- Trainer: assigned branch
