/**
 * process-referral-bonuses.js
 *
 * Cron job that calculates and credits referral bonuses.
 * For each active referral, computes 5% (bonus_pct) of the referred provider's
 * earnings since the last run and credits it to the referrer.
 *
 * Runs daily at 01:00 via PM2 cron.
 *
 * Schema dependencies:
 *   - referrals (referrer_id, referred_id, status, bonus_pct, total_bonus_halala, expires_at)
 *   - providers (total_earnings_halala, referral_earnings_halala)
 *   - earnings_daily (provider_id, day, earned_halala)
 */
const db = require('../db');

const TAG = '[referral-bonus]';

function getColumnSet(tableName) {
    try {
        const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
        return new Set(rows.map(r => r.name));
    } catch {
        return new Set();
    }
}

function run() {
    const now = new Date();
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
    console.log(`${TAG} Starting referral bonus processing at ${now.toISOString()}`);

    // ── 1. Expire stale referrals ──────────────────────────────────────────
    const expired = db.prepare(`
        UPDATE referrals
        SET status = 'expired'
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND datetime(expires_at) < datetime('now')
    `).run();
    if (expired.changes > 0) {
        console.log(`${TAG} Expired ${expired.changes} referral(s) past their bonus window`);
    }

    // ── 2. Fetch active referrals ──────────────────────────────────────────
    const activeReferrals = db.prepare(`
        SELECT r.id, r.referrer_id, r.referred_id, r.bonus_pct,
               r.total_bonus_halala, r.created_at
        FROM referrals r
        WHERE r.status = 'active'
    `).all();

    if (activeReferrals.length === 0) {
        console.log(`${TAG} No active referrals to process`);
        return;
    }

    console.log(`${TAG} Processing ${activeReferrals.length} active referral(s)`);

    // ── 3. Check if earnings_daily table exists ────────────────────────────
    const hasDailyTable = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='earnings_daily'`
    ).get();

    // We need yesterday's date for the bonus window
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const providerCols = getColumnSet('providers');
    const hasReferralEarnings = providerCols.has('referral_earnings_halala');

    // ── 4. Calculate and credit bonuses in a transaction ───────────────────
    const tx = db.transaction(() => {
        let totalBonusHalala = 0;
        let referralsProcessed = 0;

        for (const ref of activeReferrals) {
            // Get the referred provider's earnings for yesterday
            let dayEarnings = 0;

            if (hasDailyTable) {
                // Use earnings_daily if available (most accurate)
                const daily = db.prepare(`
                    SELECT COALESCE(SUM(earned_halala), 0) as earned
                    FROM earnings_daily
                    WHERE provider_id = ? AND day = ?
                `).get(ref.referred_id, yesterdayStr);
                dayEarnings = daily?.earned || 0;
            } else {
                // Fallback: estimate from completed jobs yesterday
                const jobEarnings = db.prepare(`
                    SELECT COALESCE(SUM(provider_earned_halala), 0) as earned
                    FROM jobs
                    WHERE provider_id = ?
                      AND status = 'completed'
                      AND date(completed_at) = ?
                `).get(ref.referred_id, yesterdayStr);
                dayEarnings = jobEarnings?.earned || 0;
            }

            if (dayEarnings <= 0) continue;

            // Calculate bonus: bonus_pct% of the referred provider's daily earnings
            const bonusHalala = Math.floor(dayEarnings * (ref.bonus_pct / 100));
            if (bonusHalala <= 0) continue;

            // Credit the referrer
            db.prepare(`
                UPDATE referrals
                SET total_bonus_halala = total_bonus_halala + ?
                WHERE id = ?
            `).run(bonusHalala, ref.id);

            // Credit the referrer's provider record
            if (hasReferralEarnings) {
                db.prepare(`
                    UPDATE providers
                    SET referral_earnings_halala = COALESCE(referral_earnings_halala, 0) + ?
                    WHERE id = ?
                `).run(bonusHalala, ref.referrer_id);
            }

            // Also add to the referrer's total earnings so it shows in their balance
            db.prepare(`
                UPDATE providers
                SET total_earnings_halala = COALESCE(total_earnings_halala, 0) + ?
                WHERE id = ?
            `).run(bonusHalala, ref.referrer_id);

            totalBonusHalala += bonusHalala;
            referralsProcessed++;

            console.log(
                `${TAG}   Referral #${ref.id}: referrer=${ref.referrer_id} <- referred=${ref.referred_id} ` +
                `| day_earnings=${dayEarnings}h | bonus=${bonusHalala}h (${ref.bonus_pct}%)`
            );
        }

        return { totalBonusHalala, referralsProcessed };
    });

    const result = tx();
    const totalSar = (result.totalBonusHalala / 100).toFixed(2);
    console.log(
        `${TAG} Done. Processed ${result.referralsProcessed}/${activeReferrals.length} referrals. ` +
        `Total bonus credited: ${result.totalBonusHalala} halala (SAR ${totalSar})`
    );
}

try {
    run();
    process.exit(0);
} catch (error) {
    console.error(`${TAG} Fatal error:`, error.message);
    process.exit(1);
}
