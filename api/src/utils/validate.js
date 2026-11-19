function httpError(status, message) {
    const err = new Error(message);
    err.status = status;
    err.expose = true;
    return err;
}

function requireFields(body, fields) {
    const missing = fields.filter((f) => {
        const v = body?.[f];
        return v === undefined || v === null || v === '';
    });
    if (missing.length) {
        throw httpError(400, `Missing required fields: ${missing.join(', ')}`);
    }
}

function parseId(value, label = 'id') {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) {
        throw httpError(400, `Invalid ${label}`);
    }
    return n;
}

function positiveNumber(value, label = 'amount') {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
        throw httpError(400, `${label} must be greater than 0`);
    }
    return Number(n.toFixed(2));
}

function nonNegativeNumber(value, label = 'amount') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
        throw httpError(400, `${label} must be 0 or greater`);
    }
    return Number(n.toFixed(2));
}

module.exports = {
    httpError,
    requireFields,
    parseId,
    positiveNumber,
    nonNegativeNumber,
};
