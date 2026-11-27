const isObjectIdString = (id) => typeof id === "string" && /^[a-f\d]{24}$/i.test(id);
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isDuplicateKeyError = (err) => err && err.code === 11000;

module.exports = { isObjectIdString, escapeRegex, isDuplicateKeyError };
