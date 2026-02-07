import pytest
from fastapi import APIRouter

from .. import webpages_ext


@pytest.mark.asyncio
async def test_router():
    router = APIRouter()
    router.include_router(webpages_ext)
