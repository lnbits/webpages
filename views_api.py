from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from lnbits.decorators import check_admin
from pydantic import BaseModel, Field

webpages_api_router = APIRouter(prefix="/api/v1", dependencies=[Depends(check_admin)])

PAGES_ROOT = Path(__file__).resolve().parent / "static" / "pages"
ALLOWED_EXTENSIONS = {".html", ".css", ".js"}
MAX_FILE_SIZE_BYTES = 1_000_000


class PageFile(BaseModel):
    path: str = Field(..., min_length=1)
    content: str = ""


class PageInfo(BaseModel):
    path: str
    size: int
    updated_at: datetime


class PageList(BaseModel):
    files: list[PageInfo]


def ensure_pages_root() -> None:
    PAGES_ROOT.mkdir(parents=True, exist_ok=True)


def safe_page_path(file_path: str) -> Path:
    if not file_path or not file_path.strip():
        raise HTTPException(status_code=400, detail="Missing file path.")

    rel_path = Path(file_path.strip())
    if rel_path.is_absolute() or ".." in rel_path.parts:
        raise HTTPException(status_code=400, detail="Invalid file path.")

    full_path = (PAGES_ROOT / rel_path).resolve()
    root_path = PAGES_ROOT.resolve()
    if full_path != root_path and root_path not in full_path.parents:
        raise HTTPException(status_code=400, detail="Invalid file path.")

    if full_path.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only .html, .css, and .js files are allowed.",
        )

    return full_path


@webpages_api_router.get("/pages", response_model=PageList)
async def list_pages():
    ensure_pages_root()

    files: list[PageInfo] = []
    for path in PAGES_ROOT.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in ALLOWED_EXTENSIONS:
            continue
        stats = path.stat()
        files.append(
            PageInfo(
                path=path.relative_to(PAGES_ROOT).as_posix(),
                size=stats.st_size,
                updated_at=datetime.fromtimestamp(stats.st_mtime, tz=timezone.utc),
            )
        )

    files.sort(key=lambda item: item.path)
    return PageList(files=files)


@webpages_api_router.get("/pages/content/{file_path:path}")
async def get_page(file_path: str):
    ensure_pages_root()
    full_path = safe_page_path(file_path)

    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found.")

    content = full_path.read_text(encoding="utf-8")
    return {"path": file_path, "content": content}


@webpages_api_router.post("/pages")
async def save_page(payload: PageFile):
    ensure_pages_root()
    full_path = safe_page_path(payload.path)

    if len(payload.content.encode("utf-8")) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large.")

    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(payload.content, encoding="utf-8")

    return {"path": payload.path}


@webpages_api_router.delete("/pages/{file_path:path}")
async def delete_page(file_path: str):
    ensure_pages_root()
    full_path = safe_page_path(file_path)

    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found.")

    full_path.unlink()
    return {"deleted": file_path}
