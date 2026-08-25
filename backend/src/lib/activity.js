const { getGeoLocation } = require('./geo');

function extractIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
}

function logActivity(db, req, action, entityType, entityId, description) {
  const ip = extractIP(req);
  let rowId = null;
  try {
    const result = db.prepare(
      `INSERT INTO activity_log
       (user_id, username_snapshot, action, entity_type, entity_id, description,
        ip_address, location_city, location_region, location_country, location_coords)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)`
    ).run(
      req.session?.userId ?? null,
      req.session?.username ?? 'unknown',
      action,
      entityType,
      entityId ?? null,
      description,
      ip
    );
    rowId = result.lastInsertRowid;
  } catch (e) {
    // logging failure must not break the mutation
    return;
  }

  // Fire-and-forget: enrich with geo data asynchronously
  getGeoLocation(ip).then((geo) => {
    if (!geo || !rowId) return;
    try {
      db.prepare(
        `UPDATE activity_log
         SET location_city = ?, location_region = ?, location_country = ?, location_coords = ?
         WHERE id = ?`
      ).run(geo.city, geo.region, geo.country, geo.coords, rowId);
    } catch (e) { /* ignore */ }
  }).catch(() => {});
}

module.exports = { logActivity, extractIP };
