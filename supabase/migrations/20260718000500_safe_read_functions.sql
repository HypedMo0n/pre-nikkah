create or replace function public.get_connection_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple public.couples%rowtype;
  v_partner_id uuid;
  v_partner_display_name text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select couple.*
  into v_couple
  from public.couples couple
  where couple.id = public.current_couple_id();

  if not found then
    return jsonb_build_object('status', 'not_connected');
  end if;

  v_partner_id := case
    when v_couple.user_a_id = v_user_id then v_couple.user_b_id
    else v_couple.user_a_id
  end;

  if v_partner_id is not null then
    select account.private_display_name
    into v_partner_display_name
    from public.private_accounts account
    where account.id = v_partner_id;
  end if;

  return jsonb_build_object(
    'status', v_couple.status,
    'connectedPartner', case
      when v_partner_id is null then null
      else jsonb_build_object('privateDisplayName', v_partner_display_name)
    end
  );
end;
$$;

revoke all on function public.get_connection_overview()
  from public, anon, authenticated;
grant execute on function public.get_connection_overview() to authenticated;

create or replace function public.get_question_comparison(p_question_id uuid)
returns table (
  status text,
  question_id uuid,
  bucket text,
  own_answer jsonb,
  own_answer_revealed boolean,
  partner_answer_revealed boolean,
  partner_answer jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple public.couples%rowtype;
  v_question public.questions%rowtype;
  v_own_answer public.answers%rowtype;
  v_partner_answer public.answers%rowtype;
  v_partner_id uuid;
  v_has_own_answer boolean := false;
  v_has_partner_answer boolean := false;
  v_bucket text;
  v_scale_difference integer;
  v_partner_is_revealed boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select couple.*
  into v_couple
  from public.couples couple
  where couple.id = public.current_couple_id();

  if not found then
    raise exception using errcode = 'P0001', message = 'ACTIVE_COUPLE_REQUIRED';
  end if;

  select question.*
  into v_question
  from public.questions question
  join public.topics topic on topic.id = question.topic_id
  where question.id = p_question_id
    and question.is_active
    and topic.is_active;

  if not found then
    raise exception using errcode = 'P0001', message = 'QUESTION_UNAVAILABLE';
  end if;

  v_partner_id := case
    when v_couple.user_a_id = v_user_id then v_couple.user_b_id
    else v_couple.user_a_id
  end;

  select answer.*
  into v_own_answer
  from public.answers answer
  where answer.question_id = p_question_id
    and answer.user_id = v_user_id
    and answer.couple_id = v_couple.id;
  v_has_own_answer := found;

  if not v_has_own_answer then
    return query
    select
      'waiting_for_you'::text,
      p_question_id,
      null::text,
      null::jsonb,
      null::boolean,
      null::boolean,
      null::jsonb;
    return;
  end if;

  if v_partner_id is null then
    return query
    select
      'waiting_for_partner'::text,
      p_question_id,
      null::text,
      null::jsonb,
      null::boolean,
      null::boolean,
      null::jsonb;
    return;
  end if;

  select answer.*
  into v_partner_answer
  from public.answers answer
  where answer.question_id = p_question_id
    and answer.user_id = v_partner_id
    and answer.couple_id = v_couple.id;
  v_has_partner_answer := found;

  if not v_has_partner_answer then
    return query
    select
      'waiting_for_partner'::text,
      p_question_id,
      null::text,
      null::jsonb,
      null::boolean,
      null::boolean,
      null::jsonb;
    return;
  end if;

  case v_question.comparison_mode
    when 'exact' then
      v_bucket := case
        when v_own_answer.value = v_partner_answer.value then 'aligned'
        else 'worth_discussing'
      end;
    when 'scale_distance' then
      v_scale_difference := abs(
        (v_own_answer.value #>> '{}')::integer
        - (v_partner_answer.value #>> '{}')::integer
      );
      v_bucket := case
        when v_scale_difference <= 1 then 'aligned'
        when v_scale_difference = 2 then 'worth_discussing'
        else 'possible_concern'
      end;
    when 'discussion_only' then
      v_bucket := 'worth_discussing';
    when 'never_compare' then
      v_bucket := 'worth_discussing';
    else
      raise exception using errcode = 'P0001', message = 'COMPARISON_UNAVAILABLE';
  end case;

  v_partner_is_revealed := v_partner_answer.revealed and v_question.can_reveal;

  return query
  select
    'ready'::text,
    p_question_id,
    v_bucket,
    v_own_answer.value,
    v_own_answer.revealed,
    v_partner_is_revealed,
    case
      when v_partner_is_revealed then v_partner_answer.value
      else null::jsonb
    end;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = 'P0001', message = 'COMPARISON_UNAVAILABLE';
end;
$$;

revoke all on function public.get_question_comparison(uuid)
  from public, anon, authenticated;
grant execute on function public.get_question_comparison(uuid) to authenticated;

create or replace function public.get_topic_comparison_summary(p_topic_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_question record;
  v_result record;
  v_aligned integer := 0;
  v_worth_discussing integer := 0;
  v_possible_concern integer := 0;
  v_waiting integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if public.current_couple_id() is null then
    raise exception using errcode = 'P0001', message = 'ACTIVE_COUPLE_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.topics topic
    where topic.id = p_topic_id
      and topic.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'TOPIC_UNAVAILABLE';
  end if;

  for v_question in
    select question.id
    from public.questions question
    where question.topic_id = p_topic_id
      and question.is_active
    order by question.order_index
  loop
    select comparison.*
    into v_result
    from public.get_question_comparison(v_question.id) comparison;

    if v_result.status <> 'ready' then
      v_waiting := v_waiting + 1;
    elsif v_result.bucket = 'aligned' then
      v_aligned := v_aligned + 1;
    elsif v_result.bucket = 'worth_discussing' then
      v_worth_discussing := v_worth_discussing + 1;
    elsif v_result.bucket = 'possible_concern' then
      v_possible_concern := v_possible_concern + 1;
    else
      raise exception using errcode = 'P0001', message = 'COMPARISON_UNAVAILABLE';
    end if;
  end loop;

  return jsonb_build_object(
    'aligned', v_aligned,
    'worthDiscussing', v_worth_discussing,
    'possibleConcern', v_possible_concern,
    'waiting', v_waiting
  );
end;
$$;

revoke all on function public.get_topic_comparison_summary(uuid)
  from public, anon, authenticated;
grant execute on function public.get_topic_comparison_summary(uuid) to authenticated;
