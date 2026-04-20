/**
 * Structured logger for the gateway service.
 * Prepends ISO timestamp and service name to each log message.
 * @param {string} message - Log message to output
 */
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][gateway] ${message}`);
}

module.exports = {
  log
};
