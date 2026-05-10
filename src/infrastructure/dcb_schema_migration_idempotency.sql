-- ============================================================
-- Migration: Add idempotency support to DCB schema
-- Run this on existing databases to upgrade from 0.9.x to 0.11.x
-- ============================================================

-- 1. Add idempotency_key column to events table (backfill with empty string)
ALTER TABLE dcb.events
    ADD COLUMN IF NOT EXISTS idempotency_key text NOT NULL DEFAULT '';

-- Remove the default after backfill so future inserts must provide a value
ALTER TABLE dcb.events
    ALTER COLUMN idempotency_key DROP DEFAULT;

-- 2. Create idempotency_keys table
CREATE TABLE IF NOT EXISTS dcb.idempotency_keys (
    idempotency_key text        PRIMARY KEY,
    command_kind    text        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- 3. Add index for idempotency key lookups
CREATE INDEX IF NOT EXISTS idx_events_idempotency_key
    ON dcb.events (idempotency_key);

-- 4. Replace unconditional_append with new signature
CREATE OR REPLACE FUNCTION dcb.unconditional_append(
    new_events      dcb.dcb_event_tt[],
    idempotency_key TEXT,
    command_kind    TEXT
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    max_id       bigint;
    event_record dcb.dcb_event_tt;
    inserted_id  bigint;
    tag_item     text;
BEGIN
    INSERT INTO dcb.idempotency_keys (idempotency_key, command_kind)
    VALUES (unconditional_append.idempotency_key, unconditional_append.command_kind);

    max_id := 0;

    FOREACH event_record IN ARRAY new_events
    LOOP
        INSERT INTO dcb.events (type, data, tags, idempotency_key)
        VALUES (event_record.type, event_record.data, event_record.tags, unconditional_append.idempotency_key)
        RETURNING id INTO inserted_id;

        max_id := GREATEST(max_id, inserted_id);

        FOREACH tag_item IN ARRAY event_record.tags
        LOOP
            INSERT INTO dcb.event_tags (tag, main_id)
            VALUES (tag_item, inserted_id);
        END LOOP;
    END LOOP;

    RETURN max_id;
END;
$$;

-- 5. Replace conditional_append with new signature
CREATE OR REPLACE FUNCTION dcb.conditional_append(
    query_items     dcb.dcb_query_item_tt[],
    after_id        bigint,
    new_events      dcb.dcb_event_tt[],
    idempotency_key TEXT,
    command_kind    TEXT
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    conflict_exists boolean;
BEGIN
    SET LOCAL lock_timeout = '5s';
    LOCK TABLE dcb.events IN EXCLUSIVE MODE;

    WITH query_items_cte AS (
        SELECT * FROM unnest(query_items) WITH ORDINALITY
    ),
    initial_matches AS (
        SELECT t.main_id,
               qi.ordinality,
               t.tag,
               qi.tags  AS required_tags,
               qi.types AS allowed_types
          FROM query_items_cte qi
          JOIN dcb.event_tags t ON t.tag = ANY(qi.tags)
         WHERE t.main_id > COALESCE(after_id, 0)
    ),
    matched_groups AS (
        SELECT main_id,
               ordinality,
               COUNT(DISTINCT tag)            AS matched_tag_count,
               array_length(required_tags, 1) AS required_tag_count,
               allowed_types
          FROM initial_matches
         GROUP BY main_id, ordinality, required_tag_count, allowed_types
    ),
    qualified_ids AS (
        SELECT main_id, allowed_types
          FROM matched_groups
         WHERE matched_tag_count = required_tag_count
    ),
    conflicts AS (
        SELECT e.id
          FROM dcb.events e
          JOIN qualified_ids q ON q.main_id = e.id
         WHERE e.id > COALESCE(after_id, 0)
           AND (array_length(q.allowed_types, 1) IS NULL
                OR array_length(q.allowed_types, 1) = 0
                OR e.type = ANY(q.allowed_types))
         LIMIT 1
    )
    SELECT EXISTS (SELECT 1 FROM conflicts)
      INTO conflict_exists;

    IF NOT conflict_exists THEN
        RETURN dcb.unconditional_append(new_events, conditional_append.idempotency_key, conditional_append.command_kind);
    END IF;

    RETURN NULL;
END;
$$;

-- 6. Drop old function signatures (cleanup)
DROP FUNCTION IF EXISTS dcb.unconditional_append(dcb.dcb_event_tt[]);
DROP FUNCTION IF EXISTS dcb.conditional_append(dcb.dcb_query_item_tt[], bigint, dcb.dcb_event_tt[]);

-- 7. Revoke public access on new unconditional_append
REVOKE ALL ON FUNCTION dcb.unconditional_append(dcb.dcb_event_tt[], TEXT, TEXT) FROM PUBLIC;
