/* Flappy Grey — online leaderboard settings.
 *
 * Leave these blank to keep records on each device only.
 * To share one record per route with every player, create a free Firebase project with a
 * Firestore database, then paste its Project ID and Web API key below (see README →
 * "Online records"). These values are public identifiers, not secrets; the Firestore
 * security rules in the README control what can be written.
 */
window.FG = window.FG || {};
window.FG.LEADERBOARD_CONFIG = {
  projectId: '',
  apiKey: '',
};
