from pydantic import ValidationError
from schemas.daily_sales_schema import DailySalesForm

def validate_daily_sales_form(data: dict):
    try:
        validated_form = DailySalesForm(**data)
        return {
            "success": True,
            "data": validated_form.dict()
        }
    except ValidationError as e:
        return {
            "success": False,
            "errors": e.errors()
        }