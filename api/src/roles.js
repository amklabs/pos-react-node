const ROLES = {
    SUPER_ADMIN: 'Super Admin',
    STORE_ADMIN: 'Store Admin',
    STORE_OPERATOR: 'Store Operator',
};

/** Roles that can manage master data and create purchases */
const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.STORE_ADMIN];

function hasRole(user, roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    return Boolean(user?.role && allowed.includes(user.role));
}

module.exports = { ROLES, ADMIN_ROLES, hasRole };
