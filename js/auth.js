/* ============================================================================
   auth.js — Login, session management, and 4-tier RBAC
   Roles (lowest -> highest privilege): user, entry, manager, superadmin
   ========================================================================= */

const ROLE_RANK = { user: 1, entry: 2, manager: 3, superadmin: 4 };

const Auth = {
  SESSION_KEY: 'bms_session',
  current: null,

  async login(username, password) {
    const u = await db.users.where('username').equalsIgnoreCase(username).first();
    if (!u) return { ok: false, message: 'User not found.' };
    if (u.status !== 'active') return { ok: false, message: 'This account has been disabled. Contact your admin.' };
    const hash = await hashPassword(u.username, password);
    if (hash !== u.passwordHash) return { ok: false, message: 'Incorrect password.' };

    this.current = { id: u.id, username: u.username, name: u.name, role: u.role, flatId: u.flatId || null };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(this.current));
    await logAudit(u.id, 'LOGIN', `User ${u.username} logged in`);
    return { ok: true, user: this.current };
  },

  logout() {
    if (this.current) logAudit(this.current.id, 'LOGOUT', `User ${this.current.username} logged out`);
    this.current = null;
    localStorage.removeItem(this.SESSION_KEY);
  },

  restoreSession() {
    const raw = localStorage.getItem(this.SESSION_KEY);
    if (raw) {
      try { this.current = JSON.parse(raw); return true; } catch (e) { return false; }
    }
    return false;
  },

  isLoggedIn() { return !!this.current; },

  hasRole(minRole) {
    if (!this.current) return false;
    return ROLE_RANK[this.current.role] >= ROLE_RANK[minRole];
  },

  isExactly(role) {
    return this.current && this.current.role === role;
  },

  roleLabel(role) {
    const map = { user: 'roleUser', entry: 'roleEntry', manager: 'roleManager', superadmin: 'roleSuperadmin' };
    return map[role] ? t(map[role]) : role;
  },

  async changePassword(userId, newPlain) {
    const u = await db.users.get(userId);
    if (!u) return false;
    const hash = await hashPassword(u.username, newPlain);
    await db.users.update(userId, { passwordHash: hash });
    await logAudit(this.current ? this.current.id : userId, 'PASSWORD_RESET', `Password reset for ${u.username}`);
    return true;
  }
};
