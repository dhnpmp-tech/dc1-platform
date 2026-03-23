// Utility functions for health check service

function promiseWithTimeout(promise, timeoutMs) {
  let timeoutHandle;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise])
    .then(result => {
      clearTimeout(timeoutHandle);
      return result;
    })
    .catch(error => {
      clearTimeout(timeoutHandle);
      throw error;
    });
}

module.exports = {
  promiseWithTimeout,
};
