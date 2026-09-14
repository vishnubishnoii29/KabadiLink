import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("kabadilink.services.safety")


def list_safety_content(
    conn: Any,
    material_code: str,
    content_type: Optional[str] = None,
    language: str = "en",
) -> List[Dict[str, Any]]:
    clauses = ["material_code = %s", "language = %s"]
    params: List[Any] = [material_code, language]
    if content_type:
        clauses.append("content_type = %s")
        params.append(content_type)

    with conn.cursor() as cur:
        cur.execute(
            f"SELECT id, material_code, language, content_type, content_url "
            f"FROM safety_content WHERE {' AND '.join(clauses)} ORDER BY id;",
            params,
        )
        rows = cur.fetchall()
    return [dict(r) for r in rows]
