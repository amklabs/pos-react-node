function prismaClientMessage(err) {
    if (err.code === 'P2002') return 'A record with that unique value already exists';
    if (err.code === 'P2003') return 'Cannot complete action: related records exist';
    if (err.code === 'P2025') return 'Record not found';
    return null;
}

function errorHandler(err, _req, res, _next) {
    const status = err.status || err.statusCode || 500;
    const prismaMsg = prismaClientMessage(err);

    if (status >= 500) {
        console.error(err);
    }

    if (err.expose && err.message) {
        return res.status(status).json({ error: err.message });
    }
    if (prismaMsg) {
        return res.status(status >= 400 && status < 500 ? status : 409).json({ error: prismaMsg });
    }
    if (status >= 400 && status < 500 && err.message) {
        return res.status(status).json({ error: err.message });
    }

    return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { errorHandler };
