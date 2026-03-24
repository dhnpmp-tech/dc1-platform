/**
 * DCP Phase 1 — Feedback utilities
 *
 * Import and call these helpers from any page or component to:
 *  - Track API calls (triggers the feedback prompt after 3 calls)
 *  - Trigger contextual surveys (deployment, inference, error)
 *
 * Usage:
 *   import { trackApiCall, triggerFeedbackSurvey } from '@/lib/feedback'
 *
 *   // After a successful inference request:
 *   trackApiCall()
 *   triggerFeedbackSurvey('inference')
 *
 *   // After a model deployment:
 *   trackApiCall()
 *   triggerFeedbackSurvey('deployment', 'Nemotron Nano 4B on RTX 4090')
 *
 *   // On an error page:
 *   triggerFeedbackSurvey('error', errorMessage)
 */

export type FeedbackSurveyType = 'deployment' | 'inference' | 'error' | 'general'

/**
 * Notify the FeedbackWidget that an API call was made.
 * After DC1_FEEDBACK_THRESHOLD (default: 3) calls, the engagement
 * prompt automatically appears.
 */
export function trackApiCall(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('dc1_api_call'))
}

/**
 * Immediately trigger a contextual survey panel.
 * @param survey  Which survey flow to show
 * @param context Optional context string (e.g. model name, error message)
 */
export function triggerFeedbackSurvey(
  survey: FeedbackSurveyType,
  context?: string,
): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('dc1_feedback_trigger', {
      detail: { survey, context: context ?? '' },
    }),
  )
}
