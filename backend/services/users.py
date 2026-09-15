import logging
from typing import Any, Dict

logger = logging.getLogger("kabadilink.services.users")


def attach_role_scoped_id(conn: Any, profile: Dict[str, Any]) -> Dict[str, Any]:
    """Adds collector_id or recycler_id to a /auth/me profile dict, based on role.

    The JWT only carries the user's row in `users`; clients (mobile especially) need
    their `collectors.id` / `recyclers.id` to scope "my lots" / "my earnings" queries,
    and there was previously no way to learn it after login.
    """
    role = profile.get("role")
    if role == "COLLECTOR":
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM collectors WHERE user_id = %s;", (profile["id"],))
            row = cur.fetchone()
        profile["collector_id"] = str(row["id"]) if row else None
    elif role == "RECYCLER":
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recyclers WHERE user_id = %s;", (profile["id"],))
            row = cur.fetchone()
        profile["recycler_id"] = str(row["id"]) if row else None
    return profile
