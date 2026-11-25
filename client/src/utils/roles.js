export const ROLES = {
    SUPER_ADMIN: 'Super Admin',
    STORE_ADMIN: 'Store Admin',
    STORE_OPERATOR: 'Store Operator',
};

/** Roles that can manage master data and create purchases */
export const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.STORE_ADMIN];

/** Only Super Admin can manage users */
export const SUPER_ADMIN_ROLES = [ROLES.SUPER_ADMIN];

export function getUserRole(user) {
    return user?.role?.name || null;
}

export function hasRole(user, roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    const role = getUserRole(user);
    return Boolean(role && allowed.includes(role));
}


export function isAdmin(user) {
    return hasRole(user, ADMIN_ROLES);
}

export function isSuperAdmin(user) {
    return hasRole(user, SUPER_ADMIN_ROLES);
}
