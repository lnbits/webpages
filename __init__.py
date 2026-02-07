from fastapi import APIRouter
from lnbits.db import Database

from .views import webpages_generic_router
from .views_api import webpages_api_router

db = Database("ext_webpages")

webpages_ext: APIRouter = APIRouter(prefix="/webpages", tags=["WebPages"])
webpages_ext.include_router(webpages_generic_router)
webpages_ext.include_router(webpages_api_router)

webpages_static_files = [
    {
        "path": "/webpages/static",
        "name": "webpages_static",
    }
]


def webpages_start():
    return None


def webpages_stop():
    return None


__all__ = [
    "db",
    "webpages_ext",
    "webpages_start",
    "webpages_static_files",
    "webpages_stop",
]
