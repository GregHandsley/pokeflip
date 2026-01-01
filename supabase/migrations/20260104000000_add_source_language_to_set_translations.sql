-- Add source_language column to track which language the set was translated from
alter table public.set_translations
add column if not exists source_language text;

-- Create index for faster grouping queries
create index if not exists idx_set_translations_source_language 
on public.set_translations(source_language);

-- Update existing records: if source is 'translated', we can't determine the original language
-- but we can set it to null or try to infer from set_id patterns
-- For now, leave as null - they'll be updated on next import or can be manually set

