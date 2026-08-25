function logActivity(db, req, action, entityType, entityId, description) {
  try {
    db.prepare(
      'INSERT INTO activity_log (user_id, username_snapshot, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      req.session?.userId ?? null,
      req.session?.username ?? 'unknown',
      action,
      entityType,
      entityId ?? null,
      description
    );
  } catch (e) { /* logging failure must not break the mutation */ }
}

module.exports = { logActivity };
