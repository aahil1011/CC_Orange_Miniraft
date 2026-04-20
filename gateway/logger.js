function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][gateway] ${message}`);
}

module.exports = {
  log
};
