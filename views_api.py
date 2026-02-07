from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from lnbits.decorators import check_admin
from pydantic import BaseModel, Field

webpages_api_router = APIRouter(prefix="/api/v1", dependencies=[Depends(check_admin)])

PAGES_ROOT = Path(__file__).resolve().parent / "static" / "pages"
ALLOWED_PAGE_EXTENSIONS = {".html", ".css", ".js"}
ALLOWED_IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".avif",
}
MAX_FILE_SIZE_BYTES = 1_000_000
MAX_IMAGE_SIZE_BYTES = 10_000_000


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


def safe_static_path(file_path: str, allowed_extensions: set[str]) -> Path:
    if not file_path or not file_path.strip():
        raise HTTPException(status_code=400, detail="Missing file path.")

    rel_path = Path(file_path.strip())
    if rel_path.is_absolute() or ".." in rel_path.parts:
        raise HTTPException(status_code=400, detail="Invalid file path.")

    full_path = (PAGES_ROOT / rel_path).resolve()
    root_path = PAGES_ROOT.resolve()
    if full_path != root_path and root_path not in full_path.parents:
        raise HTTPException(status_code=400, detail="Invalid file path.")

    if full_path.suffix.lower() not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type.",
        )

    return full_path


def safe_page_path(file_path: str) -> Path:
    return safe_static_path(file_path, ALLOWED_PAGE_EXTENSIONS)


def safe_asset_path(file_path: str) -> Path:
    return safe_static_path(file_path, ALLOWED_IMAGE_EXTENSIONS)


@webpages_api_router.get("/pages", response_model=PageList)
async def list_pages():
    ensure_pages_root()

    files: list[PageInfo] = []
    for path in PAGES_ROOT.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in ALLOWED_PAGE_EXTENSIONS:
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


@webpages_api_router.get("/pages/assets", response_model=PageList)
async def list_page_assets():
    ensure_pages_root()

    files: list[PageInfo] = []
    for path in PAGES_ROOT.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in ALLOWED_IMAGE_EXTENSIONS:
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


@webpages_api_router.post("/pages/assets")
async def upload_page_asset(
    file: Annotated[UploadFile, File(...)],
    folder: Annotated[str, Form()] = "assets",
):
    ensure_pages_root()

    filename = Path(file.filename or "").name
    if not filename:
        raise HTTPException(status_code=400, detail="Missing file name.")

    folder_path = Path(folder.strip() or "assets")
    if folder_path.is_absolute() or ".." in folder_path.parts:
        raise HTTPException(status_code=400, detail="Invalid folder path.")

    rel_path = (folder_path / filename).as_posix()
    full_path = safe_asset_path(rel_path)

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Image file too large.")

    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(contents)

    return {
        "path": rel_path,
        "url": f"/webpages/static/pages/{rel_path}",
    }


@webpages_api_router.delete("/pages/assets/{file_path:path}")
async def delete_page_asset(file_path: str):
    ensure_pages_root()
    full_path = safe_asset_path(file_path)

    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found.")

    full_path.unlink()
    return {"deleted": file_path}


@webpages_api_router.delete("/pages/{file_path:path}")
async def delete_page(file_path: str):
    ensure_pages_root()
    full_path = safe_page_path(file_path)

    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found.")

    full_path.unlink()
    return {"deleted": file_path}
