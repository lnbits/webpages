from fastapi import APIRouter, Depends
from lnbits.core.views.generic import index
from lnbits.decorators import check_admin

webpages_generic_router = APIRouter()

webpages_generic_router.add_api_route(
    "/",
    methods=["GET"],
    endpoint=index,
    dependencies=[Depends(check_admin)],
)
