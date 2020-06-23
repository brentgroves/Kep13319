
function log (...args) {
  if (process.env.MY_ENV === "development") {
    console.log(...args);
  }
}

module.exports = {
    log
}
