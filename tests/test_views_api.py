from pathlib import Path

import pytest
from fastapi import HTTPException

from .. import views_api
from ..views_api import PageFile, delete_page, get_page, list_pages, save_page


@pytest.fixture()
def temp_pages_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    pages_root = tmp_path / "pages"
    monkeypatch.setattr(views_api, "PAGES_ROOT", pages_root)
    return pages_root


@pytest.mark.asyncio
async def test_save_list_get_page(temp_pages_root: Path):
    await save_page(PageFile(path="index.html", content="<h1>Hello</h1>"))

    page = await get_page("index.html")
    assert page["path"] == "index.html"
    assert page["content"] == "<h1>Hello</h1>"

    listing = await list_pages()
    assert len(listing.files) == 1
    assert listing.files[0].path == "index.html"
    assert listing.files[0].size > 0


@pytest.mark.asyncio
async def test_delete_page(temp_pages_root: Path):
    await save_page(PageFile(path="landing.html", content="ok"))

    result = await delete_page("landing.html")
    assert result["deleted"] == "landing.html"

    with pytest.raises(HTTPException) as exc:
        await get_page("landing.html")
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_reject_path_traversal(temp_pages_root: Path):
    with pytest.raises(HTTPException) as exc:
        await save_page(PageFile(path="../bad.html", content="x"))
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_reject_disallowed_extension(temp_pages_root: Path):
    with pytest.raises(HTTPException) as exc:
        await save_page(PageFile(path="bad.py", content="print('x')"))
    assert exc.value.status_code == 400
