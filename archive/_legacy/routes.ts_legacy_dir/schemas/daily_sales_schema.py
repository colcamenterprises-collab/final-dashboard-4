from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ShiftInformation(BaseModel):
    staff_name: str
    shift: str
    date: str

class SalesInformation(BaseModel):
    dine_in: float
    takeaway: float
    grab: float
    foodpanda: float
    aroidee: float
    discounts: float
    refunds: float

class WagesStaffPayment(BaseModel):
    staff_paid: str
    payment_amount: float

class ShoppingExpense(BaseModel):
    category: str
    item: str
    quantity: int
    cost: float

class CashManagement(BaseModel):
    start_cash: float
    end_cash: float
    banked_amount: float
    buns_in_stock: int
    meat_weight: float

class DrinkStock(BaseModel):
    item: str
    quantity: int

class StockItem(BaseModel):
    category: str
    item: str
    quantity: int

class DailySalesForm(BaseModel):
    shift_info: ShiftInformation
    sales_info: SalesInformation
    wages_payments: List[WagesStaffPayment]
    shopping_expenses: List[ShoppingExpense]
    cash_management: CashManagement
    drink_stock: List[DrinkStock]
    fresh_food_stock: List[StockItem]
    frozen_food_stock: List[StockItem]
    shelf_items: List[StockItem]
    kitchen_items: List[StockItem]
    packaging_items: List[StockItem]
    submission_time: Optional[datetime] = Field(default_factory=datetime.utcnow)