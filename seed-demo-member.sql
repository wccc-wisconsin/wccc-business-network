-- Seed one member account as Golden Lotus Catering, the demo persona.
--
-- Everything written here is INVENTED. It is the persona in
-- GOLDEN-LOTUS-PERSONA.md — an early-stage Milwaukee caterer — written straight
-- into one account so the AI features have a real business to talk about
-- instead of an empty profile. Nothing here describes a real business, and
-- nothing here is WCCC data.
--
-- WHAT IT DOES NOT SEED, deliberately: no conversations, no decision briefs, no
-- generated documents. Those are the things you are trying to judge. Seeding
-- them would mean reviewing text that was written into the database rather than
-- produced by your deployment, which is the opposite of a test. Everything here
-- is an *input*: the profile, the Business Snapshot, the saved facts, and the
-- guided-step answers the Module Toolkit builds documents from.
--
-- BEFORE YOU RUN IT
--   1. Sign in to the portal and complete onboarding. That creates the member
--      row with your real Clerk id, which this script looks up. It cannot
--      create the row itself — only Clerk knows that id.
--   2. Change the email on the line marked EDIT THIS below.
--
-- Safe to re-run: every write is an upsert keyed the way the app keys it, so a
-- second run overwrites the same rows rather than duplicating them.
--
-- To undo it, see the teardown at the bottom.

do $$
declare
  -- EDIT THIS — the email you signed in with.
  v_email text := 'sylsch310@gmail.com';
  v_member text;
begin
  select id into v_member from members where lower(email) = lower(v_email);

  if v_member is null then
    raise exception
      'No member row for %. Sign in and finish onboarding first, then re-run this.', v_email;
  end if;

  ------------------------------------------------------------------
  -- 1. The profile — the four answers onboarding asks for.
  --
  -- `name` is left alone: it came from your sign-in account and the dashboard
  -- greets you with it. Uncomment the line below to be greeted as Mei Chen.
  ------------------------------------------------------------------
  update members
     set business_name = 'Golden Lotus Catering',
         -- name       = 'Mei Chen',
         industry      = 'Food & Beverage',
         city          = 'Milwaukee',
         updated_at    = now()
   where id = v_member;

  ------------------------------------------------------------------
  -- 2. The Business Snapshot.
  --
  -- score and stage are what data/assessment.ts computes from these exact
  -- answers (44, "Early Stage") — they are stored rather than derived at read
  -- time, so a made-up number here would disagree with the answers beside it.
  --
  -- `free_module_key` is the column name; the code calls it priorityModuleKey.
  -- It no longer unlocks anything — every stage is open to every member — and
  -- is now what the AI leads with. "revenue" is the persona's stated priority.
  ------------------------------------------------------------------
  insert into business_assessments (member_id, answers, score, stage, free_module_key, updated_at)
  values (
    v_member,
    jsonb_build_object(
      'formation',        'operating',
      'time-in-business', 'year-1-3',
      'revenue',          'low',
      'team',             'solo',
      'operations',       'some',
      'funding',          'exploring',
      'priority',         'revenue'
    ),
    44,
    'Early Stage',
    'revenue',
    now()
  )
  on conflict (member_id) do update
    set answers         = excluded.answers,
        score           = excluded.score,
        stage           = excluded.stage,
        free_module_key = excluded.free_module_key,
        updated_at      = now();

  ------------------------------------------------------------------
  -- 3. Saved facts.
  --
  -- `confirmed_at` is set to now() on purpose: lib/memberContext.ts marks a
  -- fact stale once it is older than its fact's window, and a stale one reaches
  -- the model flagged as "worth checking before relying on it". Back-dating
  -- these would make the demo quietly weaker.
  --
  -- Every choice value below is one the picker actually offers — a value that
  -- is not in data/facts.ts is stored happily and then ignored everywhere.
  --
  -- `preferred_language` is deliberately NOT seeded. Set it yourself in the
  -- Business Snapshot to watch the bilingual feature work.
  ------------------------------------------------------------------
  insert into member_facts (member_id, fact_key, value, source, source_label, updated_at, confirmed_at)
  values
    (v_member, 'entity_structure',   'sole-prop',                                                        'seed', 'Demo seed', now(), now()),
    (v_member, 'formation_date',     '2025-06-15',                                                       'seed', 'Demo seed', now(), now()),
    (v_member, 'formation_state',    'wi',                                                               'seed', 'Demo seed', now(), now()),
    (v_member, 'has_employees',      'none',                                                             'seed', 'Demo seed', now(), now()),
    (v_member, 'pays_estimated_tax', 'no',                                                               'seed', 'Demo seed', now(), now()),
    (v_member, 'seller_permit',      'unsure',                                                           'seed', 'Demo seed', now(), now()),
    (v_member, 'bank_account',       'yes',                                                              'seed', 'Demo seed', now(), now()),
    (v_member, 'ownership_basis',    'minority-woman',                                                   'seed', 'Demo seed', now(), now()),
    (v_member, 'industry_license',   'Milwaukee County food handler certificate; I rent hours at a shared commissary', 'seed', 'Demo seed', now(), now()),
    (v_member, 'bookkeeping_system', 'A spreadsheet I update when I remember to',                        'seed', 'Demo seed', now(), now()),
    (v_member, 'monthly_costs',      'Around $1,400 — commissary hours, insurance, ingredients',         'seed', 'Demo seed', now(), now()),
    (v_member, 'target_customer',    'Private events and small office lunches around Milwaukee County',  'seed', 'Demo seed', now(), now()),
    (v_member, 'pricing_basis',      'Guessed from what other caterers seem to charge',                  'seed', 'Demo seed', now(), now()),
    (v_member, 'advisor',            'No — no accountant or SBDC advisor yet',                           'seed', 'Demo seed', now(), now())
  on conflict (member_id, fact_key) do update
    set value        = excluded.value,
        source       = excluded.source,
        source_label = excluded.source_label,
        updated_at   = now(),
        confirmed_at = now();

  ------------------------------------------------------------------
  -- 4. Guided-step answers.
  --
  -- Five steps in Launch and three in Revenue, marked complete. These are what
  -- the Module Toolkit reads to generate a document, and what "Review my
  -- answers" critiques — both are empty without them, so this is the part that
  -- makes those two features demonstrable at all.
  --
  -- Every step_key and question key below is real. A wrong one stores a row the
  -- app never displays, which looks exactly like the save having failed.
  ------------------------------------------------------------------
  insert into module_step_progress (member_id, module_key, step_key, completed, answers, updated_at)
  values
    (v_member, 'launch', 'validate-idea', true, jsonb_build_object(
      'problem', 'People hosting small events want food that is not the same three catering menus everyone else uses.',
      'proof',   'Eleven paid events last year, eight of them repeat customers or their friends.',
      'test',    'I ran two pop-up lunches and sold out both without advertising.'), now()),

    (v_member, 'launch', 'register-ein', true, jsonb_build_object(
      'structure',  'Sole proprietor right now. I keep meaning to look at an LLC.',
      'dfi-status', 'Not registered with WI DFI — operating under my own name.',
      'ein-status', 'No EIN yet. I use my SSN on the few forms anyone has asked for.'), now()),

    (v_member, 'launch', 'licenses-permits', true, jsonb_build_object(
      'industry-license',   'Milwaukee County food handler certificate.',
      'license-status',     'Certificate is current. I am not sure whether I need my own facility licence when I rent commissary hours.',
      'seller-permit',      'I do not have a seller permit and I am not sure whether catering needs one.',
      'local-requirements', 'Nobody has asked me for anything beyond the food handler card.'), now()),

    (v_member, 'launch', 'bank-insurance', true, jsonb_build_object(
      'bank-account',      'Yes — a separate account, opened last spring.',
      'insurance-type',    'General liability only, through a local broker.',
      'insurance-provider','A broker on the south side arranged it. Renews in March.'), now()),

    (v_member, 'launch', 'accounting-payments', true, jsonb_build_object(
      'tracking',        'A spreadsheet. I enter deposits and receipts when I remember.',
      'payment-methods', 'Venmo and cash mostly. Two corporate clients wanted an invoice and I wrote it in Word.',
      'tax-savings',     'I do not set anything aside. I have not paid estimated tax.'), now()),

    (v_member, 'revenue', 'local-presence', true, jsonb_build_object(
      'gbp-status',        'No Google Business Profile. I have an Instagram I post to when I remember.',
      'search-experience', 'Searching "Chinese catering Milwaukee" does not turn me up anywhere.',
      'reviews',           'Four Instagram comments. No reviews anywhere that counts.'), now()),

    (v_member, 'revenue', 'marketing-plan', true, jsonb_build_object(
      'channels',    'Word of mouth, and Instagram when I have time.',
      'time-money',  'Maybe two hours a week and nothing in money.',
      'best-channel','Every single booking has come from someone who ate my food at another event.'), now()),

    (v_member, 'revenue', 'pricing-sales', true, jsonb_build_object(
      'pricing-basis', 'I looked at two other caterers websites and priced just under them.',
      'close-rate',    'About half the people who ask for a quote book.',
      'objection',     'Price. Or they go quiet after the quote and I never find out why.'), now())
  on conflict (member_id, module_key, step_key) do update
    set completed  = excluded.completed,
        answers    = excluded.answers,
        updated_at = now();

  raise notice 'Seeded Golden Lotus Catering onto member %', v_member;
end $$;


------------------------------------------------------------------
-- TEARDOWN — removes everything above and leaves the account signed up but
-- empty. Select these lines and run them on their own.
--
-- It does not delete the member row, and it does not touch conversations,
-- decision briefs or generated documents: those are yours, not the seed's.
------------------------------------------------------------------
-- do $$
-- declare
--   v_email text := 'you@example.com';   -- EDIT THIS TOO
--   v_member text;
-- begin
--   select id into v_member from members where lower(email) = lower(v_email);
--   if v_member is null then
--     raise exception 'No member row for %', v_email;
--   end if;
--
--   delete from module_step_progress where member_id = v_member;
--   delete from member_facts          where member_id = v_member and source = 'seed';
--   delete from business_assessments  where member_id = v_member;
--
--   update members
--      set business_name = '', industry = '', city = '', updated_at = now()
--    where id = v_member;
--
--   raise notice 'Removed the demo seed from member %', v_member;
-- end $$;
