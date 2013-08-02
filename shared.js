var shared = {};
module.exports = shared;

shared.getLastNElements = function(arr, n) {
  return arr.slice(Math.max(arr.length - n, 0));
};