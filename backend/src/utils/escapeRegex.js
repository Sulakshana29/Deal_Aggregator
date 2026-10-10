/**
 * Escapes every RegExp metacharacter so user input is matched literally.
 *
 * Without this, a query like ?search=(a+)+$ is compiled as a real regex and
 * can trigger catastrophic backtracking (ReDoS), freezing the event loop.
 */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = escapeRegex;
