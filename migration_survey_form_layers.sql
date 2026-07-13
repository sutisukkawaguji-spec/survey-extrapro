alter table public.survey_forms
  add column if not exists layer_type text not null default 'both',
  add column if not exists layer_color text not null default '#10b981';

alter table public.survey_forms
  drop constraint if exists survey_forms_layer_type_check,
  add constraint survey_forms_layer_type_check
    check (layer_type in ('both', 'point', 'polygon'));

alter table public.survey_forms
  drop constraint if exists survey_forms_layer_color_check,
  add constraint survey_forms_layer_color_check
    check (layer_color ~ '^#[0-9A-Fa-f]{6}$');

notify pgrst, 'reload schema';
