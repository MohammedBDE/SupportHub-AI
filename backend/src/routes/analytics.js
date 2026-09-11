import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireAdmin } from '../middleware/authorize.js';

const router = Router();

const DEFAULT_TREND_DAYS = 30;
const MAXIMUM_TREND_DAYS = 90;

router.get('/', authenticate, requireAdmin, async (request, response, next) => {
    const trendDays = Math.min(
        MAXIMUM_TREND_DAYS,
        Math.max(1, Number(request.query.days) || DEFAULT_TREND_DAYS)
    );

    try {
        const [totals, byCategory, byPriority, byStatus, responseTimes, aiAdoption, trend, topAgents] =
            await Promise.all([
                query(
                    `SELECT
                         count(*)::int AS total_tickets,
                         count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS tickets_today,
                         count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS tickets_last_7_days,
                         count(*) FILTER (WHERE status IN ('open', 'in_progress'))::int AS tickets_open,
                         count(*) FILTER (WHERE ai_classified_at IS NOT NULL)::int AS tickets_classified_by_ai
                     FROM tickets`
                ),

                query(
                    `SELECT COALESCE(category, 'unclassified') AS name, count(*)::int AS value
                     FROM tickets
                     GROUP BY 1
                     ORDER BY value DESC`
                ),

                query(
                    `SELECT COALESCE(priority, 'unclassified') AS name, count(*)::int AS value
                     FROM tickets
                     GROUP BY 1
                     ORDER BY value DESC`
                ),

                query(
                    `SELECT status AS name, count(*)::int AS value
                     FROM tickets
                     GROUP BY 1
                     ORDER BY value DESC`
                ),

                query(
                    `SELECT
                         count(*) FILTER (WHERE first_response_at IS NOT NULL)::int AS answered_tickets,
                         round(
                             avg(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60.0)
                             FILTER (WHERE first_response_at IS NOT NULL)
                         )::int AS average_first_response_minutes,
                         round(
                             percentile_cont(0.5) WITHIN GROUP (
                                 ORDER BY EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60.0
                             ) FILTER (WHERE first_response_at IS NOT NULL)
                         )::int AS median_first_response_minutes,
                         round(
                             avg(EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600.0)
                             FILTER (WHERE closed_at IS NOT NULL)
                         )::int AS average_resolution_hours
                     FROM tickets`
                ),

                query(
                    `SELECT
                         count(*)::int AS total_replies,
                         count(*) FILTER (WHERE was_ai_suggested)::int AS ai_assisted_replies,
                         count(*) FILTER (
                             WHERE was_ai_suggested AND btrim(body) = btrim(ai_suggestion_text)
                         )::int AS ai_accepted_unchanged
                     FROM replies
                     WHERE is_internal_note = FALSE`
                ),

                query(
                    `SELECT to_char(series.day, 'YYYY-MM-DD') AS day,
                            COALESCE(counted.value, 0)::int AS value
                     FROM generate_series(
                              date_trunc('day', now()) - make_interval(days => ($1::int - 1)),
                              date_trunc('day', now()),
                              interval '1 day'
                          ) AS series(day)
                     LEFT JOIN (
                         SELECT date_trunc('day', created_at) AS day, count(*) AS value
                         FROM tickets
                         WHERE created_at >= date_trunc('day', now()) - make_interval(days => ($1::int - 1))
                         GROUP BY 1
                     ) AS counted ON counted.day = series.day
                     ORDER BY series.day`,
                    [trendDays]
                ),

                query(
                    `SELECT users.id,
                            users.full_name AS name,
                            count(replies.id)::int AS reply_count,
                            count(replies.id) FILTER (WHERE replies.was_ai_suggested)::int AS ai_assisted_count
                     FROM users
                     LEFT JOIN replies ON replies.author_id = users.id AND replies.is_internal_note = FALSE
                     GROUP BY users.id, users.full_name
                     HAVING count(replies.id) > 0
                     ORDER BY reply_count DESC
                     LIMIT 10`
                )
            ]);

        const adoption = aiAdoption.rows[0];

        return response.json({
            totals: totals.rows[0],
            responseTimes: responseTimes.rows[0],
            aiAdoption: {
                ...adoption,
                assistedShare:
                    adoption.total_replies > 0
                        ? Number((adoption.ai_assisted_replies / adoption.total_replies).toFixed(3))
                        : 0,
                acceptedUnchangedShare:
                    adoption.ai_assisted_replies > 0
                        ? Number(
                              (adoption.ai_accepted_unchanged / adoption.ai_assisted_replies).toFixed(3)
                          )
                        : 0
            },
            byCategory: byCategory.rows,
            byPriority: byPriority.rows,
            byStatus: byStatus.rows,
            trend: trend.rows,
            topAgents: topAgents.rows
        });
    } catch (error) {
        return next(error);
    }
});

export default router;
